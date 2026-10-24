import { motion } from 'framer-motion';
import { ShieldCheck, Zap, RefreshCw, Tag, ArrowRight } from 'lucide-react';
import type { Page } from '../types';

interface HomePageProps {
  onNavigate: (page: Page) => void;
}

const stats = [
  { label: 'Orders Fulfilled', value: '5,000+' },
  { label: 'On-Chain Escrow', value: '100%' },
  { label: 'Delivery', value: '24/7' },
];

const features = [
  {
    icon: Zap,
    title: 'Instant Delivery',
    desc: 'Activation codes delivered to your inbox or handle immediately after payment confirms on-chain.',
  },
  {
    icon: ShieldCheck,
    title: 'Arc USDC Escrow',
    desc: 'Your USDC is held in a smart contract until delivery is confirmed. Fully auditable and transparent.',
  },
  {
    icon: RefreshCw,
    title: '100% Refund Guarantee',
    desc: 'If your order is not fulfilled within 24 hours, you can claim a full refund directly from the contract.',
  },
  {
    icon: Tag,
    title: 'Exclusive Discounts',
    desc: 'Save up to 20% on longer plans. All priced in Arc USDC — no hidden conversion fees.',
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

export function HomePage({ onNavigate }: HomePageProps) {
  return (
    <div className="min-h-dvh flex flex-col">
      {/* Hero */}
      <section className="relative flex-1 flex items-center justify-center px-4 pt-16 pb-24 overflow-hidden">
        {/* Background glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,105,180,0.10) 0%, transparent 70%)',
          }}
        />

        <div className="relative max-w-3xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 glass"
            style={{ color: '#FFB6C1' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: '#FF69B4' }}
            />
            Powered by Arc Network USDC
          </motion.div>

          {/* Headline */}
          <motion.h1
            {...fadeUp}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="display text-4xl sm:text-5xl md:text-6xl font-700 text-white mb-6"
            style={{ letterSpacing: '-0.03em', lineHeight: 1.1 }}
          >
            Unlock Social &amp; Digital{' '}
            <span
              style={{
                background: 'linear-gradient(90deg, #FFB6C1, #FF69B4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Premiums
            </span>{' '}
            with Arc USDC
          </motion.h1>

          <motion.p
            {...fadeUp}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="text-base sm:text-lg mb-10 max-w-xl mx-auto"
            style={{ color: '#94a3b8', lineHeight: 1.7 }}
          >
            The fastest, most secure way to buy X, Discord, Telegram, YouTube &amp; Spotify
            subscriptions — settled instantly on Arc with USDC escrow protection.
          </motion.p>

          {/* CTA */}
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.5, delay: 0.22 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onNavigate('catalog')}
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-semibold transition-all"
              style={{
                background: 'linear-gradient(135deg, #FFB6C1, #FF69B4)',
                color: '#0B0F17',
                boxShadow: '0 8px 32px rgba(255, 105, 180, 0.30)',
              }}
            >
              Purchase a Premium
              <ArrowRight size={18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onNavigate('orders')}
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-medium glass transition-all"
              style={{ color: '#FFB6C1' }}
            >
              Track My Orders
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* Live Stats Bar */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="border-y"
        style={{
          borderColor: 'rgba(255, 182, 193, 0.10)',
          background: 'rgba(255, 182, 193, 0.03)',
        }}
      >
        <div className="max-w-3xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-0.5">
              <span
                className="display text-xl font-700 tabular"
                style={{ color: '#FFB6C1' }}
              >
                {s.value}
              </span>
              <span className="text-xs uppercase tracking-widest" style={{ color: '#64748b' }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="display text-2xl sm:text-3xl font-600 text-white text-center mb-12"
          style={{ letterSpacing: '-0.02em' }}
        >
          Why Premium Create?
        </motion.h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.07 }}
              className="glass rounded-2xl p-6 flex gap-4"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: 'rgba(255, 182, 193, 0.12)' }}
              >
                <f.icon size={18} style={{ color: '#FFB6C1' }} />
              </div>
              <div>
                <h3
                  className="font-semibold text-white mb-1.5 text-sm"
                  style={{ letterSpacing: '-0.01em' }}
                >
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
                  {f.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
