import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Tag, X, Sparkles, Star, ChevronLeft } from 'lucide-react';
import { PLATFORMS } from '../data/platforms';
import { PlatformIcon } from '../components/PlatformIcon';
import { formatUSDC, validatePromo } from '../lib/utils';
import { fetchRatingSummaries, type RatingSummary } from '../lib/supabase';
import { ReviewsSection } from '../components/ReviewsSection';
import type { Category, Page, Platform } from '../types';

interface CatalogPageProps {
  onSelectPlatform: (platform: Platform, promoCode?: string, promoDiscount?: number) => void;
  onNavigate: (page: Page) => void;
}

const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'all',       label: 'All',          emoji: '✦' },
  { id: 'social',    label: 'Social Media', emoji: '💬' },
  { id: 'gaming',    label: 'Gaming',       emoji: '🎮' },
  { id: 'streaming', label: 'Streaming',    emoji: '▶' },
];

const MAX_PLAN_DISCOUNT = 20;

export function CatalogPage({ onSelectPlatform }: CatalogPageProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [promoInput, setPromoInput] = useState('');
  const [promoResult, setPromoResult] = useState<{ valid: boolean; discount: number; label: string } | null>(null);
  const [promoTouched, setPromoTouched] = useState(false);
  const [ratings, setRatings] = useState<Record<string, RatingSummary>>({});
  const [detailPlatform, setDetailPlatform] = useState<Platform | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'reviews'>('overview');

  useEffect(() => {
    fetchRatingSummaries(PLATFORMS.map((p) => p.id))
      .then(setRatings)
      .catch(() => setRatings({}));
  }, []);

  const filtered = PLATFORMS.filter((p) => {
    const matchCat = category === 'all' || p.category === category;
    const matchQ =
      !query ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.tagline.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQ;
  });

  const handleApplyPromo = () => {
    setPromoTouched(true);
    const result = validatePromo(promoInput);
    setPromoResult(result);
  };

  const handleClearPromo = () => {
    setPromoInput('');
    setPromoResult(null);
    setPromoTouched(false);
  };

  const handleSelect = (platform: Platform) => {
    if (promoResult?.valid) {
      onSelectPlatform(platform, promoInput.toUpperCase().trim(), promoResult.discount);
    } else {
      onSelectPlatform(platform);
    }
  };

  const handleOpenDetail = (platform: Platform) => {
    setDetailPlatform(platform);
    setDetailTab('overview');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={18} style={{ color: '#0EA5E9' }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#0EA5E9' }}>
            Flash Sales Active
          </span>
        </div>
        <h1 className="display text-3xl sm:text-4xl font-700 mb-2" style={{ letterSpacing: '-0.03em', color: '#0F172A' }}>
          Premium Create
        </h1>
        <p className="text-sm" style={{ color: '#64748B' }}>
          Choose a platform — all prices in Arc USDC. Save up to {MAX_PLAN_DISCOUNT}% on longer plans.
        </p>
      </motion.div>

      {/* Search + Promo row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.06 }}
        className="flex flex-col sm:flex-row gap-3 mb-5"
      >
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: '#94A3B8' }}
          />
          <input
            type="text"
            placeholder="Search platforms..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
            style={{
              background: '#ffffff',
              border: '1px solid rgba(148,163,184,0.25)',
              color: '#0F172A',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(14,165,233,0.45)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(148,163,184,0.25)')}
          />
        </div>

        {/* Promo code */}
        <div className="flex gap-2 sm:w-auto w-full">
          <div className="relative flex-1 sm:w-44">
            <Tag
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: promoResult?.valid ? '#16A34A' : '#94A3B8' }}
            />
            <input
              type="text"
              placeholder="Promo code"
              value={promoInput}
              onChange={(e) => {
                setPromoInput(e.target.value);
                if (promoResult) setPromoResult(null);
              }}
              className="w-full pl-9 pr-3 py-3 rounded-xl text-sm outline-none transition-all uppercase"
              style={{
                background: promoResult?.valid ? 'rgba(22,163,74,0.05)' : '#ffffff',
                border: promoResult?.valid
                  ? '1px solid rgba(22,163,74,0.35)'
                  : promoTouched && promoResult && !promoResult.valid
                  ? '1px solid rgba(220,38,38,0.40)'
                  : '1px solid rgba(148,163,184,0.25)',
                color: '#0F172A',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(14,165,233,0.45)')}
              onBlur={(e) => {
                if (!promoResult?.valid) {
                  e.currentTarget.style.borderColor = 'rgba(148,163,184,0.25)';
                }
              }}
            />
          </div>
          {promoResult?.valid ? (
            <button
              onClick={handleClearPromo}
              className="px-3 py-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
              style={{
                background: 'rgba(22,163,74,0.08)',
                border: '1px solid rgba(22,163,74,0.25)',
                color: '#16A34A',
              }}
            >
              <X size={12} />
              Clear
            </button>
          ) : (
            <button
              onClick={handleApplyPromo}
              disabled={!promoInput.trim()}
              className="px-4 py-3 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: '#0EA5E9' }}
            >
              Apply
            </button>
          )}
        </div>
      </motion.div>

      {/* Promo feedback */}
      <AnimatePresence>
        {promoTouched && promoResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div
              className="px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2"
              style={{
                background: promoResult.valid ? 'rgba(22,163,74,0.06)' : 'rgba(220,38,38,0.05)',
                border: promoResult.valid ? '1px solid rgba(22,163,74,0.22)' : '1px solid rgba(220,38,38,0.22)',
                color: promoResult.valid ? '#16A34A' : '#DC2626',
              }}
            >
              {promoResult.valid ? (
                <><Tag size={12} />{promoResult.label} — applied to your order!</>
              ) : (
                <><X size={12} />Invalid promo code. Try: ARC10, LAUNCH, or USDC5</>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex gap-2 mb-8 flex-wrap"
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className="px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5"
            style={{
              background: category === cat.id
                ? 'linear-gradient(135deg, #38BDF8, #F472B6)'
                : 'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: category === cat.id ? '#ffffff' : '#64748B',
              border: category === cat.id ? 'none' : '1px solid rgba(255,255,255,0.55)',
              boxShadow: category === cat.id
                ? '0 8px 20px rgba(56,189,248,0.25), 0 4px 12px rgba(244,114,182,0.18), inset 0 1px 1px rgba(255,255,255,0.25)'
                : 'inset 0 1px 1px rgba(255,255,255,0.60)',
              transform: category === cat.id ? 'translateY(-2px)' : 'none',
            }}
          >
            <span>{cat.emoji}</span>
            {cat.label}
          </button>
        ))}
      </motion.div>

      {/* Platform grid */}
      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-16"
            style={{ color: '#94A3B8' }}
          >
            <p className="text-sm">No platforms match your search.</p>
          </motion.div>
        ) : (
          <motion.div key="grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((platform, i) => (
              <motion.div
                key={platform.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
                layout
              >
                <PlatformCard
                  platform={platform}
                  onSelect={handleSelect}
                  onOpenDetail={handleOpenDetail}
                  promoActive={promoResult?.valid ?? false}
                  promoDiscount={promoResult?.valid ? promoResult.discount : 0}
                  rating={ratings[platform.id]}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {detailPlatform && (
          <>
            <motion.div
              key="detail-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(6px)' }}
              onClick={() => setDetailPlatform(null)}
            />
            <motion.div
              key="detail-modal"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-2xl pointer-events-auto overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.90)',
                  backdropFilter: 'blur(32px) saturate(2)',
                  WebkitBackdropFilter: 'blur(32px) saturate(2)',
                  border: '1px solid rgba(255,255,255,0.65)',
                  boxShadow: '0 24px 60px rgba(56,189,248,0.18), 0 8px 24px rgba(244,114,182,0.12), inset 0 1px 1px rgba(255,255,255,0.80)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal header */}
                <div
                  className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
                  style={{ borderBottom: '1px solid rgba(148,163,184,0.14)' }}
                >
                  <button
                    onClick={() => setDetailPlatform(null)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-slate-100 flex-shrink-0"
                    style={{ color: '#64748B' }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${detailPlatform.color}14` }}
                  >
                    <PlatformIcon platformId={detailPlatform.id} size={22} color={detailPlatform.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-sm truncate" style={{ color: '#0F172A' }}>
                      {detailPlatform.name}
                    </h2>
                    <p className="text-xs truncate" style={{ color: '#64748B' }}>
                      {detailPlatform.tagline}
                    </p>
                  </div>
                  {ratings[detailPlatform.id] && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Star size={13} fill="#F59E0B" style={{ color: '#F59E0B' }} />
                      <span className="text-xs font-semibold" style={{ color: '#0F172A' }}>
                        {ratings[detailPlatform.id].avgRating.toFixed(1)}
                      </span>
                      <span className="text-xs" style={{ color: '#94A3B8' }}>
                        ({ratings[detailPlatform.id].totalReviews})
                      </span>
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <div
                  className="flex flex-shrink-0 px-5 pt-3 gap-1"
                  style={{ borderBottom: '1px solid rgba(148,163,184,0.12)' }}
                >
                  {(['overview', 'reviews'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setDetailTab(tab)}
                      className="px-4 py-2 text-xs font-medium rounded-t-xl capitalize transition-all"
                      style={{
                        color: detailTab === tab ? '#0EA5E9' : '#64748B',
                        borderBottom: detailTab === tab ? '2px solid #38BDF8' : '2px solid transparent',
                        background: detailTab === tab ? 'rgba(56,189,248,0.06)' : 'transparent',
                      }}
                    >
                      {tab === 'reviews'
                        ? `Reviews${ratings[detailPlatform.id] ? ` (${ratings[detailPlatform.id].totalReviews})` : ''}`
                        : 'Overview'}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  {detailTab === 'overview' ? (
                    <div className="flex flex-col gap-4">
                      {/* Price from */}
                      <div
                        className="flex items-center justify-between p-4 rounded-2xl"
                        style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.12)' }}
                      >
                        <div>
                          <p className="text-xs" style={{ color: '#94A3B8' }}>Starting from</p>
                          <p className="display text-2xl font-700 tabular" style={{ color: '#0F172A', letterSpacing: '-0.03em' }}>
                            {formatUSDC(detailPlatform.basePrice)}{' '}
                            <span className="text-base font-medium" style={{ color: '#64748B' }}>USDC</span>
                          </p>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => { setDetailPlatform(null); handleSelect(detailPlatform); }}
                          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white btn-premium"
                        >
                          Select Plan
                        </motion.button>
                      </div>
                      {/* Rating summary inline */}
                      {ratings[detailPlatform.id] && (
                        <div className="flex items-center gap-3 px-1">
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map((s) => (
                              <Star key={s} size={15}
                                fill={s <= Math.round(ratings[detailPlatform.id].avgRating) ? '#F59E0B' : 'none'}
                                style={{ color: s <= Math.round(ratings[detailPlatform.id].avgRating) ? '#F59E0B' : '#CBD5E1' }}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                            {ratings[detailPlatform.id].avgRating.toFixed(1)}
                          </span>
                          <span className="text-xs" style={{ color: '#94A3B8' }}>
                            from {ratings[detailPlatform.id].totalReviews} verified buyer{ratings[detailPlatform.id].totalReviews !== 1 ? 's' : ''}
                          </span>
                          <button
                            onClick={() => setDetailTab('reviews')}
                            className="ml-auto text-xs font-medium transition-colors"
                            style={{ color: '#0EA5E9' }}
                          >
                            See all →
                          </button>
                        </div>
                      )}
                      <p className="text-sm leading-relaxed" style={{ color: '#334155' }}>
                        {detailPlatform.tagline}. Delivered digitally via activation code within minutes of payment confirmation on the Arc blockchain.
                      </p>
                      <div
                        className="flex flex-col gap-2 p-4 rounded-xl text-xs"
                        style={{ background: '#F8FAFC', border: '1px solid rgba(148,163,184,0.18)' }}
                      >
                        {[
                          ['Category', detailPlatform.category.charAt(0).toUpperCase() + detailPlatform.category.slice(1)],
                          ['Delivery', 'Digital activation code'],
                          ['Escrow', 'Arc blockchain — fully protected'],
                          ['Refund window', '24 hours after payment'],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-4">
                            <span style={{ color: '#94A3B8' }}>{k}</span>
                            <span className="text-right font-medium" style={{ color: '#334155' }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <ReviewsSection
                      productId={detailPlatform.id}
                      productName={detailPlatform.name}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlatformCard({
  platform,
  onSelect,
  onOpenDetail,
  promoActive,
  promoDiscount,
  rating,
}: {
  platform: Platform;
  onSelect: (p: Platform) => void;
  onOpenDetail: (p: Platform) => void;
  promoActive: boolean;
  promoDiscount: number;
  rating?: RatingSummary;
}) {
  const maxDiscount = MAX_PLAN_DISCOUNT + promoDiscount;

  const badgeClass = platform.badge === 'hot' ? 'badge-hot'
    : platform.badge === 'popular' ? 'badge-popular'
    : platform.badge === 'new' ? 'badge-popular'
    : '';
  const badgeLabel = platform.badge === 'hot' ? 'Hot'
    : platform.badge === 'popular' ? 'Popular'
    : platform.badge === 'new' ? 'New'
    : '';

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.02, boxShadow: '0 20px 35px -10px rgba(56,189,248,0.30), 0 10px 20px -10px rgba(244,114,182,0.30)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      className="glass card-glow card-gradient-border rounded-2xl p-5 flex flex-col gap-4 cursor-pointer group relative overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(20px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
        border: '1px solid rgba(255,255,255,0.60)',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.70), 0 2px 10px rgba(56,189,248,0.08)',
      }}
      onClick={() => onOpenDetail(platform)}
    >
      {/* Subtle glow orb on hover */}
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${platform.color}14 0%, transparent 70%)` }}
      />

      {/* Top badges */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
        {platform.badge && (
          <span className={badgeClass}>{badgeLabel}</span>
        )}
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.18)' }}
        >
          Save {maxDiscount}%
        </span>
        {promoActive && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
            style={{ background: 'rgba(14,165,233,0.08)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.18)' }}
          >
            <Tag size={9} />
            Promo
          </span>
        )}
      </div>

      <div className="flex items-start gap-3 pr-16">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
          style={{ background: `${platform.color}14`, boxShadow: `0 0 12px ${platform.color}18` }}
        >
          <PlatformIcon platformId={platform.id} size={26} color={platform.color} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate" style={{ letterSpacing: '-0.01em', color: '#0F172A' }}>
            {platform.name}
          </h3>
          <p className="text-xs mt-0.5 leading-snug line-clamp-2" style={{ color: '#64748B' }}>
            {platform.tagline}
          </p>
        </div>
      </div>

      {/* Rating row */}
      {rating ? (
        <div className="flex items-center gap-1.5 -mt-1">
          <div className="flex gap-0.5">
            {[1,2,3,4,5].map((s) => (
              <Star key={s} size={11}
                fill={s <= Math.round(rating.avgRating) ? '#F59E0B' : 'none'}
                style={{ color: s <= Math.round(rating.avgRating) ? '#F59E0B' : '#CBD5E1' }}
              />
            ))}
          </div>
          <span className="text-xs font-semibold" style={{ color: '#0F172A' }}>{rating.avgRating.toFixed(1)}</span>
          <span className="text-xs" style={{ color: '#94A3B8' }}>({rating.totalReviews})</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 -mt-1">
          {[1,2,3,4,5].map((s) => (
            <Star key={s} size={11} style={{ color: '#CBD5E1' }} />
          ))}
          <span className="text-xs ml-0.5" style={{ color: '#CBD5E1' }}>No reviews yet</span>
        </div>
      )}

      <div
        className="flex items-center justify-between pt-1 border-t"
        style={{ borderColor: 'rgba(148,163,184,0.15)' }}
      >
        <div>
          <span className="text-xs" style={{ color: '#94A3B8' }}>From</span>
          <span className="display font-600 ml-1.5 tabular text-sm" style={{ color: '#0F172A' }}>
            {formatUSDC(platform.basePrice)} USDC
          </span>
        </div>
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.95 }}
          className="px-4 py-1.5 rounded-xl text-xs font-semibold transition-all btn-premium"
          onClick={(e) => { e.stopPropagation(); onSelect(platform); }}
        >
          Select Plan
        </motion.button>
      </div>
    </motion.div>
  );
}
