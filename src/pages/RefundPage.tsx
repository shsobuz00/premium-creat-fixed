import { useState, useEffect, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
} from 'wagmi';
import { keccak256, encodePacked } from 'viem';
import { fetchOrdersByWallet, type SupabaseOrder } from '../lib/supabase';
import { arcTestnet } from 'viem/chains';
import { toast } from 'sonner';
import { ConnectKitButton } from 'connectkit';
import { formatUsdc } from '@/onchain-money';
import { ESCROW_ADDRESS, ESCROW_ABI } from '../lib/escrow';
import { formatCountdown, getOrderLabel } from '../lib/utils';
import { PLATFORMS } from '../data/platforms';
import { PlatformIcon } from '../components/PlatformIcon';
import { OrderStatus, type Order } from '../types';

const CHAIN_ID = arcTestnet.id;

// Module-level 1-second clock using useSyncExternalStore — avoids setState-in-effect lint
let _nowMs = Date.now();
const _nowListeners = new Set<() => void>();
setInterval(() => { _nowMs = Date.now(); _nowListeners.forEach((l) => l()); }, 1000);
function subscribeNow(cb: () => void) { _nowListeners.add(cb); return () => { _nowListeners.delete(cb); }; }
function getNow() { return _nowMs; }
function useNow() { return useSyncExternalStore(subscribeNow, getNow, Date.now); }

