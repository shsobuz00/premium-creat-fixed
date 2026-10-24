import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ExternalLink, Sparkles, Lock } from 'lucide-react';
import { buildTxExplorerUrl } from '@/onchain-facts';
import { PlatformIcon } from './PlatformIcon';

interface CrateOpeningModalProps {
  platform: { id: string; name: string; color: string };
  planLabel: string;
  amountUsdc: string;
  txHash?: `0x${string}`;
  orderId?: `0x${string}`;
  chainId: number;
  onViewOrders: () => void;
}

type CrateState = 'locked' | 'shaking' | 'opening' | 'revealed';

// Sky/pink/violet particle burst
const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  angle: (i / 22) * 360 + Math.random() * 10,
  distance: 55 + Math.random() * 90,
  color: i % 3 === 0 ? '#38BDF8' : i % 3 === 1 ? '#F472B6' : '#A78BFA',
  size: 4 + Math.random() * 6,
  delay: Math.random() * 0.12,
}));

// ─── 3D Isometric Crate SVG ───────────────────────────────────────────────────
// Three visible faces: top (light), front (mid), right (dark) — classic isometric
function CrateSVG({ lidOpen }: { lidOpen: boolean }) {
  return (
    <svg
      width="140"
      height="140"
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Front face gradient */}
        <linearGradient id="cg-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DBEAFE" />
          <stop offset="100%" stopColor="#BFDBFE" />
        </linearGradient>
        {/* Right face gradient */}
        <linearGradient id="cg-right" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
        {/* Top face gradient — sky tint */}
        <linearGradient id="cg-top" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="100%" stopColor="#F0F9FF" />
        </linearGradient>
        {/* Strap gradient — sky→pink */}
        <linearGradient id="cg-strap" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#F472B6" stopOpacity="0.9" />
        </linearGradient>
        {/* Drop shadow */}
        <filter id="cg-shadow" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#38BDF8" floodOpacity="0.20" />
        </filter>
        {/* Lid top gradient */}
        <linearGradient id="cg-lid-top" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#BAE6FD" />
          <stop offset="100%" stopColor="#F0F9FF" />
        </linearGradient>
        {/* Lid front gradient */}
        <linearGradient id="cg-lid-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="100%" stopColor="#BAE6FD" />
        </linearGradient>
        {/* Lid right gradient */}
        <linearGradient id="cg-lid-right" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7DD3FC" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
      </defs>

      {/* ── Body group (static) ─────────────────────────────── */}
      <g filter="url(#cg-shadow)">
        {/* Front face: parallelogram */}
        <path
          d="M28 72 L28 108 L88 120 L88 84 Z"
          fill="url(#cg-front)"
          stroke="rgba(148,163,184,0.35)"
          strokeWidth="1"
        />
        {/* Right face: parallelogram */}
        <path
          d="M88 84 L88 120 L118 105 L118 69 Z"
          fill="url(#cg-right)"
          stroke="rgba(148,163,184,0.30)"
          strokeWidth="1"
        />

        {/* Front face — horizontal wooden planks (subtle lines) */}
        <line x1="28" y1="84" x2="88" y2="96" stroke="rgba(148,163,184,0.25)" strokeWidth="1" />
        <line x1="28" y1="96" x2="88" y2="108" stroke="rgba(148,163,184,0.25)" strokeWidth="1" />
        {/* Right face — planks */}
        <line x1="88" y1="96" x2="118" y2="81" stroke="rgba(148,163,184,0.20)" strokeWidth="1" />
        <line x1="88" y1="108" x2="118" y2="93" stroke="rgba(148,163,184,0.20)" strokeWidth="1" />

        {/* Front face — vertical strap */}
        <path
          d="M55 72 L55 108 L58 109 L58 73 Z"
          fill="url(#cg-strap)"
          opacity="0.70"
        />
        {/* Front face — horizontal strap */}
        <path
          d="M28 90 L88 102 L88 105 L28 93 Z"
          fill="url(#cg-strap)"
          opacity="0.70"
        />
        {/* Right face — horizontal strap */}
        <path
          d="M88 102 L118 87 L118 90 L88 105 Z"
          fill="url(#cg-strap)"
          opacity="0.60"
        />

        {/* Brand badge on front face */}
        <rect x="35" y="95" width="42" height="14" rx="4"
          fill="white" opacity="0.85"
          stroke="rgba(56,189,248,0.40)" strokeWidth="1"
        />
        <text
          x="56" y="105"
          textAnchor="middle"
          fontFamily="'DM Sans', sans-serif"
          fontSize="6.5"
          fontWeight="700"
          fill="#0EA5E9"
          letterSpacing="0.04em"
        >
          PREMIUM
        </text>
      </g>

      {/* ── Lid group — animates up when opening ────────────── */}
      <motion.g
        animate={lidOpen ? { y: -38, rotateX: -40, opacity: 0.7 } : { y: 0, rotateX: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 18, delay: 0.05 }}
        style={{ transformOrigin: '73px 72px' }}
      >
        {/* Lid top face */}
        <path
          d="M28 72 L58 56 L118 68 L88 84 Z"
          fill="url(#cg-lid-top)"
          stroke="rgba(148,163,184,0.35)"
          strokeWidth="1"
        />
        {/* Lid front face */}
        <path
          d="M28 68 L28 72 L88 84 L88 80 Z"
          fill="url(#cg-lid-front)"
          stroke="rgba(148,163,184,0.25)"
          strokeWidth="1"
        />
        {/* Lid right face */}
        <path
          d="M88 80 L88 84 L118 69 L118 65 Z"
          fill="url(#cg-lid-right)"
          stroke="rgba(148,163,184,0.25)"
          strokeWidth="1"
        />
        {/* Lid strap — front edge */}
        <path
          d="M55 66 L55 80 L58 81 L58 67 Z"
          fill="url(#cg-strap)"
          opacity="0.65"
        />
        {/* Lid strap — top surface */}
        <path
          d="M55 56 L85 62 L86 65 L55 59 Z"
          fill="url(#cg-strap)"
          opacity="0.55"
        />

        {/* Lock clasp — front of lid edge */}
        {!lidOpen && (
          <>
            <rect x="52" y="77" width="9" height="7" rx="2"
              fill="#94A3B8" stroke="rgba(148,163,184,0.50)" strokeWidth="0.8"
            />
            <path
              d="M54 77 C54 74 57 74 57 77"
              stroke="#94A3B8" strokeWidth="1.5" fill="none" strokeLinecap="round"
            />
          </>
        )}
      </motion.g>
    </svg>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function CrateOpeningModal({
  platform, planLabel, amountUsdc, txHash, orderId, chainId, onViewOrders,
}: CrateOpeningModalProps) {
  const [crateState, setCrateState] = useState<CrateState>('locked');

  const handleOpen = () => {
    if (crateState !== 'locked') return;
    setCrateState('shaking');
    setTimeout(() => setCrateState('opening'), 600);
    setTimeout(() => setCrateState('revealed'), 1500);
  };

  const lidOpen = crateState === 'opening' || crateState === 'revealed';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="flex flex-col items-center gap-5 py-4"
    >
      {/* Status header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="text-center"
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <CheckCircle2 size={16} style={{ color: '#16A34A' }} />
          <span className="text-sm font-semibold" style={{ color: '#16A34A' }}>
            Order Placed Successfully!
          </span>
        </div>
        <p className="text-xs" style={{ color: '#94A3B8' }}>
          {crateState === 'revealed' ? 'Your premium is ready to track' : 'Your Premium Crate is waiting — click to unbox'}
        </p>
      </motion.div>

      {/* Crate scene */}
      <div className="relative flex items-center justify-center" style={{ width: 200, height: 170 }}>

        {/* Ambient glow orb */}
        <motion.div
          animate={{
            scale: crateState === 'revealed' ? 1.7 : crateState === 'opening' ? 1.45 : 1,
            opacity: crateState === 'revealed' ? 0.22 : crateState === 'opening' ? 0.32 : 0.10,
          }}
          transition={{ duration: 0.7 }}
          style={{
            position: 'absolute',
            width: 130,
            height: 100,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, #38BDF8 0%, #F472B6 55%, transparent 100%)',
            filter: 'blur(22px)',
            zIndex: 0,
          }}
        />

        {/* Particles */}
        <AnimatePresence>
          {crateState === 'opening' && PARTICLES.map((p) => {
            const rad = (p.angle * Math.PI) / 180;
            return (
              <motion.div
                key={p.id}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: Math.cos(rad) * p.distance,
                  y: Math.sin(rad) * p.distance,
                  opacity: 0,
                  scale: 0,
                }}
                transition={{ duration: 0.9, delay: p.delay, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  width: p.size,
                  height: p.size,
                  borderRadius: '50%',
                  backgroundColor: p.color,
                  zIndex: 10,
                }}
              />
            );
          })}
        </AnimatePresence>

        {/* 3D Crate SVG — shakes before opening */}
        <motion.div
          animate={crateState === 'shaking' ? {
            x: [0, -7, 7, -6, 6, -3, 3, 0],
            rotate: [0, -2.5, 2.5, -1.8, 1.8, -0.6, 0.6, 0],
          } : {}}
          transition={{ duration: 0.58, ease: 'easeInOut' }}
          style={{ position: 'absolute', zIndex: 2 }}
        >
          <CrateSVG lidOpen={lidOpen} />

          {/* Platform icon floats up from inside when revealed */}
          <AnimatePresence>
            {crateState === 'revealed' && (
              <motion.div
                initial={{ y: 20, opacity: 0, scale: 0.7 }}
                animate={{ y: -20, opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 350, damping: 22, delay: 0.2 }}
                style={{
                  position: 'absolute',
                  bottom: 28,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 6,
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: `linear-gradient(135deg, ${platform.color}22, ${platform.color}10)`,
                    border: `1.5px solid ${platform.color}55`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 8px 20px ${platform.color}33`,
                  }}
                >
                  <PlatformIcon platformId={platform.id} size={26} color={platform.color} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Sparkles — revealed state */}
        <AnimatePresence>
          {crateState === 'revealed' && (
            <>
              {[{ x: -62, y: -28, delay: 0.2 }, { x: 58, y: -22, delay: 0.32 }, { x: -44, y: 38, delay: 0.27 }].map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ delay: s.delay, type: 'spring', stiffness: 380, damping: 20 }}
                  style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: s.x, marginTop: s.y, zIndex: 8 }}
                >
                  <Sparkles size={13} style={{ color: i === 1 ? '#F472B6' : '#38BDF8' }} />
                </motion.div>
              ))}
            </>
          )}
        </AnimatePresence>

        {/* Lock badge on crate (locked state only) */}
        <AnimatePresence>
          {crateState === 'locked' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ delay: 0.3, type: 'spring' }}
              style={{
                position: 'absolute',
                top: 8,
                right: 28,
                zIndex: 8,
                background: 'rgba(255,255,255,0.92)',
                border: '1px solid rgba(56,189,248,0.30)',
                borderRadius: 8,
                padding: '3px 7px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: '0 2px 8px rgba(56,189,248,0.15)',
              }}
            >
              <Lock size={9} style={{ color: '#0EA5E9' }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: '#0EA5E9', letterSpacing: '0.04em' }}>SEALED</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action area */}
      <AnimatePresence mode="wait">
        {crateState !== 'revealed' ? (
          /* Unbox button */
          <motion.button
            key="open-btn"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ scale: crateState === 'locked' ? 1.04 : 1, y: crateState === 'locked' ? -2 : 0 }}
            whileTap={{ scale: crateState === 'locked' ? 0.96 : 1 }}
            onClick={handleOpen}
            disabled={crateState !== 'locked'}
            className="px-8 py-3.5 rounded-2xl font-semibold text-base text-white transition-all disabled:opacity-60"
            style={{
              background: crateState === 'locked'
                ? 'linear-gradient(135deg, #38BDF8 0%, #0EA5E9 45%, #F472B6 100%)'
                : 'linear-gradient(135deg, #94A3B8, #64748B)',
              boxShadow: crateState === 'locked'
                ? '0 12px 28px rgba(56,189,248,0.32), 0 4px 12px rgba(244,114,182,0.20)'
                : 'none',
              cursor: crateState === 'locked' ? 'pointer' : 'default',
            }}
          >
            {crateState === 'locked' ? 'Unbox Now' : '✦ Opening…'}
          </motion.button>
        ) : (
          /* Reveal card */
          <motion.div
            key="reveal-card"
            initial={{ opacity: 0, y: 28, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="w-full rounded-2xl p-5"
            style={{
              background: 'rgba(255,255,255,0.88)',
              backdropFilter: 'blur(24px) saturate(1.9)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.9)',
              border: '1.5px solid rgba(56,189,248,0.35)',
              boxShadow: '0 16px 40px rgba(56,189,248,0.18), 0 6px 16px rgba(244,114,182,0.12), inset 0 1px 1px rgba(255,255,255,0.85)',
            }}
          >
            {/* Card header */}
            <div className="flex items-center gap-3 pb-4" style={{ borderBottom: '1px solid rgba(148,163,184,0.12)' }}>
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${platform.color}15` }}
              >
                <PlatformIcon platformId={platform.id} size={26} color={platform.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: '#0F172A' }}>{platform.name}</p>
                <p className="text-xs" style={{ color: '#94A3B8' }}>{planLabel} subscription</p>
              </div>
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0"
                style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A' }}
              >
                <CheckCircle2 size={11} />
                Paid
              </div>
            </div>

            {/* Detail rows */}
            <div className="pt-4 flex flex-col gap-2.5">
              <RevealRow label="Duration" value={planLabel} />
              <RevealRow label="Amount paid" value={`${amountUsdc} USDC`} accent />
              <RevealRow label="Escrow" value="Protected — 24h refund" />
              {orderId && (
                <RevealRow label="Order ID" value={`${orderId.slice(0, 14)}…`} mono />
              )}
            </div>

            {/* Tx explorer link */}
            {txHash && (
              <a
                href={buildTxExplorerUrl(chainId, txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs mt-3 pt-3 hover:opacity-80 transition-opacity"
                style={{ color: '#0EA5E9', borderTop: '1px solid rgba(148,163,184,0.12)' }}
              >
                <ExternalLink size={11} />
                View transaction on explorer
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Track order button — only when revealed */}
      <AnimatePresence>
        {crateState === 'revealed' && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={onViewOrders}
            className="w-full py-4 rounded-2xl font-semibold text-base text-white btn-premium"
          >
            Track My Order
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RevealRow({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span style={{ color: '#94A3B8' }}>{label}</span>
      <span
        className={mono ? 'font-mono text-xs' : 'font-medium'}
        style={accent ? {
          background: 'linear-gradient(90deg, #0EA5E9, #F472B6)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        } : { color: '#0F172A' }}
      >
        {value}
      </span>
    </div>
  );
}
