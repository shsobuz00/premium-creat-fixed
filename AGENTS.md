# Premium Create

> Built with Arc Studio — money-powered apps in minutes

This is the **project memory** for the Premium Create dApp.

---

## What This App Does

A full-stack Web3 digital marketplace for purchasing social and streaming subscriptions
(X Premium, Discord Nitro, Telegram Premium, YouTube Premium, Spotify Premium) paid with
Arc USDC via an on-chain escrow contract.

### Key Features
- 5-page split-screen dashboard: Home, Catalog (flash sales + promo codes), Plan Selection (promo + referral credits), Checkout (2-step USDC approve + escrow), Orders (history + countdown refund timer + referral dashboard)
- Promo codes: ARC10 (10% off), LAUNCH (15% off), USDC5 (5% off)
- Referral program: unique ARC-XXXXXX code per wallet, 2.5% USDC credit
- 24-hour countdown timer on pending orders with one-click "Claim Refund" button
- Activation code reveal card (blurred, Copy Key button)

---

## Deployed Contracts

| Contract   | Address                                      | Network      | Owner | Explorer |
|------------|----------------------------------------------|--------------|-------|---------|
| ArcEscrow  | `0x96851237595a47a5575a07bee28c801d2b2b3ee8` | Arc Testnet  | `0xDA6eb5d19eA1251659437A187c16EDd4046910f7` (merchant) | [View](https://explorer.testnet.arc.io/address/0x96851237595a47a5575a07bee28c801d2b2b3ee8) |

> Previous contracts (superseded):
> ArcEscrow v1: `0x22f73644e51c721e96922808f23d858db291afd2` (owner was platform deployer)
> ArcPremiumEscrow: `0xaa1f3c8f39c0c90e4c89179f4da139cee601bb9c`

## Environment Variables

- `VITE_ESCROW_ADDRESS` — deployed ArcEscrow address (currently `0x96851237595a47a5575a07bee28c801d2b2b3ee8`)

---

## ArcEscrow Contract Summary

- **Constructor:** `constructor(address _usdcToken, address _initialOwner)` — USDC: `0x3600000000000000000000000000000000000000`, owner: `0xDA6eb5d19eA1251659437A187c16EDd4046910f7`
- **createOrder(bytes32 orderId, uint256 amount)** — buyer calls after USDC approve
- **fulfillOrder(bytes32 orderId)** — owner-only, marks Delivered, releases USDC to owner
- **requestRefund(bytes32 orderId)** — buyer calls after 24h if still Pending
- **Order storage key:** `keccak256(abi.encodePacked(buyer, orderId))` (buyer-bound)
- **Order history:** indexed via `OrderCreated(orderId indexed, buyer indexed, amount)` events
- **Security:** Ownable2Step, ReentrancyGuard, immutable usdcToken, orderId uniqueness enforced

---

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS v3, Framer Motion
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry + OpenZeppelin 5.1.0
- Chain: Arc Testnet (Chain ID: 5042002)
- Token: USDC 6-decimal at `0x3600000000000000000000000000000000000000`
- Toasts: Sonner

## Key Files

- `src/App.tsx` — split-screen layout, page routing, promo/referral prop threading
- `src/components/Sidebar.tsx` — collapsible left nav (Home, Browse Store, My Orders, Escrow Refund, Support)
- `src/components/BannerSlider.tsx` — auto-advancing featured deal banner
- `src/components/ActiveOrdersStrip.tsx` — live order status cards on dashboard home
- `src/components/ActivationCard.tsx` — blurred code reveal + Copy Key button
- `src/lib/escrow.ts` — ArcEscrow ABI + address
- `src/lib/utils.ts` — promo validation, referral helpers, countdown, order-label cache
- `src/data/platforms.ts` — platform + plan definitions
- `contracts/ArcEscrow.sol` — production escrow contract

## To Run

```bash
bun install
bun run dev
```
