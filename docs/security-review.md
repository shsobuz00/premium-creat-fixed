# Premium Create — Pre-Mainnet Security Audit Report

**Date:** October 22, 2026  
**Audited by:** Arc Studio (Slither static analysis + manual review)  
**Scope:** Smart contract (`ArcEscrow.sol`), frontend (`src/`), server (`server/`), env config  
**Contract:** `0x96851237595a47a5575a07bee28c801d2b2b3ee8` on Arc Testnet  
**Compiler:** Solidity 0.8.20, OpenZeppelin v5

---

## Summary

| Severity | Count | Status |
|---|---|---|
| 🔴 Critical | 0 | Clean |
| 🟠 High | 2 | Needs fix before mainnet |
| 🟡 Medium | 4 | Should fix before mainnet |
| 🔵 Low / Informational | 5 | Recommended improvements |

---

## 🔴 CRITICAL — 0 findings

No critical vulnerabilities found.  
- No unchecked external calls in critical paths  
- No integer overflow (Solidity 0.8.x has built-in checks)  
- No `selfdestruct` or `delegatecall`  
- No unprotected initializer  
- Reentrancy guard (`nonReentrant`) is applied to all state-mutating functions  

---

## 🟠 HIGH

### H-1: CEI Pattern Violation in `createOrder` — State Written After External Call

**File:** `contracts/ArcEscrow.sol` lines 33–48  
**Detected by:** Slither (`reentrancy-no-eth`)

**Issue:**
```solidity
function createOrder(bytes32 orderId, uint256 amount) external nonReentrant {
    bytes32 internalId = keccak256(abi.encodePacked(msg.sender, orderId));
    require(orders[internalId].buyer == address(0), "Order already exists");       // line 35
    require(orderBuyer[orderId] == address(0), "ArcEscrow: orderId already used"); // line 36
    require(usdcToken.transferFrom(msg.sender, address(this), amount), ...);       // line 37 ← EXTERNAL CALL
    // ↓ State written AFTER external call — violates Checks-Effects-Interactions
    orders[internalId] = Order({ ... });   // line 39
    orderBuyer[orderId] = msg.sender;      // line 45
}
```

The `nonReentrant` guard prevents actual reentrancy exploitation here, but the CEI (Checks-Effects-Interactions) pattern is violated. If the `nonReentrant` modifier were ever removed or the contract were upgraded, this would become a live reentrancy vector. Slither flags this because it compares state changes after external calls as a high-severity pattern regardless of guard presence.

**Fix — Move state writes before the `transferFrom`:**
```solidity
function createOrder(bytes32 orderId, uint256 amount) external nonReentrant {
    bytes32 internalId = keccak256(abi.encodePacked(msg.sender, orderId));
    require(orders[internalId].buyer == address(0), "Order already exists");
    require(orderBuyer[orderId] == address(0), "ArcEscrow: orderId already used");

    // EFFECTS first
    orders[internalId] = Order({
        buyer: msg.sender,
        amount: amount,
        timestamp: block.timestamp,
        status: Status.Pending
    });
    orderBuyer[orderId] = msg.sender;

    // INTERACTION last
    require(usdcToken.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");

    emit OrderCreated(orderId, msg.sender, amount);
}
```

**Risk on mainnet without fix:** Low in practice (nonReentrant blocks it), but high in principle. Fix before mainnet to be safe and to pass auditor review.

---

### H-2: Telegram Bot Token and Chat ID Exposed in Browser Bundle

**File:** `src/lib/supabase.ts` lines 19–20; `.env` lines 29–30  
**Severity:** High (key exposure, not fund risk)

**Issue:**
```ts
const TG_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const TG_CHAT_ID   = import.meta.env.VITE_TELEGRAM_CHAT_ID;
```

All `VITE_` prefixed variables are **baked into the static JS bundle** at build time and visible to anyone who opens DevTools → Sources or downloads the HF Spaces HTML. The Telegram bot token allows anyone to:
- Send messages to your chat from your bot
- Enumerate recent bot messages via `getUpdates`
- Impersonate your store notifications

