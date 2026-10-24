import { motion } from 'framer-motion';
import { ArrowRight, Zap, RefreshCw, Tag, Lock } from 'lucide-react';
import { BannerSlider } from '../components/BannerSlider';
import { ActiveOrdersStrip } from '../components/ActiveOrdersStrip';
import type { Page } from '../types';

interface DashboardHomeProps {
  onNavigate: (page: Page) => void;
}

const FEATURE_CHIPS = [
  { icon: Zap,       label: 'Instant Delivery' },
  { icon: Lock,      label: 'USDC Escrow' },
  { icon: RefreshCw, label: '24h Refund' },
  { icon: Tag,       label: 'Up to 20% Off' },
];

const TRUST_BADGES = [
  {
    icon: Lock,
    title: 'On-Chain Escrow',
    desc: 'Funds locked until delivery',
    color: '#0EA5E9',
    bg: 'linear-gradient(135deg, rgba(56,189,248,0.06) 0%, rgba(244,114,182,0.04) 100%)',
    border: 'rgba(56,189,248,0.20)',
    shadow: '0 4px 16px rgba(56,189,248,0.12)',
  },
  {
    icon: Zap,
    title: 'Instant Delivery',
    desc: 'Codes sent within minutes',
    color: '#F472B6',
    bg: 'linear-gradient(135deg, rgba(244,114,182,0.06) 0%, rgba(56,189,248,0.04) 100%)',
    border: 'rgba(244,114,182,0.22)',
    shadow: '0 4px 16px rgba(244,114,182,0.10)',
  },
  {
    icon: RefreshCw,
    title: '24h Money-Back',
    desc: 'Full refund if undelivered',
    color: '#16A34A',
    bg: 'linear-gradient(135deg, rgba(22,163,74,0.06) 0%, rgba(56,189,248,0.04) 100%)',
    border: 'rgba(22,163,74,0.20)',
    shadow: '0 4px 16px rgba(22,163,74,0.08)',
  },
];

export function DashboardHome({ onNavigate }: DashboardHomeProps) {
  return (
    <div className="flex flex-col gap-7">
      {/* Page heading */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38 }}
      >
        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
            style={{
              background: 'rgba(14,165,233,0.08)',
              border: '1px solid rgba(14,165,233,0.20)',
              color: '#0EA5E9',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#0EA5E9' }} />
            Web3 Digital Marketplace
          </span>
        </div>
        <h1
          className="display text-3xl sm:text-4xl font-700 mb-2"
          style={{ letterSpacing: '-0.04em', lineHeight: '1.15', color: '#0F172A' }}
        >
          Unlock Social &amp; Digital{' '}
          <span
            style={{
              background: 'linear-gradient(90deg, #38BDF8, #0EA5E9, #F472B6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
Creations
          </span>
          <br />
          <span style={{ color: '#94A3B8', fontSize: '0.72em', fontWeight: 500, letterSpacing: '-0.02em' }}>
            with Arc USDC — Secured by Escrow
          </span>
        </h1>
      </motion.div>

      {/* Feature chips */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="flex flex-wrap gap-2"
      >
        {FEATURE_CHIPS.map((c) => (
          <span
            key={c.label}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: '#F1F5F9',
              color: '#475569',
              border: '1px solid rgba(148,163,184,0.25)',
            }}
          >
            <c.icon size={12} style={{ color: '#0EA5E9' }} />
            {c.label}
          </span>
        ))}
      </motion.div>

      {/* Primary CTA */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.10 }}
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate('catalog')}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-semibold text-white btn-premium"
          style={{ borderRadius: '1rem' }}
        >
          Browse the Store
          <ArrowRight size={18} />
        </motion.button>
      </motion.div>

      {/* Banner slider */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
      >
        <BannerSlider onNavigate={onNavigate} />
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="grid grid-cols-3 gap-3"
      >
        {[
          { value: '5,000+', label: 'Orders Fulfilled' },
          { value: '100%',   label: 'On-Chain Escrow' },
          { value: '24/7',   label: 'Delivery' },
        ].map((s) => (
          <div
            key={s.label}
            className="glass card-hover card-glow rounded-xl p-4 flex flex-col items-center text-center"
            style={{ border: '1px solid rgba(255,255,255,0.55)' }}
          >
            <span
              className="display text-xl font-700 tabular mb-0.5"
              style={{ color: '#0EA5E9' }}
            >
              {s.value}
            </span>
            <span className="text-xs" style={{ color: '#94A3B8' }}>
              {s.label}
            </span>
          </div>
        ))}
      </motion.div>

      {/* Trust badges */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.20 }}
        className="grid grid-cols-3 gap-3"
      >
        {TRUST_BADGES.map((b) => (
          <div
            key={b.title}
            className="card-hover card-glow rounded-xl p-3 flex flex-col items-center text-center gap-1.5"
            style={{
              background: 'rgba(255,255,255,0.68)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${b.border}`,
              boxShadow: `${b.shadow}, inset 0 1px 1px rgba(255,255,255,0.70)`,
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: '#ffffff' }}
            >
              <b.icon size={15} style={{ color: b.color }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: '#1E293B', lineHeight: 1.3 }}>
              {b.title}
            </span>
            <span className="text-xs leading-tight hidden sm:block" style={{ color: '#64748B' }}>
              {b.desc}
            </span>
          </div>
        ))}
      </motion.div>

      {/* Active orders */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.26 }}
      >
        <ActiveOrdersStrip onNavigate={onNavigate} />
      </motion.div>
    </div>
  );
}
