/**
 * Premium Create — API Server
 * Runs on port 3001 alongside the Vite dev server (port 5173).
 * Vite proxies /api/* → http://localhost:3001 in dev.
 *
 * Routes:
 *   /api/orders/*      — buyer order CRUD
 *   /api/admin/*       — admin fulfillment + inventory (requires x-admin-secret header)
 *   /api/referrals/*   — referral code management
 *   /api/health        — liveness probe
 */
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { ordersRouter } from './routes/orders.js'
import { adminRouter } from './routes/admin.js'
import { referralsRouter } from './routes/referrals.js'

const app = new Hono()

// ── Global middleware ─────────────────────────────────────────────────────────
app.use('*', logger())
app.use(
  '*',
  cors({
    origin: [
      'http://localhost:5173',
      'https://*.preview.studio.arc.io',
      process.env.FRONTEND_URL ?? '',
    ].filter(Boolean),
    allowHeaders: ['Content-Type', 'x-admin-secret'],
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  }),
)

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }))

// ── Feature routers ───────────────────────────────────────────────────────────
app.route('/api/orders', ordersRouter)
app.route('/api/admin', adminRouter)
app.route('/api/referrals', referralsRouter)

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.API_PORT ?? 3001)

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`[arc-api] listening on http://localhost:${PORT}`)
})

export default app
