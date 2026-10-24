import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Zap, Tag, Shield, Clock } from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';
import type { Page } from '../types';

interface BannerSliderProps {
  onNavigate: (page: Page) => void;
}

const SLIDES = [
  {
    id: 'deal-1',
    tag: 'Limited Deal',
    headline: 'Save 20% on Annual Plans',
    sub: 'Lock in the lowest price on X Premium, Spotify, Discord Nitro & more.',
    cta: 'Shop Annual Plans',
    ctaPage: 'catalog' as Page,
    icon: Tag,
    platforms: ['x-premium', 'spotify-premium', 'discord-nitro'],
    accent: '#0EA5E9',
    bg: 'linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(248,250,252,0) 70%)',
    border: 'rgba(14,165,233,0.18)',
  },
  {
    id: 'deal-2',
    tag: 'Instant Delivery',
    headline: 'Activation in Minutes',
    sub: 'Codes delivered on-chain after payment confirms. Zero wait, zero risk.',
    cta: 'Browse Store',
    ctaPage: 'catalog' as Page,
    icon: Zap,
    platforms: ['telegram-premium', 'youtube-premium'],
    accent: '#7C3AED',
    bg: 'linear-gradient(135deg, rgba(124,58,237,0.07) 0%, rgba(248,250,252,0) 70%)',
    border: 'rgba(124,58,237,0.16)',
  },
  {
    id: 'deal-3',
    tag: 'Arc USDC Escrow',
    headline: '100% Refund Guarantee',
    sub: 'USDC held in smart contract escrow. Claim automatic refund if not fulfilled in 24h.',
    cta: 'Learn More',
    ctaPage: 'home' as Page,
    icon: Shield,
    platforms: ['discord-nitro-basic', 'spotify-premium'],
    accent: '#16A34A',
    bg: 'linear-gradient(135deg, rgba(22,163,74,0.07) 0%, rgba(248,250,252,0) 70%)',
    border: 'rgba(22,163,74,0.16)',
  },
  {
    id: 'deal-4',
    tag: 'New Arrival',
    headline: 'Discord Nitro Basic',
    sub: 'Now available from just $2.99 / month — emoji, stickers & profile badge.',
    cta: 'Get Nitro Basic',
    ctaPage: 'catalog' as Page,
    icon: Clock,
    platforms: ['discord-nitro-basic'],
    accent: '#5865F2',
    bg: 'linear-gradient(135deg, rgba(88,101,242,0.07) 0%, rgba(248,250,252,0) 70%)',
    border: 'rgba(88,101,242,0.18)',
  },
];

export function BannerSlider({ onNavigate }: BannerSliderProps) {
  const [idx, setIdx] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  const go = useCallback(
    (next: number) => {
      const dir = next > idx ? 1 : -1;
      setDirection(dir);
      setIdx((next + SLIDES.length) % SLIDES.length);
    },
    [idx],
  );

  useEffect(() => {
    const t = setInterval(() => go(idx + 1), 5000);
    return () => clearInterval(t);
  }, [idx, go]);

  const slide = SLIDES[idx];
  const Icon = slide.icon;

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden card-hover card-glow"
      style={{
        border: `1px solid ${slide.border}`,
        minHeight: 148,
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(20px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.70), 0 2px 12px rgba(56,189,248,0.08)',
      }}
    >
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={slide.id}
          custom={direction}
          initial={{ opacity: 0, x: direction * 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -direction * 40 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
          className="absolute inset-0 p-5 flex flex-col justify-between"
          style={{ background: slide.bg }}
        >
          {/* Top row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    background: `${slide.accent}12`,
                    color: slide.accent,
                    border: `1px solid ${slide.accent}28`,
                  }}
                >
                  <Icon size={11} />
                  {slide.tag}
                </span>
              </div>
              <h2
                className="display text-xl font-700 mb-1"
                style={{ letterSpacing: '-0.02em', lineHeight: 1.2, color: '#0F172A' }}
              >
                {slide.headline}
              </h2>
              <p className="text-xs leading-relaxed max-w-xs" style={{ color: '#64748B' }}>
                {slide.sub}
              </p>
            </div>

            {/* Platform icons */}
            <div className="flex -space-x-2 flex-shrink-0 mt-1">
              {slide.platforms.slice(0, 3).map((pid) => (
                <div
                  key={pid}
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{
                    background: '#F8FAFC',
                    border: '2px solid #ffffff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                  }}
                >
                  <PlatformIcon platformId={pid} size={18} />
                </div>
              ))}
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-between mt-3">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onNavigate(slide.ctaPage)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all"
              style={{
                background: slide.accent,
                boxShadow: `0 4px 14px ${slide.accent}30`,
              }}
            >
              {slide.cta}
            </motion.button>

            {/* Dots */}
            <div className="flex items-center gap-1.5">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  className="rounded-full transition-all"
                  style={{
                    width: i === idx ? 18 : 6,
                    height: 6,
                    background: i === idx ? slide.accent : 'rgba(148,163,184,0.35)',
                  }}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Arrow controls */}
      <button
        onClick={() => go(idx - 1)}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center transition-colors z-10"
        style={{ background: 'rgba(248,250,252,0.90)', color: '#64748B', border: '1px solid rgba(148,163,184,0.20)' }}
        aria-label="Previous slide"
      >
        <ChevronLeft size={14} />
      </button>
      <button
        onClick={() => go(idx + 1)}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center transition-colors z-10"
        style={{ background: 'rgba(248,250,252,0.90)', color: '#64748B', border: '1px solid rgba(148,163,184,0.20)' }}
        aria-label="Next slide"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
