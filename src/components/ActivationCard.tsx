/**
 * ActivationCard — shown when an order's status is Delivered.
 * The deliveryData comes from the OrderFulfilled event (not in contract storage),
 * so it is passed in as a prop by the parent.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { PlatformIcon } from './PlatformIcon';
import { PLATFORMS } from '../data/platforms';
import { OrderStatus, type Order } from '../types';

interface ActivationCardProps {
  /** The on-chain order struct. */
  order: Order & {
    orderId: `0x${string}`;
    deliveryData?: string;   // enriched from OrderFulfilled event logs
    productId?: string;      // enriched from localStorage
    fulfilledAt?: bigint;
    createdAt?: bigint;
  };
  chainId: number;
}

export function ActivationCard({ order }: ActivationCardProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const platform = PLATFORMS.find(
    (p) => order.productId && order.productId.toLowerCase().includes(p.name.toLowerCase()),
  );

  const handleCopy = async () => {
    const code = order.deliveryData ?? '';
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Activation code copied!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy. Please copy manually.');
    }
  };

  // Only render when delivered
  if (order.status !== OrderStatus.Delivered) return null;

  const code = order.deliveryData ?? '';
  const hasCode = code.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden card-hover-sm"
      style={{
        background: 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(20px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
        border: '1px solid rgba(22,163,74,0.22)',
        boxShadow: '0 4px 16px rgba(22,163,74,0.08), 0 2px 8px rgba(56,189,248,0.08), inset 0 1px 1px rgba(255,255,255,0.75)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3.5"
        style={{ borderBottom: '1px solid rgba(141,216,159,0.10)' }}
      >
        {platform ? (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${platform.color}18` }}
          >
            <PlatformIcon platformId={platform.id} size={17} color={platform.color} />
          </div>
        ) : (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(22,163,74,0.10)' }}
          >
            <Check size={14} style={{ color: '#16A34A' }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>
            {platform?.name ?? order.productId ?? 'Premium Subscription'}
          </p>
          <p className="text-xs" style={{ color: '#16A34A' }}>
            {hasCode ? 'Activation code ready' : 'Delivered — code coming soon'}
          </p>
        </div>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{
            background: 'rgba(22,163,74,0.10)',
            color: '#16A34A',
            border: '1px solid rgba(22,163,74,0.22)',
          }}
        >
          DELIVERED
        </span>
      </div>

      {/* Code reveal */}
      <div className="px-4 py-4">
        {hasCode ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <p
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: '#64748b', letterSpacing: '0.08em' }}
              >
                Activation Code / Gift Link
              </p>
              <button
                onClick={() => setRevealed((v) => !v)}
                className="flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: '#94a3b8' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#0EA5E9')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
              >
                {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
                {revealed ? 'Hide' : 'Reveal'}
              </button>
            </div>

            <div
              className="relative rounded-xl overflow-hidden"
              style={{
                background: 'rgba(248,250,252,0.85)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(22,163,74,0.18)',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.70)',
              }}
            >
              <div className="px-4 py-3 pr-20 min-h-12 flex items-center">
                <AnimatePresence mode="wait">
                  {revealed ? (
                    <motion.p
                      key="revealed"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mono text-xs break-all leading-relaxed"
                      style={{ color: '#16A34A' }}
                    >
                      {code}
                    </motion.p>
                  ) : (
                    <motion.p
                      key="hidden"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mono text-xs select-none"
                      style={{
                        color: 'transparent',
                        textShadow: '0 0 8px rgba(56,189,248,0.45)',
                        letterSpacing: '0.12em',
                      }}
                    >
                      {'●'.repeat(Math.min(code.length, 28))}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { void handleCopy(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: copied ? 'rgba(22,163,74,0.10)' : 'rgba(56,189,248,0.10)',
                  color: copied ? '#16A34A' : '#0EA5E9',
                  border: `1px solid ${copied ? 'rgba(22,163,74,0.22)' : 'rgba(56,189,248,0.22)'}`,
                }}
              >
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.6, opacity: 0 }}
                      className="flex items-center gap-1"
                    >
                      <Check size={12} />
                      Copied
                    </motion.span>
                  ) : (
                    <motion.span
                      key="copy"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="flex items-center gap-1"
                    >
                      <Copy size={12} />
                      Copy Key
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </>
        ) : (
          <p className="text-xs text-center py-2" style={{ color: '#64748b' }}>
            Your activation code will appear here once the admin confirms delivery.
          </p>
        )}
      </div>
    </motion.div>
  );
}
