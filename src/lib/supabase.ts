import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. ' +
    'Order history will not load from the database.',
  );
} else {
  console.log('[supabase] Initialised. URL:', supabaseUrl.slice(0, 40) + '...');
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');

// ── Telegram notifications (client-side, VITE_ prefixed) ─────────────────────

const TG_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN as string | undefined;
const TG_CHAT_ID   = import.meta.env.VITE_TELEGRAM_CHAT_ID   as string | undefined;

/**
 * Send a Telegram message via the Bot API directly from the browser.
 * Fire-and-forget — never throws, never blocks the order flow.
 * Logs the exact API error if the call fails.
 */
export async function sendTelegramAlert(text: string): Promise<void> {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
    console.warn('[telegram] VITE_TELEGRAM_BOT_TOKEN or VITE_TELEGRAM_CHAT_ID not set — skipping notification');
    return;
  }

  const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:    TG_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>;
      console.error('[telegram] sendMessage failed:', res.status, res.statusText, body);
    } else {
      console.log('[telegram] Notification sent successfully');
    }
  } catch (err) {
    console.error('[telegram] sendMessage network error:', err);
  }
}

// ── Typed query helpers ───────────────────────────────────────────────────────

export interface SupabaseOrder {
  id: string;
  orderId: string;
  buyerWallet: string;
  platform: string;
  planDuration: string;
  amountUSDC: number;
  amount: number | null;
  chainId: number | null;
  userHandle: string;
  email: string | null;
  promoCode: string | null;
  referralCode: string | null;
  status: 'PENDING' | 'DELIVERED' | 'REFUNDED';
  activationCode: string | null;
  txHash: string | null;
  fulfillTxHash: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupabaseReferral {
  id: string;
  walletAddress: string;
  code: string;
  totalUses: number;
  totalEarned: number;
  createdAt: string;
  updatedAt: string;
}

export interface InsertOrderPayload {
  orderId: string;
  buyerWallet: string;
  platform: string;
  planDuration: string;
  amountUSDC: number;
  userHandle: string;
  email?: string | null;
  promoCode?: string | null;
  referralCode?: string | null;
  txHash?: string | null;
  chainId?: number | null;
}

/**
 * Insert a new order directly into Supabase from the frontend.
 * Uses INSERT with onConflict DO UPDATE so retries are safe.
 * Called immediately after receiving the on-chain tx hash.
 *
 * Column names match the Prisma schema exactly (@@map("orders")):
 *   id (cuid auto), orderId, buyerWallet, platform, planDuration,
 *   amountUSDC, amount, chainId, userHandle, promoCode, referralCode,
 *   status, activationCode, txHash, fulfillTxHash, fulfilledAt,
 *   createdAt (auto), updatedAt (auto)
 *
 * NOTE: status is a Postgres enum (OrderStatus). PostgREST accepts
 * plain string values — 'PENDING', 'DELIVERED', 'REFUNDED'.
 */
export async function insertOrder(payload: InsertOrderPayload): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) {
    const msg = '[supabase] insertOrder: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing';
    console.error(msg);
    throw new Error(msg);
  }

  const walletLower = payload.buyerWallet.toLowerCase();
  const row = {
    // id: Prisma's @default(cuid()) is JS-side only — Postgres has no cuid() function.
    // Must supply the value explicitly when inserting via PostgREST / Supabase JS client.
    id:           crypto.randomUUID(),
    orderId:      payload.orderId,
    buyerWallet:  walletLower,
    platform:     payload.platform,
    planDuration: payload.planDuration,
    amountUSDC:   payload.amountUSDC,
    amount:       payload.amountUSDC,   // mirrors amountUSDC per schema
    userHandle:   payload.userHandle,
    email:        payload.email        ?? null,
    promoCode:    payload.promoCode    ?? null,
    referralCode: payload.referralCode ?? null,
    txHash:       payload.txHash       ?? null,
    chainId:      payload.chainId      ?? null,
    status:       'PENDING',            // Postgres enum value as string
    createdAt:    new Date().toISOString(), // always ends with 'Z' — strict UTC, avoids local-time parsing
    updatedAt:    new Date().toISOString(), // Prisma @updatedAt is JS-side only
  };

  console.log('[supabase] insertOrder → inserting row:', {
    orderId: row.orderId,
    buyerWallet: row.buyerWallet,
    platform: row.platform,
    amountUSDC: row.amountUSDC,
    txHash: row.txHash,
  });

  // Use insert (not upsert) — simpler and avoids onConflict index resolution issues.
  // On duplicate orderId the insert returns a 23505 unique-violation which we treat
  // as success (order already recorded from a prior attempt).
  const { error, status, statusText } = await supabase
    .from('orders')
    .insert(row) as unknown as {
      error: { message: string; code?: string; hint?: string; details?: string } | null;
      status: number;
      statusText: string;
    };

  if (error) {
    // 23505 = unique_violation — orderId already exists, treat as success
    if (error.code === '23505') {
      console.log('[supabase] insertOrder: orderId already exists — skipping duplicate insert');
      return;
    }
    const msg = [
      `[Supabase] insertOrder FAILED`,
      `HTTP ${status} ${statusText}`,
      `code: ${error.code ?? 'n/a'}`,
      `message: ${error.message}`,
      error.hint    ? `hint: ${error.hint}`       : null,
      error.details ? `details: ${error.details}` : null,
    ].filter(Boolean).join(' | ');

    console.error(msg, { status, statusText, error, row });
    throw new Error(msg);
  }

  console.log('[supabase] insertOrder OK — orderId:', payload.orderId, '| wallet:', walletLower);
}

