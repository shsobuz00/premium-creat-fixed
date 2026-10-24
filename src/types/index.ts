export type Page = 'home' | 'catalog' | 'plan' | 'checkout' | 'orders' | 'refund' | 'support' | 'admin';

export type Category = 'all' | 'social' | 'gaming' | 'streaming';

export interface Platform {
  id: string;
  name: string;
  tagline: string;
  category: Category;
  basePrice: number; // in USDC (e.g. 4.99)
  color: string;     // accent hex
  icon: string;      // lucide icon name or custom
  badge?: 'hot' | 'popular' | 'new'; // optional featured badge
}

export interface Plan {
  id: string;
  label: string;
  months: number;
  discount: number; // 0-20 percent
}

export interface OrderSummary {
  platform: Platform;
  plan: Plan;
  deliveryTarget: string;
  originalPrice: number;
  discountedPrice: number;
  promoCode?: string;
  promoDiscount?: number; // extra % off from promo
  referralCode?: string;
  referralCredit?: number; // USDC credit amount
}

// Mirrors ArcEscrow.Status enum: Pending=0, Delivered=1, Refunded=2
export enum OrderStatus {
  Pending = 0,
  Delivered = 1,
  Refunded = 2,
}

// Mirrors ArcEscrow.Order struct
export interface Order {
  buyer: `0x${string}`;
  amount: bigint;
  timestamp: bigint;
  status: OrderStatus;
}

// Event-sourced order record (enriched client-side from logs)
export interface OrderRecord {
  orderId: `0x${string}`;       // external orderId from OrderCreated event
  internalId: `0x${string}`;    // keccak256(buyer, orderId) — contract key
  buyer: `0x${string}`;
  amount: bigint;
  timestamp: bigint;
  status: OrderStatus;
  deliveryData?: string;         // from OrderFulfilled (not in contract storage)
  productLabel?: string;         // stored off-chain via localStorage keyed by orderId
}
