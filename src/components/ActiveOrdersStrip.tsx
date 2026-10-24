/**
 * ActiveOrdersStrip — shown on the Dashboard Home.
 * Fetches the user's 5 most recent orders from on-chain events and displays live status badges.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle2, RefreshCw, Package, AlertCircle, ChevronRight } from 'lucide-react';
import { useAccount, useReadContract, usePublicClient } from 'wagmi';
import { keccak256, encodePacked, parseAbiItem } from 'viem';
import { fetchOrdersByWallet } from '../lib/supabase';
import { arcTestnet } from 'viem/chains';
import { ConnectKitButton } from 'connectkit';
import { formatUsdc } from '@/onchain-money';
import { ESCROW_ADDRESS, ESCROW_ABI } from '../lib/escrow';
import { canRefund, getOrderLabel } from '../lib/utils';
import { PlatformIcon } from './PlatformIcon';
import { PLATFORMS } from '../data/platforms';
import { OrderStatus, type Order } from '../types';
import type { Page } from '../types';

const CHAIN_ID = arcTestnet.id;

const STATUS_META: Record<
  OrderStatus,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  [OrderStatus.Pending]: {
    label: 'PENDING',
    color: '#D97706',
    bg: 'rgba(217,119,6,0.08)',
    icon: Clock,
  },
  [OrderStatus.Delivered]: {
    label: 'DELIVERED',
    color: '#16A34A',
    bg: 'rgba(22,163,74,0.08)',
    icon: CheckCircle2,
  },
  [OrderStatus.Refunded]: {
    label: 'REFUNDED',
    color: '#0EA5E9',
    bg: 'rgba(14,165,233,0.08)',
    icon: RefreshCw,
  },
};

interface ActiveOrdersStripProps {
  onNavigate: (page: Page) => void;
}

export function ActiveOrdersStrip({ onNavigate }: ActiveOrdersStripProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });

  const [orderIds, setOrderIds] = useState<`0x${string}`[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address || !ESCROW_ADDRESS) return;
    const load = async () => {
      setLoading(true);
      try {
        const dbOrders = await fetchOrdersByWallet(address);
        const dbIds = dbOrders.map((o) => o.orderId as `0x${string}`).slice(0, 5);
        const idSet = new Set(dbIds.map((id) => id.toLowerCase()));
        setOrderIds(dbIds);

        if (publicClient) {
          void (async () => {
            try {
              const logs = await publicClient.getLogs({
                address: ESCROW_ADDRESS as `0x${string}`,
                event: parseAbiItem(
                  'event OrderCreated(bytes32 indexed orderId, address indexed buyer, uint256 amount)',
                ),
                args: { buyer: address },
                fromBlock: 1000n,
                toBlock: 'latest',
              });
              const onChainIds = logs
                .map((l) => l.args.orderId as `0x${string}`)
                .filter(Boolean)
                .reverse();
              const merged = [...dbIds];
              for (const id of onChainIds) {
                if (!idSet.has(id.toLowerCase())) merged.push(id);
              }
              const trimmed = merged.slice(0, 5);
              if (trimmed.length !== dbIds.length) setOrderIds(trimmed);
            } catch {
              // Silent — pruned history expected
            }
          })();
        }
      } catch {
        setOrderIds([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [address, publicClient]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="display text-base font-700" style={{ letterSpacing: '-0.02em', color: '#0F172A' }}>
          Active Orders
        </h2>
        {isConnected && orderIds.length > 0 && (
          <button
            onClick={() => onNavigate('orders')}
            className="flex items-center gap-1 text-xs font-medium transition-colors"
            style={{ color: '#0EA5E9' }}
          >
            View all
            <ChevronRight size={13} />
          </button>
        )}
      </div>

      {!isConnected ? (
        <div
          className="glass rounded-2xl p-6 flex flex-col items-center gap-3 text-center"
        >
          <Package size={28} style={{ color: '#CBD5E1' }} />
          <p className="text-xs" style={{ color: '#94A3B8' }}>Connect wallet to view your orders</p>
          <ConnectKitButton
            customTheme={{
              '--ck-primary-button-background': '#0EA5E9',
              '--ck-primary-button-hover-background': '#0284C7',
              '--ck-primary-button-color': '#ffffff',
              '--ck-body-background': '#ffffff',
              '--ck-body-color': '#0F172A',
            }}
          />
        </div>
      ) : !ESCROW_ADDRESS ? (
        <div
          className="glass rounded-2xl p-5 flex items-center gap-3"
          style={{ border: '1px solid rgba(220,38,38,0.15)' }}
        >
          <AlertCircle size={18} style={{ color: '#DC2626' }} />
          <p className="text-xs" style={{ color: '#64748B' }}>Escrow contract not deployed</p>
        </div>
      ) : loading ? (
        <OrdersStripSkeleton />
      ) : orderIds.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass rounded-2xl p-6 flex flex-col items-center gap-3 text-center"
        >
          <Package size={28} style={{ color: '#CBD5E1' }} />
          <p className="text-xs" style={{ color: '#94A3B8' }}>No orders yet</p>
          <button
            onClick={() => onNavigate('catalog')}
            className="text-xs font-medium transition-colors"
            style={{ color: '#0EA5E9' }}
          >
            Browse the store
          </button>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence>
            {orderIds.map((orderId, i) => (
              <motion.div
                key={orderId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <OrderRow orderId={orderId} buyer={address!} onNavigate={onNavigate} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function OrderRow({
  orderId,
  buyer,
  onNavigate,
}: {
  orderId: `0x${string}`;
  buyer: `0x${string}`;
  onNavigate: (page: Page) => void;
}) {
  const internalId = keccak256(encodePacked(['address', 'bytes32'], [buyer, orderId]));

  const { data: rawOrder } = useReadContract({
    address: ESCROW_ADDRESS,
    abi: ESCROW_ABI,
    functionName: 'orders',
    args: [internalId],
    chainId: CHAIN_ID,
    query: { enabled: Boolean(ESCROW_ADDRESS) },
  });

  const order: Order | undefined = rawOrder
    ? {
        buyer: (rawOrder as [string, bigint, bigint, number])[0] as `0x${string}`,
        amount: (rawOrder as [string, bigint, bigint, number])[1],
        timestamp: (rawOrder as [string, bigint, bigint, number])[2],
        status: (rawOrder as [string, bigint, bigint, number])[3] as OrderStatus,
      }
    : undefined;

  if (!order || order.buyer === '0x0000000000000000000000000000000000000000') {
    return (
      <div className="h-14 rounded-xl animate-pulse" style={{ background: '#F1F5F9' }} />
    );
  }

  const productLabel = getOrderLabel(orderId);
  const platform = productLabel
    ? PLATFORMS.find((p) => productLabel.toLowerCase().includes(p.name.toLowerCase()))
    : undefined;

  const meta = STATUS_META[order.status] ?? STATUS_META[OrderStatus.Pending];
  const StatusIcon = meta.icon;
  const isRefundable = canRefund(order.timestamp, order.status);
  const amountStr = formatUsdc(order.amount);
  const createdDate = new Date(Number(order.timestamp) * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <motion.button
      whileHover={{ y: -3, scale: 1.01, boxShadow: '0 12px 24px -8px rgba(56,189,248,0.22), 0 6px 14px -6px rgba(244,114,182,0.18)', borderColor: 'rgba(56,189,248,0.35)' }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onNavigate('orders')}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.55)',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.65)',
      }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: platform ? `${platform.color}12` : 'rgba(14,165,233,0.08)' }}
      >
        {platform ? (
          <PlatformIcon platformId={platform.id} size={19} color={platform.color} />
        ) : (
          <Package size={16} style={{ color: '#0EA5E9' }} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: '#0F172A' }}>
          {productLabel ?? orderId.slice(0, 14) + '...'}
        </p>
        <p className="text-xs" style={{ color: '#94A3B8' }}>
          {createdDate} · {amountStr} USDC
          {isRefundable && (
            <span className="ml-1.5 font-medium" style={{ color: '#0EA5E9' }}>
              · Refundable
            </span>
          )}
        </p>
      </div>

      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
        style={{ background: meta.bg, color: meta.color }}
      >
        <StatusIcon size={10} />
        {meta.label}
      </div>
    </motion.button>
  );
}

function OrdersStripSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-14 rounded-xl animate-pulse"
          style={{ background: '#F1F5F9', opacity: 1 - i * 0.25 }}
        />
      ))}
    </div>
  );
}
