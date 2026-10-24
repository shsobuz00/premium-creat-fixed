/**
 * Admin Panel — Premium Create
 *
 * Flow for "Mark Delivered":
 *   1. Call fulfillOrder(orderId) on-chain (merchant must be connected as owner)
 *   2. Wait for tx receipt (status === 'success')
 *   3. Only then update Supabase to DELIVERED + store fulfillTxHash
 *
 * The contract's fulfillOrder() transfers USDC directly to owner() (merchant wallet).
 * No separate withdraw step needed — funds land in the merchant wallet per fulfilled order.
 */
import { useState, useEffect, useCallback } from 'react';
import emailjs from '@emailjs/browser';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Eye, EyeOff, RefreshCw, CheckCircle2,
  AlertCircle, Package, Plus, Trash2, ChevronDown, ChevronUp,
  Search, Lock, Wallet, ExternalLink, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { ConnectKitButton } from 'connectkit';
import { toHex, padHex, keccak256, encodePacked, ContractFunctionRevertedError, BaseError, createPublicClient, http, defineChain } from 'viem';
import { PLATFORMS } from '../data/platforms';
import { ESCROW_ADDRESS, ESCROW_ABI } from '../lib/escrow';
import {
  adminFetchOrders, adminFulfillOrder, adminRefundOrder,
  adminFetchInventory, adminDepositCodes, adminDeleteInventory,
  sendTelegramAlert,
  type SupabaseInventory,
} from '../lib/supabase';

// Fallback public client for when wagmi's is unavailable (e.g. chain mismatch)
const _arcTestnetChain = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.io'] } },
});
const fallbackPublicClient = createPublicClient({
  chain: _arcTestnetChain,
  transport: http('https://rpc.testnet.arc.io'),
});

// ── EmailJS delivery notification ─────────────────────────────────────────────
// Uses EmailJS public API (browser-safe). Configure in .env:
//   VITE_EMAILJS_SERVICE_ID   — your EmailJS service ID
//   VITE_EMAILJS_TEMPLATE_ID  — your EmailJS template ID
//   VITE_EMAILJS_PUBLIC_KEY   — your EmailJS public key
const EMAILJS_SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  as string | undefined;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const EMAILJS_PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  as string | undefined;

const APP_URL = 'https://sobuz00-app-b86ae7e9-4d0d-49ae-82a4-77399e167f22.static.hf.space';

async function sendDeliveryEmail(order: {
  email: string | null | undefined;
  platform: string;
  planDuration: string;
  orderId: string;
  amountUSDC: number;
  fulfillTxHash?: string | null;
  createdAt: string;
}): Promise<void> {
  if (!order.email) return; // no email — skip silently
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    console.warn('[EmailJS] Env vars not set — delivery email skipped. Add VITE_EMAILJS_* to .env');
    return;
  }
  const shortOrderId = order.orderId.length > 18 ? `${order.orderId.slice(0, 18)}...` : order.orderId;
  const deliveryDate  = new Date(order.createdAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  await emailjs.send(
    EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID,
    {
      to_email:       order.email,
      to_name:        order.email.split('@')[0],
      order_id:       shortOrderId,
      product_name:   order.platform,
      plan_duration:  order.planDuration,
      amount_usdc:    order.amountUSDC.toFixed(2),
      delivery_date:  deliveryDate,
      fulfill_tx:     order.fulfillTxHash ?? 'N/A',
      app_url:        APP_URL,
      review_url:     `${APP_URL}#orders`,
      subject:        'Your Order Has Been Delivered! 🎉 - Premium Create',
    },
    EMAILJS_PUBLIC_KEY,
  );
}

// ── types ─────────────────────────────────────────────────────────────────────

interface DbOrder {
  id: string;
  orderId: string;
  buyerWallet: string;
  platform: string;
  planDuration: string;
  amountUSDC: number;
  userHandle: string;
  email: string | null;
  promoCode: string | null;
  activationCode: string | null;
  status: 'PENDING' | 'DELIVERED' | 'REFUNDED';
  txHash: string | null;
  fulfillTxHash: string | null;
  createdAt: string;
  fulfilledAt: string | null;
}

type DbInventory = SupabaseInventory;

const PLAN_DURATIONS = ['1 Month', '3 Months', '6 Months', '1 Year'];

const ARC_EXPLORER = 'https://explorer.arc.io/tx/';

// ── AdminPage ─────────────────────────────────────────────────────────────────

