import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Package, RefreshCw, ChevronDown, ChevronUp,
  ExternalLink, AlertCircle, Copy, CheckCheck, Users, Gift, Star,
} from 'lucide-react';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi';
import { keccak256, encodePacked, parseAbiItem } from 'viem';
import { arcTestnet } from 'viem/chains';
import { toast } from 'sonner';
import { ConnectKitButton } from 'connectkit';
import { formatUsdc } from '@/onchain-money';
import { buildTxExplorerUrl } from '@/onchain-facts';
import { ESCROW_ADDRESS, ESCROW_ABI } from '../lib/escrow';
import {
  orderStatusLabel, orderStatusColor, canRefund,
  formatCountdown, secondsUntilRefund, getReferralCode,
  calcReferralReward, getOrderLabel, formatAddress,
} from '../lib/utils';
import { OrderStatus, type Order } from '../types';
import { PlatformIcon } from '../components/PlatformIcon';
import { PLATFORMS } from '../data/platforms';
import { ActivationCard } from '../components/ActivationCard';
import {
  fetchOrdersByWallet, fetchReferralByWallet, fetchReviewByOrderId,
  type SupabaseOrder, type SupabaseReferral,
} from '../lib/supabase';
import { ReviewModal } from '../components/ReviewModal';

type DbOrder = SupabaseOrder;
type DbReferral = Pick<SupabaseReferral, 'code' | 'totalUses' | 'totalEarned'>;

const CHAIN_ID = arcTestnet.id;

