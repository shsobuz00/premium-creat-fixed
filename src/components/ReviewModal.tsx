import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { insertReview } from '../lib/supabase';

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  orderId: string;
  buyerAddress: string;
  onSubmitted: () => void;
}

export function ReviewModal({
  open,
  onClose,
  productId,
  productName,
  orderId,
  buyerAddress,
  onSubmitted,
}: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) { toast.error('Please select a star rating.'); return; }
    setSubmitting(true);
    try {
      await insertReview({ productId, orderId, buyerAddress, rating, comment });
      setDone(true);
      toast.success('Review submitted successfully!');
      setTimeout(() => {
        onSubmitted();
        onClose();
      }, 1600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit review.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const displayStar = hovered || rating;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="w-full max-w-md rounded-2xl pointer-events-auto"
              style={{
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(32px) saturate(2)',
                WebkitBackdropFilter: 'blur(32px) saturate(2)',
                border: '1px solid rgba(255,255,255,0.70)',
                boxShadow: '0 24px 60px rgba(56,189,248,0.18), 0 8px 24px rgba(244,114,182,0.12), inset 0 1px 1px rgba(255,255,255,0.85)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid rgba(148,163,184,0.14)' }}
              >
                <div>
                  <h2 className="font-semibold text-base" style={{ color: '#0F172A' }}>
                    Leave a Review
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                    {productName}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-slate-100"
                  style={{ color: '#94A3B8' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 flex flex-col gap-5">
                {done ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-3 py-6 text-center"
                  >
                    <CheckCircle2 size={40} style={{ color: '#16A34A' }} />
                    <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>
                      Review submitted!
                    </p>
                    <p className="text-xs" style={{ color: '#64748B' }}>
                      Thank you for your feedback.
                    </p>
                  </motion.div>
                ) : (
                  <>
                    {/* Star picker */}
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium" style={{ color: '#334155' }}>
                        Your Rating
                      </p>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onMouseEnter={() => setHovered(star)}
                            onMouseLeave={() => setHovered(0)}
                            onClick={() => setRating(star)}
                            className="transition-transform active:scale-90"
                            style={{ transform: displayStar >= star ? 'scale(1.15)' : 'scale(1)' }}
                            aria-label={`${star} star`}
                          >
                            <Star
                              size={32}
                              fill={displayStar >= star ? '#F59E0B' : 'none'}
                              style={{
                                color: displayStar >= star ? '#F59E0B' : '#CBD5E1',
                                transition: 'color 0.12s, fill 0.12s',
                              }}
                            />
                          </button>
                        ))}
                      </div>
                      {rating > 0 && (
                        <p className="text-xs" style={{ color: '#64748B' }}>
                          {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][rating]}
                        </p>
                      )}
                    </div>

                    {/* Comment */}
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-medium" style={{ color: '#334155' }}>
                        Comment <span style={{ color: '#94A3B8' }}>(optional)</span>
                      </p>
                      <textarea
                        rows={4}
                        placeholder="Share your experience with this product..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        maxLength={400}
                        className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none transition-all"
                        style={{
                          background: '#F8FAFC',
                          border: '1px solid rgba(148,163,184,0.25)',
                          color: '#0F172A',
                        }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(56,189,248,0.45)')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(148,163,184,0.25)')}
                      />
                      <p className="text-xs text-right" style={{ color: '#CBD5E1' }}>
                        {comment.length}/400
                      </p>
                    </div>

                    {/* Submit */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => void handleSubmit()}
                      disabled={submitting || rating === 0}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                      style={{
                        background: 'linear-gradient(135deg, #38BDF8, #F472B6)',
                        boxShadow: '0 4px 16px rgba(56,189,248,0.28)',
                      }}
                    >
                      {submitting ? (
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <Send size={15} />
                      )}
                      {submitting ? 'Submitting...' : 'Submit Review'}
                    </motion.button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
