import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, ShieldCheck, MessageSquare } from 'lucide-react';
import { fetchReviewsByProduct, type SupabaseReview } from '../lib/supabase';

interface ReviewsSectionProps {
  productId: string;
  productName: string;
}

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          fill={s <= rating ? '#F59E0B' : 'none'}
          style={{ color: s <= rating ? '#F59E0B' : '#CBD5E1' }}
        />
      ))}
    </div>
  );
}

function formatWallet(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function RatingBar({ star, count, total }: { star: number; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-3 text-right" style={{ color: '#64748B' }}>{star}</span>
      <Star size={11} fill="#F59E0B" style={{ color: '#F59E0B', flexShrink: 0 }} />
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(148,163,184,0.18)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: pct > 0 ? 'linear-gradient(90deg,#38BDF8,#F472B6)' : 'transparent' }}
        />
      </div>
      <span className="text-xs w-5 text-right" style={{ color: '#94A3B8' }}>{count}</span>
    </div>
  );
}

export function ReviewsSection({ productId, productName }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<SupabaseReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchReviewsByProduct(productId)
      .then((data) => { if (active) { setReviews(data); setLoading(false); } })
      .catch(() => { if (active) { setReviews([]); setLoading(false); } });
    return () => { active = false; };
  }, [productId]);

  const avgRating = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : 0;

  const starCounts = [5, 4, 3, 2, 1].map((s) => ({
    star: s,
    count: reviews.filter((r) => r.rating === s).length,
  }));

  return (
    <div className="flex flex-col gap-4">
      {/* Summary row */}
      <div
        className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl"
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(56,189,248,0.18)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.70), 0 2px 12px rgba(56,189,248,0.08)',
        }}
      >
        {/* Score */}
        <div className="flex flex-col items-center justify-center gap-1 sm:pr-6 sm:border-r" style={{ borderColor: 'rgba(148,163,184,0.16)' }}>
          <span className="display text-4xl font-700" style={{ color: '#0F172A', letterSpacing: '-0.04em' }}>
            {reviews.length > 0 ? avgRating.toFixed(1) : '—'}
          </span>
          <StarRow rating={Math.round(avgRating)} size={16} />
          <span className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
            {reviews.length} review{reviews.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Bar chart */}
        <div className="flex-1 flex flex-col gap-1.5 justify-center">
          {starCounts.map(({ star, count }) => (
            <RatingBar key={star} star={star} count={count} total={reviews.length} />
          ))}
        </div>
      </div>

      {/* Review list */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl h-20 animate-pulse" style={{ background: '#F1F5F9', opacity: 1 - i * 0.3 }} />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <MessageSquare size={32} style={{ color: '#CBD5E1' }} />
          <p className="text-sm font-medium" style={{ color: '#64748B' }}>
            No reviews yet for {productName}
          </p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>
            Be the first to leave a review after your order is delivered!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((review, i) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl p-4 card-hover-sm"
              style={{
                background: 'rgba(255,255,255,0.72)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.60)',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.70), 0 2px 10px rgba(56,189,248,0.07)',
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#38BDF8,#F472B6)', color: '#ffffff' }}
                  >
                    {review.buyerAddress.slice(2, 4).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold mono" style={{ color: '#0F172A' }}>
                        {formatWallet(review.buyerAddress)}
                      </span>
                      {review.isVerified && (
                        <span
                          className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(56,189,248,0.08)',
                            color: '#0EA5E9',
                            border: '1px solid rgba(56,189,248,0.18)',
                          }}
                        >
                          <ShieldCheck size={10} />
                          Verified Buyer
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                      {formatDate(review.createdAt)}
                    </p>
                  </div>
                </div>
                <StarRow rating={review.rating} size={13} />
              </div>
              {review.comment && (
                <p className="text-sm leading-relaxed" style={{ color: '#334155' }}>
                  {review.comment}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
