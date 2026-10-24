/**
 * /api/orders — buyer-facing order routes
 *
 * POST   /api/orders                   Create/upsert an order record after on-chain payment
 * GET    /api/orders/:wallet            List all orders for a wallet address (lowercase)
 * GET    /api/orders/detail/:orderId    Get a single order by its smart-contract orderId
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/prisma.js'
import { OrderStatus } from '@prisma/client'
import { sendTelegram, msgNewOrder } from '../lib/telegram.js'

export const ordersRouter = new Hono()

// ── POST /api/orders ──────────────────────────────────────────────────────────
// Called by the frontend after a successful on-chain createOrder() transaction.
// Uses upsert so the call is fully idempotent — duplicate submissions from retries
// or reconnects are safe.
ordersRouter.post('/', async (c) => {
  let body: {
    orderId: string
    buyerWallet: string
    platform: string
    planDuration: string
    amount?: number       // preferred field name per spec
    amountUSDC?: number   // legacy alias accepted for backwards compat
    userHandle: string
    promoCode?: string
    referralCode?: string
    txHash?: string
    chainId?: number
  }

  try {
    body = await c.req.json()
  } catch (parseErr) {
    console.error('[POST /api/orders] Failed to parse request body:', parseErr)
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  // Accept both `amount` (new) and `amountUSDC` (legacy)
  const amountUSDC = body.amount ?? body.amountUSDC ?? 0

  // Validate required fields
  const missing: string[] = []
  if (!body.orderId)     missing.push('orderId')
  if (!body.buyerWallet) missing.push('buyerWallet')
  if (!body.platform)    missing.push('platform')
  if (!body.planDuration) missing.push('planDuration')
  if (!body.userHandle)  missing.push('userHandle')
  if (missing.length > 0) {
    console.error('[POST /api/orders] Missing required fields:', missing, '| received:', JSON.stringify(body))
    return c.json({ error: `Missing required fields: ${missing.join(', ')}` }, 400)
  }

  const walletLower = body.buyerWallet.toLowerCase()

  // Credit referral use if a valid code was supplied — best-effort, never blocks
  if (body.referralCode) {
    await prisma.referral
      .update({
        where: { code: body.referralCode },
        data: { totalUses: { increment: 1 } },
      })
      .catch((refErr: unknown) => {
        console.warn('[POST /api/orders] Referral credit skipped (code not found?):', refErr)
      })
  }

  let order
  try {
    // upsert: create on first call, return existing record on retry — fully idempotent
    order = await prisma.order.upsert({
      where: { orderId: body.orderId },
      update: {
        // On duplicate submission: update txHash if it was missing, leave status alone
        txHash: body.txHash ?? undefined,
      },
      create: {
        orderId:      body.orderId,
        buyerWallet:  walletLower,
        platform:     body.platform,
        planDuration: body.planDuration,
        amountUSDC:   amountUSDC,
        amount:       amountUSDC,   // explicit amount field per spec
        chainId:      body.chainId  ?? null,
        userHandle:   body.userHandle,
        promoCode:    body.promoCode    ?? null,
        referralCode: body.referralCode ?? null,
        txHash:       body.txHash       ?? null,
        status:       OrderStatus.PENDING,
      },
    })
    console.log('[POST /api/orders] Order saved:', order.orderId, '| wallet:', walletLower, '| status:', order.status)
  } catch (dbErr: unknown) {
    // Log the full error so it's visible in server logs / Railway / Render
    console.error('[POST /api/orders] Database write failed:')
    console.error('  orderId     :', body.orderId)
    console.error('  buyerWallet :', walletLower)
    console.error('  platform    :', body.platform)
    console.error('  planDuration:', body.planDuration)
    console.error('  amountUSDC  :', amountUSDC)
    console.error('  txHash      :', body.txHash)
    console.error('  chainId     :', body.chainId)
    console.error('  error       :', dbErr)
    return c.json(
      {
        error: 'Database write failed',
        detail: dbErr instanceof Error ? dbErr.message : String(dbErr),
      },
      500,
    )
  }

  // Fire-and-forget Telegram alert — never blocks the response
  void sendTelegram(msgNewOrder(order))

  return c.json(order, 201)
})

// ── GET /api/orders/:wallet ───────────────────────────────────────────────────
// Always lowercase the wallet address before querying — Supabase stores them
// lowercased (set by POST handler above), so a mixed-case address from wagmi
// must be normalised here too.
ordersRouter.get('/:wallet', async (c) => {
  const wallet = c.req.param('wallet').toLowerCase()

  let orders
  try {
    orders = await prisma.order.findMany({
      where: { buyerWallet: wallet },
      orderBy: { createdAt: 'desc' },
    })
    console.log(`[GET /api/orders/${wallet}] Returned ${orders.length} orders`)
  } catch (dbErr: unknown) {
    console.error(`[GET /api/orders/${wallet}] Database read failed:`, dbErr)
    return c.json(
      {
        error: 'Database read failed',
        detail: dbErr instanceof Error ? dbErr.message : String(dbErr),
      },
      500,
    )
  }

  return c.json(orders)
})

// ── GET /api/orders/detail/:orderId ──────────────────────────────────────────
ordersRouter.get('/detail/:orderId', async (c) => {
  const orderId = c.req.param('orderId')

  let order
  try {
    order = await prisma.order.findUnique({ where: { orderId } })
  } catch (dbErr: unknown) {
    console.error(`[GET /api/orders/detail/${orderId}] Database read failed:`, dbErr)
    return c.json(
      {
        error: 'Database read failed',
        detail: dbErr instanceof Error ? dbErr.message : String(dbErr),
      },
      500,
    )
  }

  if (!order) return c.json({ error: 'Order not found' }, 404)
  return c.json(order)
})