export function OrdersPage({ onNavigate, refreshKey }: { onNavigate?: (page: import('../types').Page) => void; refreshKey?: number }) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });

  const [orderIds, setOrderIds] = useState<`0x${string}`[]>([]);
  const [loadingIds, setLoadingIds] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const [dbOrders, setDbOrders] = useState<DbOrder[]>([]);
  const [dbReferral, setDbReferral] = useState<DbReferral | null>(null);

  useEffect(() => {
    if (!address) return;
    const walletLower = address.toLowerCase();
    const load = async () => {
      setLoadingIds(true);
      setFetchError('');
      try {
        const [dbRes, refRes] = await Promise.all([
          fetchOrdersByWallet(walletLower),
          fetchReferralByWallet(walletLower),
        ]);
        setDbOrders(dbRes);
        setDbReferral(refRes ? { code: refRes.code, totalUses: refRes.totalUses, totalEarned: refRes.totalEarned } : null);
        const dbIds = dbRes.map((o) => o.orderId as `0x${string}`);
        const idSet = new Set(dbIds.map((id) => id.toLowerCase()));
        setOrderIds(dbIds);

        // Background on-chain enrichment — never blocks or delays the DB results
        if (publicClient && ESCROW_ADDRESS) {
          void (async () => {
            try {
              // Use a bounded lookback (50k blocks) to avoid scanning from genesis
              const head = await publicClient.getBlockNumber().catch(() => 0n);
              const fromBlock = head > 50_000n ? head - 50_000n : 0n;
              const logs = await publicClient.getLogs({
                address: ESCROW_ADDRESS,
                event: parseAbiItem('event OrderCreated(bytes32 indexed orderId, address indexed buyer, uint256 amount)'),
                args: { buyer: address },
                fromBlock,
                toBlock: 'latest',
              });
              const onChainIds = logs.map((l) => l.args.orderId as `0x${string}`).filter(Boolean).reverse();
              const merged = [...dbIds];
              for (const id of onChainIds) {
                if (!idSet.has(id.toLowerCase())) merged.push(id);
              }
              if (merged.length !== dbIds.length) setOrderIds(merged);
            } catch { /* Silent — on-chain enrichment is best-effort */ }
          })();
        }
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : String(err));
      } finally {
        // Always clear loading — never leave skeleton stuck on screen
        setLoadingIds(false);
      }
    };
    void load();
  }, [address, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const dbMap = new Map<string, DbOrder>(dbOrders.map((o) => [o.orderId.toLowerCase(), o]));
  const referralCode = dbReferral?.code ?? (address ? getReferralCode(address) : '');
  const referralLink = address ? `${window.location.origin}?ref=${referralCode}` : '';

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="display text-3xl sm:text-4xl font-700 mb-2" style={{ letterSpacing: '-0.03em', color: '#0F172A' }}>
          My Orders
        </h1>
        <p className="text-sm" style={{ color: '#64748B' }}>
          Track your subscriptions and claim refunds if needed.
        </p>
      </motion.div>

      {!isConnected ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-10 flex flex-col items-center gap-4 text-center mb-8"
        >
          <Package size={36} style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={{ color: '#64748B' }}>Connect your wallet to view your order history</p>
          <ConnectKitButton customTheme={{ '--ck-primary-button-background': '#0EA5E9', '--ck-primary-button-hover-background': '#0284C7', '--ck-primary-button-color': '#ffffff', '--ck-body-background': '#ffffff', '--ck-body-color': '#0F172A' }} />
        </motion.div>
      ) : !ESCROW_ADDRESS ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-8 flex flex-col items-center gap-3 text-center mb-8"
        >
          <AlertCircle size={32} style={{ color: '#DC2626' }} />
          <p className="text-sm" style={{ color: '#64748B' }}>The escrow contract has not been deployed yet.</p>
        </motion.div>
      ) : fetchError ? (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass rounded-2xl p-5 mb-8 flex flex-col gap-3"
          style={{ border: '1px solid rgba(220,38,38,0.20)' }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} style={{ color: '#DC2626' }} />
            <span className="text-sm font-semibold" style={{ color: '#DC2626' }}>Failed to load orders — exact error:</span>
          </div>
          <pre className="text-xs rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-all" style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.12)', color: '#DC2626', fontFamily: 'monospace', maxHeight: '160px' }}>
            {fetchError}
          </pre>
          <p className="text-xs" style={{ color: '#64748B' }}>Check your Supabase dashboard → Table Editor → orders → RLS Policies.</p>
        </motion.div>
      ) : loadingIds ? (
        <OrdersSkeleton />
      ) : orderIds.length === 0 ? (
        <EmptyOrders onNavigate={onNavigate} />
      ) : (
        <motion.div className="flex flex-col gap-4 mb-8">
          {orderIds.map((orderId, i) => (
            <motion.div key={orderId} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <OrderCard
                orderId={orderId}
                buyer={address!}
                dbOrder={dbMap.get(orderId.toLowerCase())}
                onRefunded={() => setOrderIds((ids) => [...ids])}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {isConnected && address && (
        <ReferralDashboard address={address} referralCode={referralCode} referralLink={referralLink} dbReferral={dbReferral} />
      )}
    </div>
  );
}

function OrderCard({ orderId, buyer, dbOrder, onRefunded }: { orderId: `0x${string}`; buyer: `0x${string}`; dbOrder?: DbOrder; onRefunded: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [hasReview, setHasReview] = useState<boolean | null>(null);
  const internalId = keccak256(encodePacked(['address', 'bytes32'], [buyer, orderId]));

  const { data: rawOrder, refetch } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: 'orders',
    args: [internalId],
    chainId: CHAIN_ID,
    query: { enabled: Boolean(ESCROW_ADDRESS) },
  });

  const order: Order | undefined = rawOrder ? {
    buyer: (rawOrder as [string, bigint, bigint, number])[0] as `0x${string}`,
    amount: (rawOrder as [string, bigint, bigint, number])[1],
    timestamp: (rawOrder as [string, bigint, bigint, number])[2],
    status: (rawOrder as [string, bigint, bigint, number])[3] as OrderStatus,
  } : undefined;

  const { writeContract: claimRefund, data: refundTxHash, isPending: refundPending } = useWriteContract();
  const { isLoading: refundConfirming, isSuccess: refundSuccess } = useWaitForTransactionReceipt({ hash: refundTxHash });

  if (refundSuccess) { toast.success('Refund claimed successfully'); void refetch(); onRefunded(); }

  // Check if buyer already left a review for this order
  useEffect(() => {
    if (!dbOrder || dbOrder.status !== 'DELIVERED') return;
    fetchReviewByOrderId(orderId)
      .then((r) => setHasReview(r !== null))
      .catch(() => setHasReview(false));
  }, [orderId, dbOrder]);

  // Show DB-based card immediately — don't wait for on-chain data to resolve
  const isOnChainPending = !order || order.buyer === '0x0000000000000000000000000000000000000000';
  // Use DB status when on-chain hasn't resolved yet
  const effectiveStatus: OrderStatus = isOnChainPending
    ? (dbOrder?.status === 'DELIVERED' ? OrderStatus.Delivered : dbOrder?.status === 'REFUNDED' ? OrderStatus.Refunded : OrderStatus.Pending)
    : order.status;
  const effectiveAmount = isOnChainPending
    ? BigInt(Math.round((dbOrder?.amountUSDC ?? 0) * 1_000_000))
    : order.amount;
  const dbCreatedSecs = dbOrder?.createdAt
    ? BigInt(Math.floor(new Date(dbOrder.createdAt).getTime() / 1000))
    : BigInt(Math.floor(order?.timestamp ? Number(order.timestamp) : 0));
  const effectiveTimestamp = isOnChainPending ? dbCreatedSecs : order.timestamp;

  // If we have neither on-chain nor DB data, show a resolving skeleton
  if (isOnChainPending && !dbOrder) {
    return <div className="rounded-2xl p-5 h-20 animate-pulse" style={{ background: '#F1F5F9', border: '1px solid rgba(148,163,184,0.15)' }} />;
  }

  const productLabel = dbOrder ? `${dbOrder.platform} — ${dbOrder.planDuration}` : (getOrderLabel(orderId) ?? orderId.slice(0, 14) + '...');
  const platform = PLATFORMS.find((p) => productLabel.toLowerCase().includes(p.name.toLowerCase()));
  const statusLabel = orderStatusLabel(effectiveStatus);
  const statusClass = orderStatusColor(effectiveStatus);
  const refundable = !isOnChainPending && canRefund(effectiveTimestamp, effectiveStatus);
  const secsLeft = effectiveStatus === OrderStatus.Pending ? secondsUntilRefund(effectiveTimestamp) : 0;
  const createdDate = new Date(Number(effectiveTimestamp) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handleClaimRefund = () => {
    if (!ESCROW_ADDRESS) return;
    claimRefund({ address: ESCROW_ADDRESS, abi: ESCROW_ABI, functionName: 'requestRefund', args: [orderId], chainId: CHAIN_ID });
  };

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300 card-hover-sm"
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(20px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
        border: '1px solid rgba(255,255,255,0.60)',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.70), 0 2px 10px rgba(56,189,248,0.08)',
      }}
    >
      <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center gap-4 p-5 text-left transition-colors hover:bg-slate-50/60">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: platform ? `${platform.color}12` : 'rgba(14,165,233,0.08)' }}>
          {platform ? <PlatformIcon platformId={platform.id} size={22} color={platform.color} /> : <Package size={18} style={{ color: '#0EA5E9' }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{productLabel}</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>{createdDate}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusClass}`}>{statusLabel}</span>
          <span className="display text-sm font-700 tabular" style={{ color: '#0EA5E9' }}>{formatUsdc(effectiveAmount)} USDC</span>
          {expanded ? <ChevronUp size={16} style={{ color: '#94A3B8' }} /> : <ChevronDown size={16} style={{ color: '#94A3B8' }} />}
        </div>
      </button>

      {effectiveStatus === OrderStatus.Pending && secsLeft > 0 && !isOnChainPending && (
        <div className="px-5 pb-3 -mt-2 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
          <Clock size={12} style={{ color: '#D97706' }} />
          <span className="text-xs" style={{ color: '#D97706' }}>Refund available in</span>
          <CountdownTimer secsLeft={secsLeft} />
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="px-5 pb-5 pt-3 flex flex-col gap-3" style={{ borderTop: '1px solid rgba(148,163,184,0.12)' }}>
              <DetailRow label="Order ID" value={`${orderId.slice(0, 18)}...`} mono />
              <DetailRow label="Buyer" value={formatAddress(isOnChainPending ? (buyer ?? '0x') : order.buyer)} mono />
              <DetailRow label="Amount" value={`${formatUsdc(effectiveAmount)} USDC`} />
              {dbOrder && <DetailRow label="Delivery to" value={dbOrder.userHandle} mono />}
              {dbOrder?.promoCode && <DetailRow label="Promo used" value={dbOrder.promoCode} />}
              <DetailRow label="Created" value={createdDate} />

              {effectiveStatus === OrderStatus.Delivered && (
                <div className="mt-1 flex flex-col gap-3">
                  <ActivationCard
                    order={{ buyer: isOnChainPending ? buyer : order.buyer, amount: effectiveAmount, timestamp: effectiveTimestamp, status: effectiveStatus, orderId, deliveryData: dbOrder?.activationCode ?? '', productId: productLabel, fulfilledAt: dbOrder?.fulfilledAt ? BigInt(Math.floor(new Date(dbOrder.fulfilledAt).getTime() / 1000)) : 0n, createdAt: effectiveTimestamp }}
                    chainId={CHAIN_ID}
                  />
                  {/* Review button — only for DB orders with DELIVERED status */}
                  {dbOrder && hasReview === false && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setReviewOpen(true)}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                      style={{
                        background: 'linear-gradient(135deg, rgba(56,189,248,0.08), rgba(244,114,182,0.08))',
                        border: '1px solid rgba(56,189,248,0.22)',
                        color: '#0EA5E9',
                      }}
                    >
                      <Star size={14} />
                      Leave a Review
                    </motion.button>
                  )}
                  {hasReview === true && (
                    <div className="flex items-center justify-center gap-1.5 text-xs py-1" style={{ color: '#16A34A' }}>
                      <Star size={12} fill="#16A34A" style={{ color: '#16A34A' }} />
                      Review submitted — thank you!
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 mt-1">
                {effectiveStatus === OrderStatus.Pending && (
                  <span className="flex items-center gap-1.5 text-xs" style={{ color: '#D97706' }}>
                    <Clock size={12} />
                    {isOnChainPending ? 'Awaiting on-chain confirmation...' : secsLeft > 0 ? `Refund available in ${formatCountdown(secsLeft)}` : 'Refund window open — claim below'}
                  </span>
                )}
                {effectiveStatus === OrderStatus.Delivered && (
                  <span className="flex items-center gap-1.5 text-xs" style={{ color: '#16A34A' }}>
                    <Package size={12} />Order delivered
                  </span>
                )}
                {effectiveStatus === OrderStatus.Refunded && (
                  <span className="flex items-center gap-1.5 text-xs" style={{ color: '#0EA5E9' }}>
                    <RefreshCw size={12} />Refunded to wallet
                  </span>
                )}
              </div>

              {refundable && (
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={handleClaimRefund}
                  disabled={refundPending || refundConfirming}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.22)', color: '#0EA5E9' }}
                >
                  {refundPending || refundConfirming ? (
                    <><RefreshCw size={14} className="animate-spin" />Processing refund...</>
                  ) : (
                    <><RefreshCw size={14} />Claim Refund</>
                  )}
                </motion.button>
              )}

              {refundTxHash && (
                <a href={buildTxExplorerUrl(CHAIN_ID, refundTxHash)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs" style={{ color: '#0EA5E9' }}>
                  View refund tx <ExternalLink size={12} />
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review modal */}
      {dbOrder && (
        <ReviewModal
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          productId={dbOrder.platform.toLowerCase().replace(/\s+/g, '-')}
          productName={dbOrder.platform}
          orderId={orderId}
          buyerAddress={buyer}
          onSubmitted={() => setHasReview(true)}
        />
      )}
    </div>
  );
}

function CountdownTimer({ secsLeft: initial }: { secsLeft: number }) {
  const [secs, setSecs] = useState(initial);
  useEffect(() => {
    if (secs <= 0) return;
    const id = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secs]);
  return <span className="mono text-xs font-semibold" style={{ color: '#D97706' }}>{formatCountdown(secs)}</span>;
}

function ReferralDashboard({ address, referralCode, referralLink, dbReferral }: { address: `0x${string}`; referralCode: string; referralLink: string; dbReferral: DbReferral | null }) {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const totalUses = dbReferral?.totalUses ?? 0;
  const totalEarned = dbReferral?.totalEarned ?? 0;
  const estimatedEarnings = totalEarned > 0 ? totalEarned : calcReferralReward(9.99);

  const handleCopyCode = () => { void navigator.clipboard.writeText(referralCode); setCopied(true); toast.success('Referral code copied!'); setTimeout(() => setCopied(false), 2000); };
  const handleCopyLink = () => { void navigator.clipboard.writeText(referralLink); setCopiedLink(true); toast.success('Referral link copied!'); setTimeout(() => setCopiedLink(false), 2000); };
  void address;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
      className="rounded-2xl p-6 mt-2 card-hover-sm"
      style={{
        background: 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(24px) saturate(1.9)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.9)',
        border: '1px solid rgba(255,255,255,0.62)',
        boxShadow: '0 4px 20px rgba(56,189,248,0.08), 0 2px 12px rgba(244,114,182,0.06), inset 0 1px 1px rgba(255,255,255,0.75)',
      }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(14,165,233,0.10)' }}>
          <Users size={20} style={{ color: '#0EA5E9' }} />
        </div>
        <div>
          <h2 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Referral Program</h2>
          <p className="text-xs" style={{ color: '#64748B' }}>Earn 2.5% USDC for every friend who purchases</p>
        </div>
        <div className="ml-auto px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5" style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A' }}>
          <Gift size={11} />Active
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Your Code', value: referralCode, mono: true },
          { label: 'Referrals', value: totalUses > 0 ? `${totalUses} friend${totalUses !== 1 ? 's' : ''}` : '—', mono: false },
          { label: totalEarned > 0 ? 'Total Earned' : 'Example Reward', value: `${estimatedEarnings.toFixed(4)} USDC`, mono: false },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl p-3 flex flex-col gap-1 text-center" style={{ background: '#F8FAFC', border: '1px solid rgba(148,163,184,0.18)' }}>
            <p className="text-xs" style={{ color: '#94A3B8' }}>{stat.label}</p>
            <p className={`text-sm font-semibold ${stat.mono ? 'mono' : ''}`} style={{ color: stat.label === 'Your Code' ? '#0EA5E9' : '#0F172A' }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-3">
        <div className="flex-1 flex items-center px-3 py-2.5 rounded-xl mono text-sm" style={{ background: '#F8FAFC', border: '1px solid rgba(14,165,233,0.18)', color: '#0EA5E9' }}>
          {referralCode}
        </div>
        <button
          onClick={handleCopyCode}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          style={{ background: copied ? 'rgba(22,163,74,0.08)' : 'rgba(14,165,233,0.08)', border: copied ? '1px solid rgba(22,163,74,0.22)' : '1px solid rgba(14,165,233,0.20)', color: copied ? '#16A34A' : '#0EA5E9' }}
        >
          {copied ? <CheckCheck size={13} /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <button
        onClick={handleCopyLink}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
        style={{ background: copiedLink ? 'rgba(22,163,74,0.06)' : 'rgba(14,165,233,0.06)', border: copiedLink ? '1px solid rgba(22,163,74,0.20)' : '1px solid rgba(14,165,233,0.18)', color: copiedLink ? '#16A34A' : '#0EA5E9' }}
      >
        {copiedLink ? <CheckCheck size={15} /> : <Copy size={15} />}
        {copiedLink ? 'Link copied!' : 'Copy referral link'}
      </button>

      <p className="text-xs mt-3 text-center" style={{ color: '#94A3B8' }}>
        Referral rewards are credited when your friend's order is confirmed.
      </p>
    </motion.div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-xs gap-4">
      <span style={{ color: '#94A3B8' }}>{label}</span>
      <span className={`text-right ${mono ? 'mono' : ''}`} style={{ color: '#0F172A' }}>{value}</span>
    </div>
  );
}

function EmptyOrders({ onNavigate }: { onNavigate?: (page: import('../types').Page) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl p-12 flex flex-col items-center gap-5 text-center mb-8 overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.80)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(56,189,248,0.12)',
        boxShadow: '0 4px 24px rgba(56,189,248,0.08), inset 0 1px 1px rgba(255,255,255,0.80)',
      }}
    >
      {/* Ambient orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
        <div style={{ position:'absolute', top:'-30%', left:'-10%', width:'50%', height:'80%', background:'radial-gradient(ellipse,rgba(56,189,248,0.12) 0%,transparent 70%)', filter:'blur(32px)' }} />
        <div style={{ position:'absolute', bottom:'-30%', right:'-10%', width:'50%', height:'80%', background:'radial-gradient(ellipse,rgba(244,114,182,0.10) 0%,transparent 70%)', filter:'blur(32px)' }} />
      </div>
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center relative" style={{ background: 'linear-gradient(135deg,rgba(56,189,248,0.12),rgba(244,114,182,0.10))', border: '1px solid rgba(56,189,248,0.20)' }}>
        <Package size={32} style={{ color: '#38BDF8' }} />
      </div>
      <div className="relative">
        <h3 className="font-semibold text-lg mb-1" style={{ color: '#0F172A' }}>No active orders yet</h3>
        <p className="text-sm max-w-xs" style={{ color: '#64748B' }}>
          You haven't placed any orders. Browse the store and purchase a premium subscription using USDC.
        </p>
      </div>
      {onNavigate && (
        <motion.button
          whileHover={{ scale: 1.02, translateY: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onNavigate('catalog')}
          className="relative px-8 py-3 rounded-xl text-sm font-semibold text-white"
          style={{
            background: 'linear-gradient(135deg, #38BDF8, #0EA5E9, #F472B6)',
            boxShadow: '0 8px 24px rgba(56,189,248,0.28)',
          }}
        >
          Browse the Store
        </motion.button>
      )}
    </motion.div>
  );
}

function OrdersSkeleton() {
  return (
    <div className="flex flex-col gap-4 mb-8">
      {/* Spinner row */}
      <div className="flex items-center justify-center gap-3 py-4">
        <div
          className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: 'rgba(56,189,248,0.20)', borderTopColor: '#38BDF8' }}
        />
        <span className="text-sm" style={{ color: '#64748B' }}>Loading your orders…</span>
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl p-5 h-20 animate-pulse"
          style={{
            background: 'rgba(241,245,249,0.80)',
            border: '1px solid rgba(148,163,184,0.15)',
            opacity: 1 - i * 0.22,
          }}
        />
      ))}
    </div>
  );
}
