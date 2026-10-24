/**
 * /api/admin — owner/admin routes (protected by ADMIN_SECRET header)
 *
 * POST   /api/admin/fulfill             Fulfill an order: attach code, update status
 * POST   /api/admin/refund              Mark an order as REFUNDED
 * GET    /api/admin/orders              List all orders (with optional status filter)
 * GET    /api/admin/inventory           List inventory for a platform+duration
 * POST   /api/admin/inventory           Add activation codes to inventory
 * DELETE /api/admin/inventory/:id       Remove a specific inventory code
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/prisma.js'
import { OrderStatus } from '@prisma/client'
import { sendTelegram, msgOrderFulfilled, msgOrderRefunded } from '../lib/telegram.js'
import { fulfillOnChain } from '../lib/onchain.js'

export const adminRouter = new Hono()

// ── Auth middleware ───────────────────────────────────────────────────────────
adminRouter.use('*', async (c, next) => {
  const secret = c.req.header('x-admin-secret')
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})

// ── POST /api/admin/fulfill ───────────────────────────────────────────────────
adminRouter.post('/fulfill', async (c) => {
  const { orderId, activationCode } = await c.req.json<{
    orderId: string
    activationCode?: string
  }>()

  if (!orderId) return c.json({ error: 'orderId required' }, 400)

  const order = await prisma.order.findUnique({ where: { orderId } })
  if (!order) return c.json({ error: 'Order not found' }, 404)
  if (order.status !== OrderStatus.PENDING) {
    return c.json({ error: `Order is already ${order.status}` }, 409)
  }

  // If no activationCode supplied, pull the next unused one from inventory
  let code = activationCode ?? null
  if (!code) {
    const inv = await prisma.inventory.findFirst({
      where: { platform: order.platform, duration: order.planDuration, isUsed: false },
      orderBy: { createdAt: 'asc' },
    })
    if (inv) {
      code = inv.codeOrLink
      await prisma.inventory.update({
        where: { id: inv.id },
        data: { isUsed: true, usedForOrder: orderId },
      })
    }
  }

  const updated = await prisma.order.update({
    where: { orderId },
    data: {
      status: OrderStatus.DELIVERED,
      activationCode: code,
      fulfilledAt: new Date(),
    },
  })

  // ── On-chain release: fulfillOrder releases USDC from escrow to owner() ──────
  // orderId stored in DB is the external bytes32 hex string from createOrder()
  const onchain = await fulfillOnChain(orderId as `0x${string}`)
  // Record the release tx hash if available; don't fail the response on error
  if (onchain.txHash) {
    await prisma.order.update({
      where: { orderId },
      data: { fulfillTxHash: onchain.txHash },
    }).catch(() => null)
  }

  // Telegram notification
  void sendTelegram(msgOrderFulfilled({
    orderId: updated.orderId,
    platform: updated.platform,
    planDuration: updated.planDuration,
    userHandle: updated.userHandle,
    activationCode: updated.activationCode,
  }))

  // Credit the referrer if applicable
  if (order.referralCode) {
    const reward = order.amountUSDC * 0.025 // 2.5% referral reward
    await prisma.referral
      .update({
        where: { code: order.referralCode },
        data: { totalEarned: { increment: reward } },
      })
      .catch(() => null)
  }

  return c.json({
    ...updated,
    onchainRelease: {
      success: onchain.success,
      txHash: onchain.txHash ?? null,
      error: onchain.error ?? null,
    },
  })
})

// ── POST /api/admin/refund ────────────────────────────────────────────────────
adminRouter.post('/refund', async (c) => {
  const { orderId } = await c.req.json<{ orderId: string }>()
  if (!orderId) return c.json({ error: 'orderId required' }, 400)

  const order = await prisma.order.findUnique({ where: { orderId } })
  if (!order) return c.json({ error: 'Order not found' }, 404)
  if (order.status !== OrderStatus.PENDING) {
    return c.json({ error: `Order is already ${order.status}` }, 409)
  }

  const updated = await prisma.order.update({
    where: { orderId },
    data: { status: OrderStatus.REFUNDED },
  })

  void sendTelegram(msgOrderRefunded({
    orderId: updated.orderId,
    platform: updated.platform,
    buyerWallet: updated.buyerWallet,
    amountUSDC: updated.amountUSDC,
  }))

  return c.json(updated)
})

// ── GET /api/admin/orders ─────────────────────────────────────────────────────
adminRouter.get('/orders', async (c) => {
  const statusParam = c.req.query('status') as OrderStatus | undefined
  const orders = await prisma.order.findMany({
    where: statusParam ? { status: statusParam } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return c.json(orders)
})

// ── GET /api/admin/inventory ──────────────────────────────────────────────────
adminRouter.get('/inventory', async (c) => {
  const platform = c.req.query('platform')
  const duration = c.req.query('duration')
  const onlyAvailable = c.req.query('available') === 'true'

  const items = await prisma.inventory.findMany({
    where: {
      ...(platform ? { platform } : {}),
      ...(duration ? { duration } : {}),
      ...(onlyAvailable ? { isUsed: false } : {}),
    },
    orderBy: { createdAt: 'asc' },
  })
  return c.json(items)
})

// ── POST /api/admin/inventory ─────────────────────────────────────────────────
adminRouter.post('/inventory', async (c) => {
  const body = await c.req.json<{
    platform: string
    duration: string
    codes: string[] // array of activation codes / gift links
  }>()

  if (!body.platform || !body.duration || !Array.isArray(body.codes) || body.codes.length === 0) {
    return c.json({ error: 'platform, duration, and codes[] required' }, 400)
  }

  const created = await prisma.inventory.createMany({
    data: body.codes.map((c) => ({
      platform: body.platform,
      duration: body.duration,
      codeOrLink: c,
    })),
    skipDuplicates: true,
  })

  return c.json({ inserted: created.count }, 201)
})

// ── DELETE /api/admin/inventory/:id ──────────────────────────────────────────
adminRouter.delete('/inventory/:id', async (c) => {
  const id = c.req.param('id')
  await prisma.inventory.delete({ where: { id } }).catch(() => null)
  return c.json({ ok: true })
})