/**
 * Fetch all orders for a wallet address directly from Supabase.
 * Table: "orders" (@@map in Prisma schema — lowercase, unambiguous).
 * Bypasses the Hono server — safe to call from Netlify static hosting.
 */
export async function fetchOrdersByWallet(wallet: string): Promise<SupabaseOrder[]> {
  if (!supabaseUrl || !supabaseAnonKey) {
    const msg = '[Supabase] Missing credentials: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set.';
    console.warn(msg);
    throw new Error(msg);
  }

  const walletLower = wallet.toLowerCase();
  const walletChecksum = wallet; // keep original for fallback
  console.log('[supabase] fetchOrdersByWallet → querying table "orders" for wallet:', walletLower);

  type QueryResult = { data: unknown[] | null; error: { message: string; details?: string; hint?: string; code?: string } | null; status: number; statusText: string };
  let result: QueryResult;
  try {
    // Primary: exact match on lowercased wallet (all new inserts use lowercase)
    // Fallback merge: also fetch checksummed variant to catch any legacy rows
    const [resLower, resChecksum] = await Promise.all([
      supabase.from('orders').select('*').eq('buyerWallet', walletLower).order('createdAt', { ascending: false }),
      walletChecksum !== walletLower
        ? supabase.from('orders').select('*').eq('buyerWallet', walletChecksum).order('createdAt', { ascending: false })
        : Promise.resolve({ data: [], error: null, status: 200, statusText: 'OK' }),
    ]);
    // Merge and deduplicate by orderId
    const allRows = [...(resLower.data ?? []) as unknown[], ...(resChecksum.data ?? []) as unknown[]];
    const seen = new Set<string>();
    const merged = allRows.filter((r) => {
      const key = (r as Record<string, string>).orderId?.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    result = {
      data: merged,
      error: resLower.error ?? resChecksum.error ?? null,
      status: resLower.status ?? 200,
      statusText: resLower.statusText ?? 'OK',
    };
  } catch (networkErr) {
    const msg = `[Supabase] Network error: ${networkErr instanceof Error ? networkErr.message : String(networkErr)}`;
    console.error(msg);
    throw new Error(msg);
  }

  const { data, error, status, statusText } = result;

  if (error) {
    const msg = `[Supabase] Query failed — HTTP ${status} ${statusText} | code: ${error.code ?? 'n/a'} | ${error.message}${error.hint ? ` | hint: ${error.hint}` : ''}${error.details ? ` | details: ${error.details}` : ''}`;
    console.error('[supabase] fetchOrdersByWallet FAILED', {
      status, statusText,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      wallet: walletLower,
    });
    throw new Error(msg);
  }

  console.log('[supabase] fetchOrdersByWallet OK — rows returned:', data?.length ?? 0);
  return (data ?? []) as SupabaseOrder[];
}

/**
 * Fetch referral record for a wallet address directly from Supabase.
 * Table: "referrals" (@@map in Prisma schema — lowercase, unambiguous).
 */
export async function fetchReferralByWallet(wallet: string): Promise<SupabaseReferral | null> {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[supabase] fetchReferralByWallet: credentials missing, returning null');
    return null;
  }

  const walletLower = wallet.toLowerCase();
  console.log('[supabase] fetchReferralByWallet → querying table "referrals" for wallet:', walletLower);

  type RefResult = { data: unknown; error: { message: string; details?: string; hint?: string; code?: string } | null; status: number; statusText: string };
  const { data, error, status, statusText } = await supabase
    .from('referrals')
    .select('*')
    .eq('walletAddress', walletLower)
    .maybeSingle() as unknown as RefResult;

  if (error) {
    console.error('[supabase] fetchReferralByWallet FAILED', {
      status,
      statusText,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      wallet: walletLower,
    });
    return null;
  }

  console.log('[supabase] fetchReferralByWallet OK — found:', data !== null);
  return data as SupabaseReferral | null;
}

// ── Admin helpers (direct Supabase — no Hono server needed) ──────────────────

export interface SupabaseInventory {
  id: string;
  platform: string;
  duration: string;
  codeOrLink: string;
  isUsed: boolean;
  usedForOrder: string | null;
  createdAt: string;
}

/** Fetch all orders for the admin panel, newest first. */
export async function adminFetchOrders(statusFilter?: string): Promise<SupabaseOrder[]> {
  let q = supabase.from('orders').select('*').order('createdAt', { ascending: false });
  if (statusFilter && statusFilter !== 'ALL') {
    q = q.eq('status', statusFilter);
  }
  const { data, error } = await q as unknown as {
    data: SupabaseOrder[] | null;
    error: { message: string; code?: string } | null;
  };
  if (error) {
    console.error('[supabase] adminFetchOrders FAILED:', error.message, error);
    throw new Error(error.message);
  }
  // Null-safe defaults so the UI never crashes on missing fields
  return (data ?? []).map((o) => ({
    ...o,
    promoCode:     o.promoCode     ?? null,
    activationCode: o.activationCode ?? null,
    txHash:        o.txHash        ?? null,
    fulfillTxHash: o.fulfillTxHash ?? null,
    fulfilledAt:   o.fulfilledAt   ?? null,
  }));
}

/**
 * Mark an order as DELIVERED with an activation code.
 * @param fulfillTxHash - on-chain tx hash from fulfillOrder() — stored and displayed in the admin panel.
 *   Only written after the on-chain tx is confirmed; omit or pass undefined for DB-only mode.
 */
export async function adminFulfillOrder(
  orderId: string,
  activationCode: string,
  fulfillTxHash?: string,
): Promise<void> {
  const update: Record<string, unknown> = {
    status:        'DELIVERED',
    activationCode,
    fulfilledAt:   new Date().toISOString(),
    updatedAt:     new Date().toISOString(),
  };
  if (fulfillTxHash) {
    update.fulfillTxHash = fulfillTxHash;
  }
  const { error } = await supabase
    .from('orders')
    .update(update)
    .eq('orderId', orderId) as unknown as { error: { message: string } | null };
  if (error) {
    console.error('[supabase] adminFulfillOrder FAILED:', error.message);
    throw new Error(error.message);
  }
}

/** Mark an order as REFUNDED. */
export async function adminRefundOrder(orderId: string): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ status: 'REFUNDED', updatedAt: new Date().toISOString() })
    .eq('orderId', orderId) as unknown as { error: { message: string } | null };
  if (error) {
    console.error('[supabase] adminRefundOrder FAILED:', error.message);
    throw new Error(error.message);
  }
}

