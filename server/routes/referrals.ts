/**
 * /api/referrals — referral code management
 *
 * GET    /api/referrals/:wallet    Get or auto-create referral record for a wallet
 * GET    /api/referrals/validate/:code   Validate a referral code (returns referrer wallet)
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/prisma.js'

export const referralsRouter = new Hono()

// ── GET /api/referrals/:wallet ────────────────────────────────────────────────
referralsRouter.get('/:wallet', async (c) => {
  const wallet = c.req.param('wallet').toLowerCase()

  let referral = await prisma.referral.findFirst({ where: { referrerWallet: wallet } })

  if (!referral) {
    // Auto-create a referral record with a unique ARC-XXXXXX code
    const code = 'ARC-' + Math.random().toString(36).slice(2, 8).toUpperCase()
    referral = await prisma.referral.create({
      data: { referrerWallet: wallet, code },
    })
  }

  return c.json(referral)
})

// ── GET /api/referrals/validate/:code ────────────────────────────────────────
referralsRouter.get('/validate/:code', async (c) => {
  const code = c.req.param('code').toUpperCase()
  const referral = await prisma.referral.findUnique({ where: { code } })
  if (!referral) return c.json({ valid: false }, 404)
  return c.json({ valid: true, referrerWallet: referral.referrerWallet, totalUses: referral.totalUses })
})