**Fix for mainnet:** Move Telegram notifications to a server-side function (a free Cloudflare Worker, Vercel Edge Function, or Railway server) that holds the bot token in a non-`VITE_` env var. The frontend POSTs the order data to your function; the function sends the Telegram message.

**Interim mitigation:** Restrict the bot so it can only message one chat ID — already done by design. Rotate the token if you notice spam.

---

## 🟡 MEDIUM

### M-1: EmailJS Public Key Exposed in Browser Bundle

**File:** `src/pages/AdminPage.tsx` lines 62–65; `.env` lines 31–33  
**Issue:** `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`, and `VITE_EMAILJS_PUBLIC_KEY` are all in the browser bundle. The EmailJS "public key" is designed to be client-side visible (it's their intended model), but Service ID + Template ID together allow anyone to send emails using your EmailJS quota and from-address. A competitor or attacker could spam your 200/month quota or send phishing emails appearing to come from your store.

**Fix:** Move email delivery to a server-side function (same as Telegram). Or at minimum, enable EmailJS's "allowed origins" domain restriction in the EmailJS dashboard to only permit `sobuz00-app-....static.hf.space`.

---

### M-2: `block.timestamp` Manipulation in `requestRefund`

**File:** `contracts/ArcEscrow.sol` line 68  
**Detected by:** Slither (`timestamp`)

```solidity
require(block.timestamp > order.timestamp + 24 hours, "Timeout not reached");
```

Miners/validators can manipulate `block.timestamp` by up to ~15 seconds. This is not a material risk for a 24-hour window — a 15-second drift on an 86,400-second window is 0.017%. Not exploitable in practice, but noted for completeness.

**Fix:** No code change required for a 24-hour window. Acceptable as-is.

---

### M-3: Supabase Anon Key in Browser Bundle — RLS Not Confirmed Enabled

**File:** `src/lib/supabase.ts` lines 3–4; `.env` lines 24–25  
**Issue:** The Supabase `VITE_SUPABASE_ANON_KEY` (a `sb_publishable_*` key) is public by design, but it gives direct table access unless Row Level Security (RLS) is configured. Based on conversation history, RLS on the `orders` table was explicitly **disabled** ("RLS on orders: disabled (UNRESTRICTED)").

This means any user who knows your Supabase URL and anon key can:
- Read ALL orders from ALL wallets (wallet addresses, emails, order IDs)
- Attempt to UPDATE any order row (e.g. change `status` to `DELIVERED`)
- Read the `referrals` table for all users

**Fix — Enable RLS on all tables immediately:**
Run this in Supabase SQL Editor:
```sql
-- Orders: users can only read/insert their own orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "buyers_read_own" ON public.orders
  FOR SELECT USING (lower(buyer_wallet) = lower(current_setting('request.jwt.claims', true)::json->>'sub'));
CREATE POLICY "buyers_insert_own" ON public.orders
  FOR INSERT WITH CHECK (true); -- allow insert from anon (wallet address validated at app level)
-- Prevent client-side updates/deletes entirely (admin panel uses service role via server)
CREATE POLICY "no_client_update" ON public.orders FOR UPDATE USING (false);
CREATE POLICY "no_client_delete" ON public.orders FOR DELETE USING (false);

-- Referrals: read-only for anon
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_referrals" ON public.referrals FOR SELECT USING (true);
CREATE POLICY "no_referral_write" ON public.referrals FOR INSERT WITH CHECK (false);

-- Reviews: public read, insert allowed (app validates orderId ownership)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "insert_reviews" ON public.reviews FOR INSERT WITH CHECK (true);
```

> ⚠️ This is the most important fix before mainnet. Without RLS, your entire order database is publicly readable and writable.

---

### M-4: ABI Mismatch — `escrow.ts` Constructor Omits `_initialOwner` Param

**File:** `src/lib/escrow.ts` line 14  
**Issue:**
```ts
{
  type: 'constructor',
  inputs: [{ name: '_usdcToken', type: 'address' }],  // ← WRONG: missing _initialOwner
  stateMutability: 'nonpayable',
},
```
The deployed contract constructor is `constructor(address _usdcToken, address _initialOwner)`, but the ABI only declares one input. This doesn't affect runtime (the constructor ABI is never called after deployment), but it will cause a mismatch if any tool uses this ABI for verification or re-deployment.

**Fix:**
```ts
{
  type: 'constructor',
  inputs: [
    { name: '_usdcToken',     type: 'address' },
    { name: '_initialOwner',  type: 'address' },
  ],
  stateMutability: 'nonpayable',
},
```

---

## 🔵 LOW / INFORMATIONAL

### L-1: Solidity Version Constraint — Known Compiler Bugs

**File:** `contracts/ArcEscrow.sol` line 2  
**Detected by:** Slither (`solc-version`)  
`^0.8.20` includes three known low-severity compiler bugs (`VerbatimInvalidDeduplication`, `FullInlinerNonExpressionSplitArgumentEvaluationOrder`, `MissingSideEffectsOnSelectorAccess`). None affect this contract's code paths but good practice to lock to the latest patch.

**Fix:** Change `pragma solidity ^0.8.20;` to `pragma solidity 0.8.28;` (latest stable as of Oct 2026) and recompile.

---

### L-2: `Ownable2Step.transferOwnership` Missing Zero-Address Check

**File:** `node_modules/@openzeppelin/contracts/access/Ownable2Step.sol` line 44  
**Detected by:** Slither (`missing-zero-check`)  
OZ's `Ownable2Step.transferOwnership` allows setting `_pendingOwner = address(0)` (to cancel a pending transfer). This is intentional design but Slither flags it. No action needed — it's OZ library code.

---

### L-3: `createPublicClient` Created Inside React Component on Every Render

**File:** `src/pages/CheckoutPage.tsx` lines 59–62  
```ts
const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_RPC_URL),
});
```
This creates a new HTTP transport connection on every render cycle. Move it outside the component or use `useMemo`.

**Fix:** Move to module level (before the component function).

---

### L-4: No Input Validation on Email Field in CheckoutPage

**File:** `src/pages/CheckoutPage.tsx`  
The email field has browser-level `type="email"` validation but no server-side or regex validation before inserting into Supabase. A malformed email will silently store a bad value and delivery notifications will fail silently.

**Fix:** Add a regex check before calling `insertOrder`:
```ts
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (email && !emailRegex.test(email)) {
  toast.error('Please enter a valid email address.');
  return;
}
```

---

### L-5: `MERCHANT_PRIVATE_KEY` in `.env` — Sandbox Risk

**File:** `server/lib/onchain.ts` line 48; `.env`  
The `MERCHANT_PRIVATE_KEY` is stored in `.env` in the Arc Studio sandbox. The server is not deployed to production (Hono runs locally only), so this key is currently only used in the sandbox environment. Ensure this key is **never committed to a public git repository** and `.gitignore` covers `.env`. For mainnet, use a hardware wallet or a KMS-managed signing key rather than a raw private key in an env file.

**Check:** Confirm `.gitignore` includes `.env`:
```
cat .gitignore | grep env
```

---

## Mainnet Readiness Checklist

| Item | Status |
|---|---|
| CEI pattern in `createOrder` | ⚠️ Fix H-1 |
| Reentrancy guard on all mutating functions | ✅ Done |
| Ownable2Step (safe ownership transfer) | ✅ Done |
| Zero-address checks in constructor | ✅ Done |
| Supabase RLS enabled | ❌ Must fix (M-3) |
| Telegram token moved server-side | ⚠️ Recommended (H-2) |
| EmailJS origin restriction | ⚠️ Recommended (M-1) |
| ABI constructor mismatch fixed | ⚠️ Fix (M-4) |
| Email validation on checkout | ⚠️ Fix (L-4) |
| `publicClient` memoized | ⚠️ Fix (L-3) |
| Pragma locked to specific version | ⚠️ Fix (L-1) |
| `.env` / private key not in git | ✅ Must verify |
| Comprehensive Foundry unit tests | ✅ 37 passing |
| Contract verified on explorer | 🔲 Pending (you have the flat source) |

---

*Report generated by Arc Studio static analysis (Slither 0.10.x) + manual review. Not a substitute for a professional third-party audit before significant mainnet value is at risk.*