/** Fetch inventory stock. */
export async function adminFetchInventory(opts?: {
  platform?: string; duration?: string; onlyAvailable?: boolean;
}): Promise<SupabaseInventory[]> {
  let q = supabase.from('inventory').select('*').order('createdAt', { ascending: false });
  if (opts?.platform)      q = q.eq('platform', opts.platform);
  if (opts?.duration)      q = q.eq('duration', opts.duration);
  if (opts?.onlyAvailable) q = q.eq('isUsed', false);
  const { data, error } = await q as unknown as {
    data: SupabaseInventory[] | null;
    error: { message: string } | null;
  };
  if (error) {
    console.error('[supabase] adminFetchInventory FAILED:', error.message);
    throw new Error(error.message);
  }
  return data ?? [];
}

/** Deposit new activation codes into inventory. */
export async function adminDepositCodes(
  platform: string, duration: string, codes: string[],
): Promise<number> {
  const rows = codes.map((c) => ({
    id:        crypto.randomUUID(),
    platform,
    duration,
    codeOrLink: c,
    isUsed:    false,
    updatedAt: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('inventory')
    .insert(rows) as unknown as { error: { message: string } | null };
  if (error) {
    console.error('[supabase] adminDepositCodes FAILED:', error.message);
    throw new Error(error.message);
  }
  return rows.length;
}

/** Delete an inventory item by id. */
export async function adminDeleteInventory(id: string): Promise<void> {
  const { error } = await supabase
    .from('inventory')
    .delete()
    .eq('id', id) as unknown as { error: { message: string } | null };
  if (error) {
    console.error('[supabase] adminDeleteInventory FAILED:', error.message);
    throw new Error(error.message);
  }
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export interface SupabaseReview {
  id: string;
  productId: string;
  orderId: string;
  buyerAddress: string;
  rating: number;
  comment: string;
  isVerified: boolean;
  createdAt: string;
}

export interface RatingSummary {
  productId: string;
  avgRating: number;
  totalReviews: number;
}

const REVIEWS_TABLE_HINT =
  'The "reviews" table does not exist yet. ' +
  'Run the migration SQL in your Supabase dashboard: ' +
  'https://supabase.com/dashboard/project/gphrbquqmwrgxedwinvd/sql — ' +
  'copy the contents of docs/reviews-migration.sql and press Run.';

/** Insert a new review. One review per orderId (enforced by UNIQUE constraint). */
export async function insertReview(payload: {
  productId: string;
  orderId: string;
  buyerAddress: string;
  rating: number;
  comment: string;
}): Promise<void> {
  const row = {
    id: crypto.randomUUID(),
    productId: payload.productId,
    orderId: payload.orderId,
    buyerAddress: payload.buyerAddress.toLowerCase(),
    rating: payload.rating,
    comment: payload.comment.trim(),
    isVerified: true,
    createdAt: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('reviews')
    .insert(row) as unknown as { error: { message: string; code?: string } | null };
  if (error) {
    if (error.code === '23505') {
      throw new Error('You have already reviewed this order.');
    }
    // 42P01 = undefined_table — reviews table not created yet
    if (error.code === '42P01' || error.message?.toLowerCase().includes('relation') || error.message?.toLowerCase().includes('does not exist')) {
      console.error('[supabase] insertReview: reviews table missing —', REVIEWS_TABLE_HINT);
      throw new Error('Reviews are not available yet — the store owner needs to complete setup.');
    }
    console.error('[supabase] insertReview FAILED:', error.message);
    throw new Error(error.message);
  }
}

/** Fetch all reviews for a platform product, newest first. */
export async function fetchReviewsByProduct(productId: string): Promise<SupabaseReview[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('productId', productId)
    .order('createdAt', { ascending: false })
    .limit(50) as unknown as { data: SupabaseReview[] | null; error: { message: string; code?: string } | null };
  if (error) {
    if (error.code === '42P01' || error.message?.includes('reviews')) {
      console.warn('[supabase] fetchReviewsByProduct: table missing —', REVIEWS_TABLE_HINT);
    } else {
      console.error('[supabase] fetchReviewsByProduct FAILED:', error.message);
    }
    return [];
  }
  return data ?? [];
}

/** Check if a review already exists for this orderId. */
export async function fetchReviewByOrderId(orderId: string): Promise<SupabaseReview | null> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('orderId', orderId)
    .maybeSingle() as unknown as { data: SupabaseReview | null; error: { message: string; code?: string } | null };
  if (error) {
    if (error.code !== '42P01') {
      console.error('[supabase] fetchReviewByOrderId FAILED:', error.message);
    }
    return null;
  }
  return data;
}

/**
 * Fetch aggregated avg rating + count for a list of productIds.
 * Falls back gracefully if the reviews table does not exist yet.
 */
export async function fetchRatingSummaries(
  productIds: string[],
): Promise<Record<string, RatingSummary>> {
  if (!productIds.length) return {};
  const { data, error } = await supabase
    .from('reviews')
    .select('productId, rating')
    .in('productId', productIds) as unknown as {
      data: { productId: string; rating: number }[] | null;
      error: { message: string } | null;
    };
  if (error || !data) return {};

  const agg: Record<string, { sum: number; count: number }> = {};
  for (const row of data) {
    if (!agg[row.productId]) agg[row.productId] = { sum: 0, count: 0 };
    agg[row.productId].sum += row.rating;
    agg[row.productId].count += 1;
  }
  const result: Record<string, RatingSummary> = {};
  for (const [pid, { sum, count }] of Object.entries(agg)) {
    result[pid] = {
      productId: pid,
      avgRating: Math.round((sum / count) * 10) / 10,
      totalReviews: count,
    };
  }
  return result;
}