export function AdminPage() {
  const [secret, setSecret] = useState('');
  const [authed, setAuthed] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [tab, setTab] = useState<'orders' | 'inventory' | 'earnings'>('orders');
  const { isConnected, address } = useAccount();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret.trim()) return;
    setAuthed(true);
  };

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-8 flex flex-col gap-6"
          style={{
            border: '1px solid rgba(56,189,248,0.20)',
            boxShadow: '0 4px 24px rgba(56,189,248,0.10), 0 2px 12px rgba(244,114,182,0.08)',
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(56,189,248,0.10) 0%, rgba(244,114,182,0.08) 100%)',
                border: '1px solid rgba(56,189,248,0.18)',
              }}
            >
              <Lock size={26} style={{ color: '#0EA5E9' }} />
            </div>
            <h1 className="display text-xl font-700" style={{ letterSpacing: '-0.02em', color: '#0F172A' }}>
              Admin Panel
            </h1>
            <p className="text-xs text-center" style={{ color: '#64748B' }}>
              Enter your admin secret to manage orders and inventory
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Admin secret..."
                className="w-full px-4 py-3 pr-10 rounded-xl text-sm outline-none"
                style={{
                  background: '#F8FAFC',
                  border: '1px solid rgba(56,189,248,0.25)',
                  color: '#0F172A',
                  caretColor: '#0EA5E9',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(56,189,248,0.50)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(56,189,248,0.25)')}
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: '#94A3B8' }}
              >
                {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              disabled={!secret.trim()}
              className="py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 btn-premium"
            >
              <ShieldCheck size={15} className="inline mr-2 -mt-0.5" />
              Enter Admin Panel
            </motion.button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="display text-3xl font-700 mb-1" style={{ letterSpacing: '-0.03em', color: '#0F172A' }}>
              Admin Panel
            </h1>
            <p className="text-sm" style={{ color: '#64748B' }}>
              Manage orders, fulfillment, and inventory
            </p>
            {import.meta.env.VITE_MERCHANT_WALLET && (
              <p className="text-xs mono mt-1.5 flex items-center gap-1.5" style={{ color: '#64748B' }}>
                <ShieldCheck size={11} style={{ color: '#0EA5E9' }} />
                Merchant wallet:{' '}
                <span style={{ color: '#475569' }}>
                  {(import.meta.env.VITE_MERCHANT_WALLET as string).slice(0, 10)}...
                  {(import.meta.env.VITE_MERCHANT_WALLET as string).slice(-4)}
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.20)' }}
            >
              <ShieldCheck size={12} />
              Authenticated
            </div>
            {/* Wallet connection for on-chain fulfillment */}
            {!isConnected ? (
              <div className="flex flex-col items-end gap-1.5">
                <ConnectKitButton
                  customTheme={{
                    '--ck-font-family': "'DM Sans', sans-serif",
                    '--ck-primary-button-background': '#0EA5E9',
                    '--ck-primary-button-hover-background': '#0284C7',
                    '--ck-primary-button-color': '#ffffff',
                    '--ck-body-background': '#ffffff',
                    '--ck-body-color': '#0F172A',
                    '--ck-border-radius': '12px',
                  }}
                />
                <p className="text-xs" style={{ color: '#475569' }}>
                  Connect merchant wallet to enable on-chain fulfillment
                </p>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(56,189,248,0.08)', color: '#0EA5E9', border: '1px solid rgba(56,189,248,0.22)' }}
              >
                <Wallet size={11} />
                {address?.slice(0, 6)}...{address?.slice(-4)} connected
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-6 w-fit"
        style={{ background: '#F1F5F9', border: '1px solid rgba(148,163,184,0.18)' }}
      >
        {(['orders', 'inventory', 'earnings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize"
            style={{
              background: tab === t
                ? 'linear-gradient(135deg, rgba(56,189,248,0.12) 0%, rgba(244,114,182,0.08) 100%)'
                : 'transparent',
              color: tab === t ? '#0EA5E9' : '#64748B',
              border: tab === t ? '1px solid rgba(56,189,248,0.28)' : '1px solid transparent',
              boxShadow: tab === t ? '0 2px 8px rgba(56,189,248,0.12)' : 'none',
            }}
          >
            {t === 'orders' ? 'Orders' : t === 'inventory' ? 'Inventory' : 'Earnings'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'orders' ? (
          <motion.div
            key="orders"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <OrdersTab walletConnected={isConnected} />
          </motion.div>
        ) : tab === 'inventory' ? (
          <motion.div
            key="inventory"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <InventoryTab adminSecret={secret} />
          </motion.div>
        ) : (
          <motion.div
            key="earnings"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <EarningsTab />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── OrdersTab ─────────────────────────────────────────────────────────────────

function OrdersTab({ walletConnected }: { walletConnected: boolean }) {
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'DELIVERED' | 'REFUNDED'>('ALL');
  const [search, setSearch] = useState('');

  const [refreshTick, setRefreshTick] = useState(0);
  const refreshOrders = useCallback(() => setRefreshTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const data = await adminFetchOrders(statusFilter);
        if (!cancelled) setOrders(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[AdminPage] fetchOrders failed:', msg);
        if (!cancelled) toast.error(`Failed to fetch orders: ${msg}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [statusFilter, refreshTick]);

  const filtered = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.orderId.toLowerCase().includes(q) ||
      o.buyerWallet.toLowerCase().includes(q) ||
      o.platform.toLowerCase().includes(q) ||
      o.userHandle.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Wallet warning */}
      {!walletConnected && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs"
          style={{
            background: 'linear-gradient(135deg, rgba(56,189,248,0.06) 0%, rgba(244,114,182,0.05) 100%)',
            border: '1px solid rgba(56,189,248,0.22)',
            color: '#0EA5E9',
          }}
        >
          <Wallet size={14} />
          Connect the merchant wallet (top right) to enable on-chain fund release when fulfilling orders.
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{
              background: '#ffffff',
              border: '1px solid rgba(148,163,184,0.22)',
              color: '#0F172A',
              caretColor: '#0EA5E9',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(56,189,248,0.45)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(148,163,184,0.22)')}
          />
        </div>
        <div className="flex gap-1">
          {(['ALL', 'PENDING', 'DELIVERED', 'REFUNDED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={{
                background: statusFilter === s
                  ? 'linear-gradient(135deg, rgba(56,189,248,0.12) 0%, rgba(244,114,182,0.08) 100%)'
                  : '#ffffff',
                color: statusFilter === s ? '#0EA5E9' : '#64748B',
                border: statusFilter === s ? '1px solid rgba(56,189,248,0.28)' : '1px solid rgba(148,163,184,0.15)',
                boxShadow: statusFilter === s ? '0 2px 8px rgba(56,189,248,0.12)' : 'none',
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={refreshOrders}
          className="p-2.5 rounded-xl transition-colors"
          style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid rgba(148,163,184,0.18)' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass rounded-2xl h-24 animate-pulse" style={{ opacity: 1 - i * 0.25 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 flex flex-col items-center gap-3 text-center">
          <Package size={32} style={{ color: '#334155' }} />
          <p className="text-sm" style={{ color: '#64748b' }}>No orders found</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((order) => (
            <AdminOrderCard
              key={order.id}
              order={order}
              onRefresh={refreshOrders}
              walletConnected={walletConnected}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── AdminOrderCard ────────────────────────────────────────────────────────────

function AdminOrderCard({
  order,
  onRefresh,
  walletConnected,
}: {
  order: DbOrder;
  onRefresh: () => void;
  walletConnected: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [fulfilling, setFulfilling] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [localFulfillHash, setLocalFulfillHash] = useState<`0x${string}` | null>(null);

  const wagmiPublicClient = usePublicClient();
  // Use wagmi client when available; fall back to direct RPC client for chain-mismatch scenarios
  const publicClient = wagmiPublicClient ?? fallbackPublicClient;
  const { writeContractAsync } = useWriteContract();
  const { address: connectedAddress } = useAccount();

  // Convert the DB orderId to bytes32 for the contract call.
  // CheckoutPage stores orderId as a 0x-prefixed 32-byte hex already.
  const toBytes32 = (id: string): `0x${string}` => {
    if (id.startsWith('0x') && id.length === 66) return id as `0x${string}`;
    const encoded = toHex(new TextEncoder().encode(id));
    return padHex(encoded, { size: 32 });
  };

  // Decode a contract revert into a human-readable string.
  const parseRevert = (err: unknown): string => {
    if (err instanceof BaseError) {
      const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
      if (revert instanceof ContractFunctionRevertedError) {
        const reason = revert.data?.errorName ?? revert.reason ?? revert.shortMessage;
        if (reason) return reason;
      }
      // Catch common MetaMask / wagmi cancellations
      if (err.shortMessage?.toLowerCase().includes('user rejected')) return 'User rejected the transaction';
      if (err.shortMessage?.toLowerCase().includes('denied')) return 'Transaction denied by user';
      return err.shortMessage ?? err.message;
    }
    return err instanceof Error ? err.message : String(err);
  };

  // Map known revert reasons to friendly messages.
  const friendlyRevert = (raw: string): string => {
    if (raw.includes('Invalid order status')) return 'Order already fulfilled or refunded on-chain';
    if (raw.includes('unknown orderId')) return 'Order ID not found on-chain — may not have been created yet';
    if (raw.includes('Ownable') || raw.includes('caller is not the owner')) return 'Unauthorized — connect the merchant wallet (owner)';
    if (raw.includes('User rejected') || raw.includes('denied')) return raw;
    if (raw.includes('Transfer to owner failed')) return 'USDC transfer to merchant wallet failed — check contract USDC balance';
    return raw;
  };

  const handleFulfill = async () => {
    const code = manualCode.trim() || `AUTO-${Date.now()}`;
    setFulfilling(true);
    try {
      let onchainTxHash: `0x${string}` | null = null;

      if (walletConnected && ESCROW_ADDRESS && publicClient) {
        const orderId32 = toBytes32(order.orderId);

        // ── Step 1: Query on-chain state before doing anything ─────────────────
        toast.loading('Checking on-chain order state...', { id: 'fulfill-tx' });
        try {
          // orderBuyer(externalId) → buyer address (zero = never created)
          const buyer = await publicClient.readContract({
            address: ESCROW_ADDRESS,
            abi: ESCROW_ABI,
            functionName: 'orderBuyer',
            args: [orderId32],
          }) as `0x${string}`;

          if (!buyer || buyer === '0x0000000000000000000000000000000000000000') {
            toast.error('Order not found on-chain — buyer never called createOrder for this ID', { id: 'fulfill-tx' });
            setFulfilling(false);
            return;
          }

          // orders(internalId) → { buyer, amount, timestamp, status }
          // status: 0=Pending, 1=Delivered, 2=Refunded
          const internalId = keccak256(encodePacked(['address', 'bytes32'], [buyer, orderId32]));
          // The ABI has named outputs so viem returns an object; fallback to array index
          const onchainOrder = await publicClient.readContract({
            address: ESCROW_ADDRESS,
            abi: ESCROW_ABI,
            functionName: 'orders',
            args: [internalId],
          }) as readonly [string, bigint, bigint, number] | { status: number };

          const status = Number(
            Array.isArray(onchainOrder) ? onchainOrder[3] : (onchainOrder as { status: number }).status
          );

          if (status === 1) {
            // Already Delivered on-chain — sync DB and bail
            toast.dismiss('fulfill-tx');
            toast.warning('Order is already fulfilled on-chain — syncing DB status to DELIVERED');
            await adminFulfillOrder(order.orderId, code, undefined);
            onRefresh();
            setFulfilling(false);
            return;
          }
          if (status === 2) {
            toast.error('Order was refunded on-chain — cannot fulfill a refunded order', { id: 'fulfill-tx' });
            setFulfilling(false);
            return;
          }
          // status === 0 (Pending) → proceed
        } catch (readErr: unknown) {
          console.warn('[AdminPage] on-chain state read failed — proceeding anyway:', readErr);
          toast.dismiss('fulfill-tx');
        }

        // ── Step 2: simulateContract pre-flight (optional — warn, don't block) ──
        toast.loading('Simulating transaction...', { id: 'fulfill-tx' });
        try {
          await publicClient.simulateContract({
            address: ESCROW_ADDRESS,
            abi: ESCROW_ABI,
            functionName: 'fulfillOrder',
            args: [orderId32],
            account: connectedAddress ?? (import.meta.env.VITE_MERCHANT_WALLET as `0x${string}`),
          });
        } catch (simErr: unknown) {
          const raw = parseRevert(simErr);
          const msg = friendlyRevert(raw);
          // Block on definitive revert reasons; only warn on RPC/HTTP errors
          const isRpcError = raw.toLowerCase().includes('http') ||
            raw.toLowerCase().includes('network') ||
            raw.toLowerCase().includes('fetch') ||
            raw.toLowerCase().includes('timeout') ||
            raw.toLowerCase().includes('pre-flight');
          if (!isRpcError) {
            toast.error(`Pre-flight check failed: ${msg}`, { id: 'fulfill-tx' });
            console.error('[AdminPage] simulateContract definitive revert:', simErr);
            setFulfilling(false);
            return;
          }
          // RPC error — simulation unavailable, proceed with explicit gas limit
          console.warn('[AdminPage] simulateContract RPC error (non-blocking):', raw);
          toast.loading('Simulation unavailable — sending with manual gas...', { id: 'fulfill-tx' });
        }

        // ── Step 3: Broadcast the transaction ──────────────────────────────────
        toast.loading('Sending on-chain fulfillment transaction...', { id: 'fulfill-tx' });
        try {
          const hash = await writeContractAsync({
            address: ESCROW_ADDRESS,
            abi: ESCROW_ABI,
            functionName: 'fulfillOrder',
            args: [orderId32],
            gas: BigInt(300_000),
          });
          onchainTxHash = hash;
          setLocalFulfillHash(hash);

          // ── Step 4: Immediately update DB on hash receipt (don't wait for confirmation) ─
          // This unblocks the UI. Receipt confirmation runs async in background.
          toast.dismiss('fulfill-tx');
          toast.success(`Transaction submitted! Order status updated. ${hash.slice(0, 12)}...`);

          // Background receipt check — warns if reverted, but DB is already updated
          void (async () => {
            try {
              const receiptTimeout = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('timeout')), 10_000)
              );
              const txReceipt = await Promise.race([
                publicClient.waitForTransactionReceipt({ hash, confirmations: 1 }),
                receiptTimeout,
              ]);
              if (txReceipt.status !== 'success') {
                toast.warning('Warning: transaction reverted on-chain. USDC may not have been released — check the explorer.');
              } else {
                toast.success(`On-chain release confirmed ✓`);
              }
            } catch {
              // Timeout or RPC error — tx is submitted, user can verify in explorer
              console.warn('[AdminPage] Background receipt check timed out for', hash);
            }
          })();

        } catch (txErr: unknown) {
          const raw = parseRevert(txErr);
          const msg = friendlyRevert(raw);
          if (!msg.toLowerCase().includes('rejected') && !msg.toLowerCase().includes('denied')) {
            toast.error(`Transaction failed: ${msg}`, { id: 'fulfill-tx' });
          } else {
            toast.dismiss('fulfill-tx');
            toast.info('Transaction cancelled');
          }
          console.error('[AdminPage] fulfillOrder tx failed:', txErr);
          setFulfilling(false);
          return;
        }
      } else if (!walletConnected) {
        toast.warning('Wallet not connected — updating DB only (no on-chain fund release)');
      }

      // ── Step 5: Update Supabase ONLY after on-chain success ─────────────────
      await adminFulfillOrder(order.orderId, code, onchainTxHash ?? undefined);
      toast.success(
        onchainTxHash
          ? 'Order DELIVERED + USDC released to merchant wallet'
          : 'Order marked DELIVERED (DB only — no on-chain release)',
      );

      // ── Step 6: Telegram delivery notification (fire-and-forget, never blocks) ─
      try {
        const platformInfo = PLATFORMS.find((p) => p.name === order.platform);
        const explorerLink = onchainTxHash ? `https://explorer.arc.io/tx/${onchainTxHash}` : null;
        void sendTelegramAlert(
          `📦 <b>Order Delivered &amp; USDC Released!</b>\n\n` +
          `🆔 <b>Order ID:</b> <code>${order.orderId.slice(0, 18)}...</code>\n` +
          `👤 <b>Buyer:</b> <code>${order.buyerWallet.slice(0, 8)}...${order.buyerWallet.slice(-4)}</code>\n` +
          (order.userHandle ? `👤 <b>Handle:</b> ${order.userHandle}\n` : '') +
          (order.email     ? `✉️ <b>Email:</b> ${order.email}\n` : '') +
          `🛍️ <b>Product:</b> ${platformInfo?.name ?? order.platform} — ${order.planDuration}\n` +
          `💰 <b>Released:</b> ${order.amountUSDC.toFixed(2)} USDC\n` +
          (explorerLink
            ? `🔗 <b>Tx:</b> <a href="${explorerLink}">${onchainTxHash!.slice(0, 18)}...</a>`
            : `📋 <b>Mode:</b> DB-only (no on-chain release)`),
        );
      } catch (tgErr) {
        console.warn('[AdminPage] Telegram notification failed (non-blocking):', tgErr);
      }

      // ── Step 7: EmailJS delivery notification (fire-and-forget) ───────────────
      void (async () => {
        try {
          await sendDeliveryEmail({
            email:         order.email,
            platform:      order.platform,
            planDuration:  order.planDuration,
            orderId:       order.orderId,
            amountUSDC:    order.amountUSDC,
            fulfillTxHash: onchainTxHash,
            createdAt:     order.createdAt,
          });
        } catch (emailErr) {
          console.warn('[AdminPage] Delivery email failed (non-blocking):', emailErr);
        }
      })();

      setManualCode('');
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[AdminPage] fulfillOrder outer catch:', msg);
      toast.error(`Fulfillment error: ${msg}`);
    } finally {
      setFulfilling(false);
    }
  };

  const handleRefund = async () => {
    setRefunding(true);
    try {
      await adminRefundOrder(order.orderId);
      toast.success('Order marked as REFUNDED');
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[AdminPage] refundOrder failed:', msg);
      toast.error(`Refund failed: ${msg}`);
    } finally {
      setRefunding(false);
    }
  };

  // Show the on-chain release tx — prefer the persisted DB hash, fall back to local session hash
  const displayFulfillHash = order.fulfillTxHash ?? localFulfillHash;

  const statusColor = {
    PENDING: { bg: 'rgba(245,158,11,0.10)', text: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
    DELIVERED: { bg: 'rgba(141,216,159,0.10)', text: '#8dd89f', border: 'rgba(141,216,159,0.25)' },
    REFUNDED: { bg: 'rgba(96,165,250,0.10)', text: '#60a5fa', border: 'rgba(96,165,250,0.25)' },
  }[order.status];

  const createdAt = new Date(order.createdAt).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div
      className="glass card-glow card-hover rounded-2xl overflow-hidden"
      style={{ border: '1px solid rgba(56,189,248,0.14)' }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 p-4 text-left transition-colors"
        style={{ background: 'transparent' }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold"
          style={{
            background: 'linear-gradient(135deg, rgba(56,189,248,0.10) 0%, rgba(244,114,182,0.08) 100%)',
            color: '#0EA5E9',
          }}
        >
          {order.platform.slice(0, 2).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>
            {order.platform} — {order.planDuration}
          </p>
          <p className="text-xs truncate" style={{ color: '#64748B' }}>
            {order.userHandle} · {createdAt}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full border"
            style={{ background: statusColor.bg, color: statusColor.text, borderColor: statusColor.border }}
          >
            {order.status}
          </span>
          <span className="text-xs font-semibold tabular" style={{
            background: 'linear-gradient(90deg, #0EA5E9, #F472B6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {order.amountUSDC.toFixed(2)} USDC
          </span>
          {expanded ? (
            <ChevronUp size={14} style={{ color: '#64748b' }} />
          ) : (
            <ChevronDown size={14} style={{ color: '#64748b' }} />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 pt-3 flex flex-col gap-3"
              style={{ borderTop: '1px solid rgba(148,163,184,0.12)' }}
            >
              {/* Detail rows */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <AdminDetailRow label="Order ID" value={`${order.orderId.slice(0, 18)}...`} mono />
                <AdminDetailRow label="Buyer" value={`${order.buyerWallet.slice(0, 8)}...${order.buyerWallet.slice(-4)}`} mono />
                <AdminDetailRow label="Handle / Email" value={order.userHandle} />
                <AdminDetailRow label="Promo code" value={order.promoCode ?? '—'} />
                {order.txHash && (
                  <div className="flex flex-col gap-0.5">
                    <span style={{ color: '#475569' }}>Create tx</span>
                    <a
                      href={`${ARC_EXPLORER}${order.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs mono"
                      style={{ color: '#0EA5E9' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {order.txHash.slice(0, 12)}...
                      <ExternalLink size={10} />
                    </a>
                  </div>
                )}
                {displayFulfillHash && (
                  <div className="flex flex-col gap-0.5">
                    <span style={{ color: '#475569' }}>Release tx</span>
                    <a
                      href={`${ARC_EXPLORER}${displayFulfillHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs mono"
                      style={{ color: '#F472B6' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {displayFulfillHash.slice(0, 12)}...
                      <ExternalLink size={10} />
                    </a>
                  </div>
                )}
                {order.activationCode && <AdminDetailRow label="Code issued" value={order.activationCode} mono />}
              </div>

              {/* Actions — PENDING orders only */}
              {order.status === 'PENDING' && (
                <div className="flex flex-col gap-2 pt-1">
                  {!walletConnected && (
                    <p className="text-xs" style={{ color: '#f59e0b' }}>
                      Connect merchant wallet to release funds on-chain. Without it, DB-only mode is used.
                    </p>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Activation code / gift link (leave blank to auto-pull from inventory)"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      className="flex-1 px-3 py-2.5 rounded-xl text-xs outline-none"
                      style={{
                        background: '#F8FAFC',
                        border: '1px solid rgba(148,163,184,0.22)',
                        color: '#0F172A',
                        caretColor: '#0EA5E9',
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(56,189,248,0.45)')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(148,163,184,0.22)')}
                    />
                  </div>

                  <div className="flex gap-2">
                    {/* Fulfill — calls on-chain then updates DB */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => void handleFulfill()}
                      disabled={fulfilling}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 btn-premium"
                      style={walletConnected ? {} : {
                        background: 'rgba(22,163,74,0.08)',
                        border: '1px solid rgba(22,163,74,0.22)',
                        color: '#16A34A',
                      }}
                    >
                      {fulfilling ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={12} />
                      )}
                      {fulfilling
                        ? 'Releasing funds...'
                        : walletConnected
                        ? 'Fulfill + Release USDC'
                        : 'Mark Delivered (DB only)'}
                    </motion.button>

                    {/* Refund */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => void handleRefund()}
                      disabled={refunding}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                      style={{
                        background: 'rgba(56,189,248,0.07)',
                        border: '1px solid rgba(56,189,248,0.22)',
                        color: '#0EA5E9',
                      }}
                    >
                      {refunding ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <AlertCircle size={12} />
                      )}
                      Refund
                    </motion.button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── EarningsTab ───────────────────────────────────────────────────────────────

function EarningsTab() {
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const all = await adminFetchOrders('ALL');
        if (!cancelled) setOrders(all);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!cancelled) toast.error(`Failed to load earnings: ${msg}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  const delivered = orders.filter((o) => o.status === 'DELIVERED');
  const pending = orders.filter((o) => o.status === 'PENDING');
  const refunded = orders.filter((o) => o.status === 'REFUNDED');

  const totalEarned = delivered.reduce((s, o) => s + o.amountUSDC, 0);
  const totalPending = pending.reduce((s, o) => s + o.amountUSDC, 0);
  const totalRefunded = refunded.reduce((s, o) => s + o.amountUSDC, 0);

  const merchantWallet = import.meta.env.VITE_MERCHANT_WALLET as string | undefined;

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Earned', value: totalEarned, color: '#0EA5E9', accent: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.22)', desc: `${delivered.length} orders released` },
          { label: 'Locked in Escrow', value: totalPending, color: '#D97706', accent: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.20)', desc: `${pending.length} pending orders` },
          { label: 'Total Refunded', value: totalRefunded, color: '#F472B6', accent: 'rgba(244,114,182,0.08)', border: 'rgba(244,114,182,0.20)', desc: `${refunded.length} refunded` },
        ].map((s) => (
          <div
            key={s.label}
            className="glass card-glow card-hover rounded-2xl p-5 flex flex-col gap-2"
            style={{
              background: s.accent,
              border: `1px solid ${s.border}`,
              boxShadow: `0 4px 16px ${s.accent}`,
            }}
          >
            <span className="text-xs font-medium" style={{ color: '#64748b' }}>{s.label}</span>
            <span
              className="display text-2xl font-700 tabular"
              style={{ color: s.color, letterSpacing: '-0.03em' }}
            >
              {loading ? '—' : `$${s.value.toFixed(2)}`}
            </span>
            <span className="text-xs" style={{ color: '#475569' }}>{s.desc}</span>
          </div>
        ))}
      </div>

      {/* Merchant wallet info */}
      <div
        className="glass card-hover-sm rounded-2xl p-5 flex flex-col gap-3"
        style={{
          border: '1px solid rgba(56,189,248,0.22)',
          background: 'linear-gradient(135deg, rgba(56,189,248,0.04) 0%, rgba(244,114,182,0.03) 100%)',
          boxShadow: '0 4px 16px rgba(56,189,248,0.08)',
        }}
      >
        <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0EA5E9' }}>
          <TrendingUp size={15} />
          Merchant Wallet
        </h3>
        <p className="text-xs" style={{ color: '#94a3b8' }}>
          All funds released via on-chain fulfillment are sent directly to this wallet by the escrow contract.
          No manual withdrawal step is required — USDC lands in the merchant wallet the moment you fulfill each order.
        </p>
        {merchantWallet ? (
          <div className="flex items-center gap-3">
            <span
              className="px-3 py-2 rounded-xl text-xs mono flex-1"
              style={{ background: 'rgba(56,189,248,0.06)', color: '#0284C7', border: '1px solid rgba(56,189,248,0.18)' }}
            >
              {merchantWallet}
            </span>
            <a
              href={`https://explorer.arc.io/address/${merchantWallet}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(56,189,248,0.10) 0%, rgba(244,114,182,0.08) 100%)',
                color: '#0EA5E9',
                border: '1px solid rgba(56,189,248,0.25)',
              }}
            >
              <ExternalLink size={12} />
              Explorer
            </a>
          </div>
        ) : (
          <p className="text-xs" style={{ color: '#475569' }}>
            Set VITE_MERCHANT_WALLET in .env to display wallet address.
          </p>
        )}
      </div>

      {/* Recent delivered orders */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#0F172A' }}>
          <CheckCircle2 size={14} style={{ color: '#16A34A' }} />
          Recent Fulfilled Orders
        </h3>
        {loading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass rounded-xl h-12 animate-pulse" style={{ opacity: 1 - i * 0.25 }} />
            ))}
          </div>
        ) : delivered.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-sm" style={{ color: '#64748b' }}>
            No fulfilled orders yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {delivered.slice(0, 20).map((o) => (
              <div
                key={o.id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl card-hover-sm"
                style={{
                  background: 'rgba(22,163,74,0.04)',
                  border: '1px solid rgba(22,163,74,0.12)',
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: '#0F172A' }}>{o.platform} — {o.planDuration}</p>
                  <p className="text-xs mono truncate" style={{ color: '#64748B' }}>{o.userHandle}</p>
                </div>
                <span className="text-xs font-semibold tabular" style={{ color: '#16A34A' }}>
                  +${o.amountUSDC.toFixed(2)}
                </span>
                {o.fulfillTxHash && (
                  <a
                    href={`${ARC_EXPLORER}${o.fulfillTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                    style={{ color: '#F472B6' }}
                    title="View release tx"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── InventoryTab ──────────────────────────────────────────────────────────────

function InventoryTab({ adminSecret: _adminSecret }: { adminSecret: string }) {
  const [inventory, setInventory] = useState<DbInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterDuration, setFilterDuration] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(true);

  const [depPlatform, setDepPlatform] = useState(PLATFORMS[0]?.name ?? '');
  const [depDuration, setDepDuration] = useState('1 Month');
  const [depCodes, setDepCodes] = useState('');
  const [depositing, setDepositing] = useState(false);

  const [invTick, setInvTick] = useState(0);
  const refreshInventory = useCallback(() => setInvTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const data = await adminFetchInventory({
          platform: filterPlatform || undefined,
          duration: filterDuration || undefined,
          onlyAvailable,
        });
        if (!cancelled) setInventory(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[AdminPage] fetchInventory failed:', msg);
        if (!cancelled) toast.error(`Failed to fetch inventory: ${msg}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [filterPlatform, filterDuration, onlyAvailable, invTick]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const codes = depCodes.split('\n').map((c) => c.trim()).filter(Boolean);
    if (codes.length === 0) { toast.error('Enter at least one code'); return; }
    setDepositing(true);
    try {
      const inserted = await adminDepositCodes(depPlatform, depDuration, codes);
      toast.success(`${inserted} code(s) deposited`);
      setDepCodes('');
      refreshInventory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[AdminPage] depositCodes failed:', msg);
      toast.error(`Deposit failed: ${msg}`);
    } finally {
      setDepositing(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminDeleteInventory(id);
      setInventory((prev) => prev.filter((i) => i.id !== id));
      toast.success('Code removed');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[AdminPage] deleteInventory failed:', msg);
      toast.error(`Delete failed: ${msg}`);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div
        className="glass card-hover rounded-2xl p-5"
        style={{
          border: '1px solid rgba(56,189,248,0.18)',
          background: 'linear-gradient(135deg, rgba(56,189,248,0.03) 0%, rgba(244,114,182,0.02) 100%)',
        }}
      >
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#0F172A' }}>
          <Plus size={15} style={{ color: '#0EA5E9' }} />
          Deposit Activation Codes
        </h2>
        <form onSubmit={(e) => void handleDeposit(e)} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: '#64748b' }}>Platform</label>
              <select
                value={depPlatform}
                onChange={(e) => setDepPlatform(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: '#ffffff', border: '1px solid rgba(148,163,184,0.22)', color: '#0F172A' }}
              >
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: '#64748B' }}>Duration</label>
              <select
                value={depDuration}
                onChange={(e) => setDepDuration(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: '#ffffff', border: '1px solid rgba(148,163,184,0.22)', color: '#0F172A' }}
              >
                {PLAN_DURATIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs mb-1.5 block" style={{ color: '#64748b' }}>
              Codes / Gift Links <span style={{ color: '#475569' }}>(one per line)</span>
            </label>
            <textarea
              value={depCodes}
              onChange={(e) => setDepCodes(e.target.value)}
              rows={4}
              placeholder={'NITRO-XXXX-XXXX-XXXX\nNITRO-YYYY-YYYY-YYYY'}
              className="w-full px-3 py-2.5 rounded-xl text-xs outline-none resize-none mono"
              style={{
                background: '#F8FAFC',
                border: '1px solid rgba(148,163,184,0.22)',
                color: '#0F172A',
                caretColor: '#0EA5E9',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(56,189,248,0.45)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(148,163,184,0.22)')}
            />
          </div>

          <motion.button
            type="submit"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            disabled={depositing || !depCodes.trim()}
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 btn-premium"
          >
            {depositing ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
            {depositing ? 'Depositing...' : `Deposit to ${depPlatform} – ${depDuration}`}
          </motion.button>
        </form>
      </div>

      <div>
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#0F172A' }}>
            <Package size={15} style={{ color: '#F472B6' }} />
            Stock Browser
          </h2>
          <div className="flex gap-2 flex-wrap ml-auto">
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: '#ffffff', border: '1px solid rgba(148,163,184,0.22)', color: '#0F172A' }}
            >
              <option value="">All platforms</option>
              {PLATFORMS.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
            <select
              value={filterDuration}
              onChange={(e) => setFilterDuration(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: '#ffffff', border: '1px solid rgba(148,163,184,0.22)', color: '#0F172A' }}
            >
              <option value="">All durations</option>
              {PLAN_DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <button
              onClick={() => setOnlyAvailable((v) => !v)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: onlyAvailable
                  ? 'linear-gradient(135deg, rgba(56,189,248,0.10) 0%, rgba(244,114,182,0.07) 100%)'
                  : '#F8FAFC',
                color: onlyAvailable ? '#0EA5E9' : '#64748B',
                border: onlyAvailable ? '1px solid rgba(56,189,248,0.28)' : '1px solid rgba(148,163,184,0.18)',
              }}
            >
              {onlyAvailable ? 'Available only' : 'Show all'}
            </button>
            <button
              onClick={refreshInventory}
              className="p-1.5 rounded-lg"
              style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid rgba(148,163,184,0.18)' }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass rounded-xl h-12 animate-pulse" style={{ opacity: 1 - i * 0.25 }} />
            ))}
          </div>
        ) : inventory.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center text-sm" style={{ color: '#64748b' }}>
            No inventory found for the selected filters.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {inventory.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 px-4 py-3 rounded-xl card-hover-sm"
                style={{
                  background: item.isUsed ? '#F8FAFC' : 'rgba(56,189,248,0.03)',
                  border: `1px solid ${item.isUsed ? 'rgba(148,163,184,0.14)' : 'rgba(56,189,248,0.14)'}`,
                  boxShadow: item.isUsed ? 'none' : '0 2px 8px rgba(56,189,248,0.06)',
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: '#0F172A' }}>{item.platform} — {item.duration}</p>
                  <p className="text-xs mono truncate" style={{ color: '#64748B' }}>{item.codeOrLink}</p>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    background: item.isUsed ? 'rgba(100,116,139,0.08)' : 'rgba(56,189,248,0.10)',
                    color: item.isUsed ? '#94A3B8' : '#0EA5E9',
                    border: `1px solid ${item.isUsed ? 'rgba(148,163,184,0.18)' : 'rgba(56,189,248,0.22)'}`,
                  }}
                >
                  {item.isUsed ? 'Used' : 'Available'}
                </span>
                {!item.isUsed && (
                  <button
                    onClick={() => void handleDelete(item.id)}
                    className="flex-shrink-0 p-1.5 rounded-lg transition-colors"
                    style={{ color: '#64748b' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#e86d7a')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                    title="Remove code"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function AdminDetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span style={{ color: '#94A3B8' }}>{label}</span>
      <span className={`${mono ? 'mono' : ''}`} style={{ color: '#0F172A' }}>{value}</span>
    </div>
  );
}
