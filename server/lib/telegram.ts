/**
 * Telegram notification helper.
 * Sends messages to the configured chat via the Bot API.
 * Silently no-ops when credentials are absent (safe in dev without creds).
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID

export async function sendTelegram(text: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
  } catch {
    // Notification failure must never crash the API
  }
}

// ── Pre-formatted messages ────────────────────────────────────────────────────

export function msgNewOrder(o: {
  orderId: string
  buyerWallet: string
  platform: string
  planDuration: string
  amountUSDC: number
  userHandle: string
  txHash?: string | null
}): string {
  const short = (s: string) => s.slice(0, 10) + '...' + s.slice(-6)
  return [
    '🛒 <b>New Order</b>',
    `Platform : <b>${o.platform} — ${o.planDuration}</b>`,
    `Amount   : <b>${o.amountUSDC.toFixed(2)} USDC</b>`,
    `Handle   : <code>${o.userHandle}</code>`,
    `Wallet   : <code>${short(o.buyerWallet)}</code>`,
    `Order ID : <code>${short(o.orderId)}</code>`,
    o.txHash ? `Tx       : <code>${short(o.txHash)}</code>` : '',
  ].filter(Boolean).join('\n')
}

export function msgOrderFulfilled(o: {
  orderId: string
  platform: string
  planDuration: string
  userHandle: string
  activationCode?: string | null
}): string {
  const short = (s: string) => s.slice(0, 10) + '...' + s.slice(-6)
  return [
    '✅ <b>Order Fulfilled</b>',
    `Platform : <b>${o.platform} — ${o.planDuration}</b>`,
    `Handle   : <code>${o.userHandle}</code>`,
    `Code     : <code>${o.activationCode ?? '(auto-assigned from inventory)'}</code>`,
    `Order ID : <code>${short(o.orderId)}</code>`,
  ].join('\n')
}

export function msgOrderRefunded(o: {
  orderId: string
  platform: string
  buyerWallet: string
  amountUSDC: number
}): string {
  const short = (s: string) => s.slice(0, 10) + '...' + s.slice(-6)
  return [
    '↩️ <b>Order Refunded</b>',
    `Platform : <b>${o.platform}</b>`,
    `Amount   : <b>${o.amountUSDC.toFixed(2)} USDC</b>`,
    `Wallet   : <code>${short(o.buyerWallet)}</code>`,
    `Order ID : <code>${short(o.orderId)}</code>`,
  ].join('\n')
}
