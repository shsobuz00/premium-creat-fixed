/**
 * ArcEscrow contract config — matches deployed ArcEscrow.sol at Arc Testnet.
 * Deployed: 0x96851237595a47a5575a07bee28c801d2b2b3ee8
 * Owner (merchant wallet): 0xDA6eb5d19eA1251659437A187c16EDd4046910f7
 */
import type { Abi } from 'viem';

export const ESCROW_ADDRESS = import.meta.env.VITE_ESCROW_ADDRESS as `0x${string}` | undefined;

export const ESCROW_ABI: Abi = [
  // ── constructor ──────────────────────────────────────────────────────────────
  {
    type: 'constructor',
    inputs: [{ name: '_usdcToken', type: 'address' }],
    stateMutability: 'nonpayable',
  },

  // ── state-mutating functions ──────────────────────────────────────────────────
  {
    type: 'function',
    name: 'createOrder',
    inputs: [
      { name: 'orderId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'fulfillOrder',
    inputs: [{ name: 'orderId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'requestRefund',
    inputs: [{ name: 'orderId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ── view: public mapping accessor ─────────────────────────────────────────────
  // orders(internalId) => (buyer, amount, timestamp, status)
  {
    type: 'function',
    name: 'orders',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [
      { name: 'buyer', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'status', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
  // orderBuyer(externalId) => address
  {
    type: 'function',
    name: 'orderBuyer',
    inputs: [{ name: '', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  // usdcToken()
  {
    type: 'function',
    name: 'usdcToken',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  // owner()
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },

  // ── Ownable2Step ──────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [{ name: 'newOwner', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'acceptOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ── events ────────────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'OrderCreated',
    inputs: [
      { name: 'orderId', type: 'bytes32', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'OrderFulfilled',
    inputs: [{ name: 'orderId', type: 'bytes32', indexed: true }],
  },
  {
    type: 'event',
    name: 'OrderRefunded',
    inputs: [{ name: 'orderId', type: 'bytes32', indexed: true }],
  },
] as const;

/** Derive the internal storage key for an order (mirrors contract logic). */
export function deriveInternalId(buyer: `0x${string}`, orderId: `0x${string}`): `0x${string}` {
  // keccak256(abi.encodePacked(buyer, orderId))
  // We use viem's keccak256 + encodePacked at call-sites to avoid a circular
  // import — but this helper documents the convention for readers.
  // Actual usage: keccak256(encodePacked(['address','bytes32'],[buyer,orderId]))
  void buyer; void orderId;
  throw new Error('Use keccak256(encodePacked(…)) at call-sites');
}
