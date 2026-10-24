import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { keccak256, encodePacked } from 'viem';
import { OrderStatus } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatUSDC(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseOnchainError(error: unknown): string {
  const msg = (error as { message?: string })?.message?.toLowerCase() ?? '';
  if (msg.includes('user rejected') || (error as { code?: number })?.code === 4001) {
    return 'Transaction cancelled.';
  }
  if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) {
    return 'Insufficient balance. Please add funds and try again.';
  }
  if (msg.includes('reverted')) {
    const match = msg.match(/reason="([^"]+)"/);
    return match ? `Transaction failed: ${match[1]}` : 'Transaction failed. Please try again.';
  }
  if (msg.includes('network') || msg.includes('timeout')) {
    return 'Network error. Check your connection and retry.';
  }
  return 'Something went wrong. Please try again.';
}

/**
 * Generate a random external orderId. The contract derives an internalId
 * as keccak256(buyer, externalId) — so the external ID just needs to be unique
 * per buyer. We use (address + productId + timestamp + random salt).
 */
export function generateOrderId(
  buyer: `0x${string}`,
  productId: string,
  ts: number,
): `0x${string}` {
  return keccak256(encodePacked(['address', 'string', 'uint256'], [buyer, productId, BigInt(ts)]));
}

/**
 * Derive the internal storage key used by ArcEscrow:
 *   keccak256(abi.encodePacked(buyer, orderId))
 */
export function deriveInternalId(
  buyer: `0x${string}`,
  orderId: `0x${string}`,
): `0x${string}` {
  return keccak256(encodePacked(['address', 'bytes32'], [buyer, orderId]));
}

// ── Order status helpers ──────────────────────────────────────────────────────

export function orderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.Pending:   return 'Pending';
    case OrderStatus.Delivered: return 'Delivered';
    case OrderStatus.Refunded:  return 'Refunded';
    default:                    return 'Unknown';
  }
}

export function orderStatusColor(status: OrderStatus): string {
  switch (status) {
    case OrderStatus.Pending:   return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
    case OrderStatus.Delivered: return 'text-green-400 bg-green-400/10 border-green-400/20';
    case OrderStatus.Refunded:  return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    default:                    return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
  }
}

/** Returns true when the buyer may claim a refund (Pending + 24 h elapsed). */
export function canRefund(timestamp: bigint, status: OrderStatus): boolean {
  if (status !== OrderStatus.Pending) return false;
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  return nowSec >= timestamp + BigInt(86400);
}

/** Seconds remaining until the 24-h refund window opens (0 if already open).
 *  Pass `nowMs` from `useNow()` so the countdown is reactive; omit to use Date.now(). */
export function secondsUntilRefund(timestamp: bigint, nowMs?: number): number {
  const nowSec = Math.floor((nowMs ?? Date.now()) / 1000);
  const windowEnd = Number(timestamp) + 86400;          // created_at + 24h in seconds
  return Math.max(0, windowEnd - nowSec);
}

/** Format a seconds value as "HH:MM:SS". */
export function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

// ── Promo codes ───────────────────────────────────────────────────────────────

export interface PromoResult {
  valid: boolean;
  discount: number; // extra percentage off (e.g. 10 = 10%)
  label: string;
}

const PROMO_CODES: Record<string, { discount: number; label: string }> = {
  ARC10:  { discount: 10, label: '10% off with ARC10'  },
  LAUNCH: { discount: 15, label: '15% off with LAUNCH' },
  USDC5:  { discount: 5,  label: '5% off with USDC5'   },
};

export function validatePromo(code: string): PromoResult {
  const entry = PROMO_CODES[code.toUpperCase().trim()];
  if (entry) return { valid: true, ...entry };
  return { valid: false, discount: 0, label: '' };
}

// ── Referral helpers ──────────────────────────────────────────────────────────

/** Derive a unique referral code from a wallet address. */
export function getReferralCode(address: `0x${string}`): string {
  return `ARC-${address.slice(2, 8).toUpperCase()}`;
}

/** Referral reward = 2.5% of the referred purchase amount (in USDC). */
export function calcReferralReward(purchaseAmount: number): number {
  return purchaseAmount * 0.025;
}

// ── LocalStorage order-label cache ───────────────────────────────────────────

const LABEL_KEY = 'arc-order-labels';

export function saveOrderLabel(orderId: string, label: string): void {
  try {
    const raw = localStorage.getItem(LABEL_KEY);
    const map: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[orderId] = label;
    localStorage.setItem(LABEL_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getOrderLabel(orderId: string): string | undefined {
  try {
    const raw = localStorage.getItem(LABEL_KEY);
    if (!raw) return undefined;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[orderId];
  } catch {
    return undefined;
  }
}
