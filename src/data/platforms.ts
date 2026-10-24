import { type Platform, type Plan } from '../types';

// ── Per-plan pricing table ────────────────────────────────────────────────────
// All prices in USDC. Every plan price falls strictly between $5 and $20.
// Longer durations get a proportional discount baked into the flat price.
//
//  Platform                1 Month   3 Months   6 Months   1 Year
//  ─────────────────────── ──────    ────────   ────────   ──────
//  Spotify Premium          $5.00     $9.00      $12.00    $15.00 (save 20%)  niche entry price
//  Discord Nitro            $6.00    $10.00      $13.00    $16.00
//  Discord Nitro Basic      $5.00     $8.00      $10.00    $12.00
//  Telegram Premium         $5.00     $8.50      $11.00    $13.00
//  YouTube Premium          $7.00    $12.00      $16.00    $20.00
//  X Premium                $8.00    $13.00      $16.00    $18.00

export type PricingKey = `${string}-${string}`; // `${platformId}-${planId}`

export const PLAN_PRICES: Record<PricingKey, number> = {
  // Spotify Premium
  'spotify-premium-1m':  5.00,
  'spotify-premium-3m':  9.00,
  'spotify-premium-6m': 12.00,
  'spotify-premium-1y': 15.00,
  // Discord Nitro
  'discord-nitro-1m':   6.00,
  'discord-nitro-3m':  10.00,
  'discord-nitro-6m':  13.00,
  'discord-nitro-1y':  16.00,
  // Discord Nitro Basic
  'discord-nitro-basic-1m':  5.00,
  'discord-nitro-basic-3m':  8.00,
  'discord-nitro-basic-6m': 10.00,
  'discord-nitro-basic-1y': 12.00,
  // Telegram Premium
  'telegram-premium-1m':  5.00,
  'telegram-premium-3m':  8.50,
  'telegram-premium-6m': 11.00,
  'telegram-premium-1y': 13.00,
  // YouTube Premium
  'youtube-premium-1m':  7.00,
  'youtube-premium-3m': 12.00,
  'youtube-premium-6m': 16.00,
  'youtube-premium-1y': 20.00,
  // X Premium
  'x-premium-1m':  8.00,
  'x-premium-3m': 13.00,
  'x-premium-6m': 16.00,
  'x-premium-1y': 18.00,
};

/** Lookup flat plan price — falls back to basePrice × months if entry missing. */
export function getPlanPrice(platformId: string, planId: string, basePrice: number, months: number): number {
  const key: PricingKey = `${platformId}-${planId}`;
  return PLAN_PRICES[key] ?? parseFloat((basePrice * months).toFixed(2));
}

export const PLATFORMS: Platform[] = [
  {
    id: 'x-premium',
    name: 'X Premium',
    tagline: 'Blue checkmark + AI features',
    category: 'social',
    basePrice: 8.00,
    color: '#1DA1F2',
    icon: 'X',
    badge: 'hot',
  },
  {
    id: 'discord-nitro',
    name: 'Discord Nitro',
    tagline: 'Animated avatars, server boosts & more',
    category: 'gaming',
    basePrice: 6.00,
    color: '#5865F2',
    icon: 'Discord',
    badge: 'popular',
  },
  {
    id: 'discord-nitro-basic',
    name: 'Discord Nitro Basic',
    tagline: 'Emoji, stickers & profile badge',
    category: 'gaming',
    basePrice: 5.00,
    color: '#5865F2',
    icon: 'Discord',
  },
  {
    id: 'telegram-premium',
    name: 'Telegram Premium',
    tagline: 'No limits, faster downloads & exclusive features',
    category: 'social',
    basePrice: 5.00,
    color: '#229ED9',
    icon: 'Telegram',
    badge: 'popular',
  },
  {
    id: 'youtube-premium',
    name: 'YouTube Premium',
    tagline: 'Ad-free, background play & downloads',
    category: 'streaming',
    basePrice: 7.00,
    color: '#FF0000',
    icon: 'Youtube',
    badge: 'hot',
  },
  {
    id: 'spotify-premium',
    name: 'Spotify Premium',
    tagline: 'Ad-free music, offline & any quality',
    category: 'streaming',
    basePrice: 5.00,
    color: '#1DB954',
    icon: 'Spotify',
    badge: 'new',
  },
];

export const PLANS: Plan[] = [
  { id: '1m', label: '1 Month',   months: 1,  discount: 0  },
  { id: '3m', label: '3 Months',  months: 3,  discount: 5  },
  { id: '6m', label: '6 Months',  months: 6,  discount: 10 },
  { id: '1y', label: '1 Year',    months: 12, discount: 20 },
];

/**
 * Returns the flat plan price for a platform+plan pair.
 * The `discount` field on Plan is kept for display purposes only (badge label).
 * Actual savings are implied by the flat price vs. 12× the 1-month rate.
 */
export function calcPrice(platform: Platform, plan: Plan): { original: number; discounted: number } {
  const flat = getPlanPrice(platform.id, plan.id, platform.basePrice, plan.months);
  // "original" = 1-month price × months (what you'd pay without bulk discount)
  const oneMonth = getPlanPrice(platform.id, '1m', platform.basePrice, 1);
  const original = parseFloat((oneMonth * plan.months).toFixed(2));
  return { original, discounted: flat };
}