export function RefundPage() {
  const { address, isConnected } = useAccount();

  // Primary: DB-fetched PENDING orders
  const [pendingDbOrders, setPendingDbOrders] = useState<SupabaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // DEV test-mode: bypass 24h window — only visible to the admin/merchant wallet
  const MERCHANT_WALLET = (import.meta.env.VITE_MERCHANT_WALLET as string | undefined) ?? '';
  const isAdmin = Boolean(address && MERCHANT_WALLET && address.toLowerCase() === MERCHANT_WALLET.toLowerCase());
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetchOrdersByWallet(address)
      .then((all) => {
        if (cancelled) return;
        const pending = all.filter((o) => o.status === 'PENDING');
        setPendingDbOrders(pending);
        setLoading(false);
        setFetchError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[RefundPage] fetch error:', msg);
        setFetchError(msg);
        setPendingDbOrders([]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [address]);

  return (
    <div className="flex flex-col gap-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="display text-2xl font-700 mb-1" style={{ letterSpacing: '-0.03em', color: '#0F172A' }}>
          Escrow Refund
        </h1>
        <p className="text-sm" style={{ color: '#64748B' }}>
          Claim refunds for pending orders older than 24 hours.
        </p>
      </motion.div>

      {/* Info card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
        className="rounded-2xl p-4 flex items-start gap-3 card-hover-sm"
        style={{ background: 'rgba(14,165,233,0.04)', border: '1px solid rgba(14,165,233,0.15)' }}
      >
        <ShieldCheck size={18} style={{ color: '#0EA5E9', flexShrink: 0, marginTop: 1 }} />
        <div className="flex-1">
          <p className="text-sm font-medium mb-1" style={{ color: '#0F172A' }}>How refunds work</p>
          <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>
            Your USDC is held in a smart contract escrow. If an order is not fulfilled within 24 hours,
            the "Claim Refund" button activates and you can withdraw the full amount directly from the contract.
          </p>
        </div>
      </motion.div>

      {/* DEV test-mode toggle — only visible to the merchant/admin wallet */}
      {isAdmin && <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
        className="flex items-center justify-between rounded-2xl px-4 py-3"
        style={{ background: testMode ? 'rgba(244,114,182,0.06)' : 'rgba(248,250,252,0.80)', border: `1px solid ${testMode ? 'rgba(244,114,182,0.25)' : 'rgba(203,213,225,0.40)'}` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: testMode ? '#F472B6' : '#94A3B8' }}>
            ⚡ Test Mode
          </span>
          <span className="text-xs" style={{ color: '#CBD5E1' }}>
            {testMode ? 'Bypass 24h — Claim Refund button is active instantly' : 'Skip 24h countdown for testing'}
          </span>
        </div>
        <button
          onClick={() => setTestMode((v) => !v)}
          className="relative flex-shrink-0 w-10 h-5.5 rounded-full transition-all duration-300 focus:outline-none"
          style={{
            width: 40, height: 22,
            background: testMode ? 'linear-gradient(135deg,#F472B6,#38BDF8)' : '#CBD5E1',
            boxShadow: testMode ? '0 0 8px rgba(244,114,182,0.40)' : 'none',
            position: 'relative',
          }}
          aria-label="Toggle test mode"
        >
          <span
            style={{
              position: 'absolute',
              top: 3, left: testMode ? 20 : 3,
              width: 16, height: 16,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.20)',
              transition: 'left 0.25s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          />
        </button>
      </motion.div>}

      {!isConnected ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
          <Clock size={32} style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={{ color: '#64748B' }}>Connect your wallet to check eligible refunds</p>
          <ConnectKitButton customTheme={{ '--ck-primary-button-background': '#0EA5E9', '--ck-primary-button-hover-background': '#0284C7', '--ck-primary-button-color': '#ffffff', '--ck-body-background': '#ffffff', '--ck-body-color': '#0F172A' }} />
        </motion.div>
      ) : loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 rounded-2xl animate-pulse flex items-center gap-4 px-4" style={{ background: '#F1F5F9' }}>
              <div className="w-10 h-10 rounded-xl animate-pulse" style={{ background: '#E2E8F0' }} />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-3 rounded w-40 animate-pulse" style={{ background: '#E2E8F0' }} />
                <div className="h-3 rounded w-24 animate-pulse" style={{ background: '#E2E8F0' }} />
              </div>
            </div>
          ))}
          <p className="text-center text-xs mt-1" style={{ color: '#94A3B8' }}>Loading your pending orders...</p>
        </div>
      ) : fetchError ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
          <AlertCircle size={28} style={{ color: '#F87171' }} />
          <p className="text-sm font-medium" style={{ color: '#0F172A' }}>Failed to load orders</p>
          <p className="text-xs max-w-xs break-all" style={{ color: '#94A3B8' }}>{fetchError}</p>
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => { if (address) { setLoading(true); setFetchError(null); void fetchOrdersByWallet(address).then((all) => { setPendingDbOrders(all.filter((o) => o.status === 'PENDING')); setLoading(false); }).catch((e: unknown) => { setFetchError(e instanceof Error ? e.message : String(e)); setLoading(false); }); } }}
            className="px-4 py-2 rounded-xl text-xs font-semibold"
            style={{ background: 'linear-gradient(135deg,#38bdf8,#f472b6)', color: '#fff' }}
          >
            Retry
          </motion.button>
        </motion.div>
      ) : pendingDbOrders.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
          <ShieldCheck size={32} style={{ color: '#CBD5E1' }} />
          <p className="text-sm font-medium" style={{ color: '#0F172A' }}>No eligible pending orders for refund</p>
          <p className="text-xs max-w-xs" style={{ color: '#94A3B8' }}>
            All your orders have been fulfilled or refunded. Pending orders older than 24 hours become eligible for a refund.
          </p>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-3">
          {pendingDbOrders.map((dbOrder, i) => (
            <motion.div key={dbOrder.orderId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <RefundRow
                orderId={dbOrder.orderId as `0x${string}`}
                buyer={address!}
                dbOrder={dbOrder}
                testMode={testMode}
                onRefunded={() => {
                  setPendingDbOrders((prev) => prev.filter((o) => o.orderId !== dbOrder.orderId));
                }}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function RefundRow({
  orderId,
  buyer,
  dbOrder,
  testMode,
  onRefunded,
}: {
  orderId: `0x${string}`;
  buyer: `0x${string}`;
  dbOrder: SupabaseOrder;
  testMode: boolean;
  onRefunded: () => void;
}) {
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const internalId = keccak256(encodePacked(['address', 'bytes32'], [buyer, orderId]));

  // On-chain read — used for confirmation only; DB is the primary source
  const { data: rawOrder, refetch: refetchOnChain } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: 'orders',
    args: [internalId],
    chainId: CHAIN_ID,
    query: { enabled: Boolean(ESCROW_ADDRESS) },
  });

  const onChainOrder: Order | undefined = rawOrder ? {
    buyer: (rawOrder as [string, bigint, bigint, number])[0] as `0x${string}`,
    amount: (rawOrder as [string, bigint, bigint, number])[1],
    timestamp: (rawOrder as [string, bigint, bigint, number])[2],
    status: (rawOrder as [string, bigint, bigint, number])[3] as OrderStatus,
  } : undefined;

  const { writeContract: claimRefund, data: txHash, isPending } = useWriteContract();

  // Watch for tx confirmation via polling
  useEffect(() => {
    if (!txHash || !publicClient) return;
    void (async () => {
      try {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
        if (receipt.status === 'success') {
          toast.success('Refund claimed! USDC returned to your wallet.');
          void refetchOnChain();
          onRefunded();
        } else {
          toast.error('Refund transaction reverted on-chain.');
        }
      } catch {
        toast.warning('Could not confirm refund receipt — check the explorer.');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txHash]);

  // DB-derived values (always available immediately)
  const dbAmountBig = BigInt(Math.round(dbOrder.amountUSDC * 1_000_000));

  // ALL hooks must be called before any conditional return
  // 24h countdown — useNow() ticks every second, triggering re-render
  const nowMs = useNow();

  // Use on-chain when available, otherwise fall back to DB
  const hasOnChain = onChainOrder && onChainOrder.buyer !== '0x0000000000000000000000000000000000000000';
  const effectiveAmount = hasOnChain ? onChainOrder.amount : dbAmountBig;
  // If on-chain says Delivered/Refunded, skip rendering (after all hooks)
  if (hasOnChain && onChainOrder.status !== OrderStatus.Pending) return null;

  // STRICT 24-hour formula using UTC epoch ms — no timezone arithmetic.
  // Supabase sometimes returns timestamps WITHOUT the trailing 'Z' (e.g. "2026-10-18 12:00:00")
  // which browsers parse as LOCAL time instead of UTC, causing a UTC-offset discrepancy.
  // Fix: replace the space separator with 'T' and ensure the string ends with 'Z'.
  const rawCreatedAt  = dbOrder.createdAt ?? '';
  const utcCreatedAt  = rawCreatedAt.replace(' ', 'T').replace(/(\.\d+)?$/, (m) => m + (rawCreatedAt.endsWith('Z') ? '' : 'Z'));
  const createdAtMs   = new Date(utcCreatedAt).getTime();
  const targetTime   = (isNaN(createdAtMs) ? nowMs : createdAtMs) + 86_400_000;
  const timeLeftMs   = targetTime - nowMs;
  const eligible     = testMode || timeLeftMs <= 0;   // testMode bypasses 24h
  const secsRemaining = eligible ? 0 : Math.ceil(timeLeftMs / 1000);

  const productLabel = getOrderLabel(orderId) ?? `${dbOrder.platform} — ${dbOrder.planDuration}`;
  const platform = PLATFORMS.find(
    (p) => dbOrder.platform?.toLowerCase().includes(p.name.toLowerCase()) || productLabel.toLowerCase().includes(p.name.toLowerCase())
  );
  const amount = formatUsdc(effectiveAmount);

  const handleRefund = () => {
    if (!ESCROW_ADDRESS) { toast.error('Escrow contract not configured'); return; }
    if (!eligible) { toast.error('Order is not yet eligible for refund (24h window not reached)'); return; }
    claimRefund({
      address: ESCROW_ADDRESS,
      abi: ESCROW_ABI,
      functionName: 'requestRefund',
      args: [orderId],
      chainId: CHAIN_ID,
    });
  };

  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-4 card-hover-sm"
      style={{
        background: 'rgba(255,255,255,0.92)',
        border: eligible ? '1.5px solid rgba(56,189,248,0.40)' : '1px solid rgba(203,213,225,0.50)',
        boxShadow: eligible
          ? '0 4px 20px rgba(56,189,248,0.15), 0 2px 10px rgba(244,114,182,0.08)'
          : '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* Platform icon */}
      {platform ? (
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${platform.color}12` }}>
          <PlatformIcon platformId={platform.id} size={20} color={platform.color} />
        </div>
      ) : (
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(14,165,233,0.08)' }}>
          <AlertCircle size={18} style={{ color: '#0EA5E9' }} />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{productLabel}</p>
          {testMode && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
              style={{ background: 'rgba(244,114,182,0.12)', color: '#F472B6', border: '1px solid rgba(244,114,182,0.25)' }}>
              TEST
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs" style={{ color: '#64748B' }}>{amount} USDC</span>
          <span className="text-xs" style={{ color: '#CBD5E1' }}>·</span>
          {eligible ? (
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#0EA5E9' }}>
              <RefreshCw size={10} />Eligible for refund
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs" style={{ color: '#D97706' }}>
              <Clock size={10} />Available in <span className="mono font-semibold ml-0.5">{formatCountdown(secsRemaining)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Claim button */}
      <motion.button
        whileHover={eligible ? { scale: 1.04, y: -1 } : {}}
        whileTap={eligible ? { scale: 0.97 } : {}}
        onClick={eligible ? handleRefund : undefined}
        disabled={!eligible || isPending}
        className="flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
        style={{
          background: eligible
            ? 'linear-gradient(135deg, #38bdf8 0%, #f472b6 100%)'
            : '#F1F5F9',
          color: eligible ? '#ffffff' : '#94A3B8',
          border: `1px solid ${eligible ? 'transparent' : 'rgba(148,163,184,0.20)'}`,
          boxShadow: eligible ? '0 4px 12px rgba(56,189,248,0.30)' : 'none',
          cursor: eligible && !isPending ? 'pointer' : 'default',
        }}
      >
        {isPending ? (
          <span className="flex items-center gap-1.5">
            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" strokeDashoffset="8" />
            </svg>
            Processing...
          </span>
        ) : eligible ? 'Claim Refund' : 'Pending'}
      </motion.button>
    </div>
  );
}
