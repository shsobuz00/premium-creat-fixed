import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Info, Tag, Users } from 'lucide-react';
import { PLANS, calcPrice } from '../data/platforms';
import { PlatformIcon } from '../components/PlatformIcon';
import { formatUSDC, validatePromo, calcReferralReward } from '../lib/utils';
import type { OrderSummary, Page, Plan, Platform } from '../types';

interface PlanPageProps {
  platform: Platform;
  onNavigate: (page: Page) => void;
  onProceedToCheckout: (summary: OrderSummary) => void;
  initialPromoCode?: string;
  initialPromoDiscount?: number;
}

export function PlanPage({
  platform,
  onNavigate,
  onProceedToCheckout,
  initialPromoCode,
  initialPromoDiscount,
}: PlanPageProps) {
  const [selectedPlan, setSelectedPlan] = useState<Plan>(PLANS[0]);
  const [deliveryTarget, setDeliveryTarget] = useState('');
  const [touched, setTouched] = useState(false);

  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState(initialPromoCode ?? '');
  const [promoResult, setPromoResult] = useState<{ valid: boolean; discount: number; label: string } | null>(
    initialPromoCode && initialPromoDiscount
      ? { valid: true, discount: initialPromoDiscount, label: `${initialPromoDiscount}% off with ${initialPromoCode}` }
      : null,
  );
  const [promoTouched, setPromoTouched] = useState(Boolean(initialPromoCode));

  const [referralInput, setReferralInput] = useState('');
  const [referralValid, setReferralValid] = useState(false);
  const [referralTouched, setReferralTouched] = useState(false);

  const { original, discounted: planDiscounted } = calcPrice(platform, selectedPlan);
  const promoExtra = promoResult?.valid ? promoResult.discount : 0;
  const afterPromo = planDiscounted * (1 - promoExtra / 100);
  const referralCredit = referralValid ? calcReferralReward(afterPromo) : 0;
  const finalPrice = Math.max(0, afterPromo - referralCredit);
  const isValid = deliveryTarget.trim().length > 0;

  const handleApplyPromo = () => {
    setPromoTouched(true);
    const result = validatePromo(promoInput);
    setPromoResult(result);
  };

  const handleApplyReferral = () => {
    setReferralTouched(true);
    const valid = /^ARC-[A-F0-9]{6}$/i.test(referralInput.trim());
    setReferralValid(valid);
  };

  const handleProceed = () => {
    setTouched(true);
    if (!isValid) return;
    onProceedToCheckout({
      platform,
      plan: selectedPlan,
      deliveryTarget: deliveryTarget.trim(),
      originalPrice: original,
      discountedPrice: finalPrice,
      promoCode: promoResult?.valid ? promoInput.toUpperCase().trim() : undefined,
      promoDiscount: promoResult?.valid ? promoResult.discount : undefined,
      referralCode: referralValid ? referralInput.trim() : undefined,
      referralCredit: referralCredit > 0 ? referralCredit : undefined,
    });
  };

  const inputBase: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid rgba(148,163,184,0.25)',
    color: '#0F172A',
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {/* Back */}
      <motion.button
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => onNavigate('catalog')}
        className="flex items-center gap-2 text-sm mb-8 transition-colors"
        style={{ color: '#94A3B8' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#0EA5E9')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
      >
        <ArrowLeft size={16} />
        Back to Store
      </motion.button>

      {/* Platform header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-4 mb-8"
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: `${platform.color}12` }}
        >
          <PlatformIcon platformId={platform.id} size={32} color={platform.color} />
        </div>
        <div>
          <h1 className="display text-2xl font-700" style={{ letterSpacing: '-0.02em', color: '#0F172A' }}>
            {platform.name}
          </h1>
          <p className="text-sm" style={{ color: '#64748B' }}>{platform.tagline}</p>
        </div>
      </motion.div>

      {/* Plan selection */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="rounded-2xl p-5 mb-5 card-hover"
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
          border: '1px solid rgba(255,255,255,0.60)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.70), 0 2px 12px rgba(56,189,248,0.06)',
        }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#94A3B8' }}>
          Select Duration
        </h2>
        {/* Ambient mesh aura behind duration cards */}
        <div className="relative">
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-xl overflow-hidden">
            <div style={{
              position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '80%',
              background: 'radial-gradient(ellipse, rgba(56,189,248,0.18) 0%, transparent 70%)',
              filter: 'blur(32px)',
            }} />
            <div style={{
              position: 'absolute', bottom: '-20%', right: '-10%', width: '60%', height: '80%',
              background: 'radial-gradient(ellipse, rgba(244,114,182,0.16) 0%, transparent 70%)',
              filter: 'blur(32px)',
            }} />
          </div>
        <div className="grid grid-cols-2 gap-3 relative z-10">
          {PLANS.map((plan) => {
            const { original: o, discounted: d } = calcPrice(platform, plan);
            const finalD = d * (1 - promoExtra / 100) - (referralValid ? calcReferralReward(d * (1 - promoExtra / 100)) : 0);
            const isSelected = selectedPlan.id === plan.id;
            return (
              <motion.button
                key={plan.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelectedPlan(plan)}
                onMouseEnter={() => setHoveredPlan(plan.id)}
                onMouseLeave={() => setHoveredPlan(null)}
                className="relative flex flex-col gap-1.5 p-4 rounded-xl text-left"
                style={{
                  background: isSelected
                    ? 'rgba(255,255,255,0.95)'
                    : hoveredPlan === plan.id
                    ? 'rgba(255,255,255,0.88)'
                    : 'rgba(248,250,252,0.70)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: isSelected
                    ? '1.5px solid rgba(56,189,248,0.70)'
                    : hoveredPlan === plan.id
                    ? '1.5px solid rgba(56,189,248,0.45)'
                    : '1px solid rgba(203,213,225,0.40)',
                  boxShadow: isSelected
                    ? '0 15px 30px -10px rgba(56,189,248,0.35), 0 5px 15px -5px rgba(244,114,182,0.30), inset 0 1px 2px rgba(255,255,255,0.90)'
                    : hoveredPlan === plan.id
                    ? '0 12px 24px -8px rgba(56,189,248,0.25), 0 4px 12px -4px rgba(244,114,182,0.20), inset 0 1px 1px rgba(255,255,255,0.80)'
                    : 'inset 0 1px 1px rgba(255,255,255,0.65)',
                  transform: isSelected
                    ? 'translateY(-6px) scale(1.02)'
                    : hoveredPlan === plan.id
                    ? 'translateY(-4px) scale(1.01)'
                    : 'translateY(0) scale(1)',
                  outline: isSelected ? '2px solid rgba(56,189,248,0.50)' : 'none',
                  outlineOffset: '2px',
                  transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  willChange: 'transform, box-shadow',
                }}
              >
                {o > d && (
                  <span
                    className="absolute top-2 right-2 text-xs font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(22,163,74,0.10)', color: '#16A34A' }}
                  >
                    Save {Math.round((1 - d / o) * 100)}%
                  </span>
                )}
                {isSelected && (
                  <span
                    className="absolute bottom-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: '#0EA5E9' }}
                  >
                    <Check size={10} color="#ffffff" strokeWidth={3} />
                  </span>
                )}
                <span className="text-sm font-semibold" style={{ color: '#0F172A' }}>{plan.label}</span>
                <span
                  className="display text-lg font-700 tabular"
                  style={isSelected ? {
                    background: 'linear-gradient(90deg, #0EA5E9, #F472B6)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  } : { color: '#1E293B' }}
                >
                  {formatUSDC(finalD)} USDC
                </span>
                {o > d && (
                  <span className="text-xs line-through tabular" style={{ color: '#94A3B8' }}>
                    {formatUSDC(o)} USDC
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
        </div>{/* end ambient mesh wrapper */}
      </motion.div>

      {/* Delivery target */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.14 }}
        className="rounded-2xl p-5 mb-5 card-hover"
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
          border: '1px solid rgba(255,255,255,0.60)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.70), 0 2px 12px rgba(56,189,248,0.06)',
        }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>
          Delivery Details
        </h2>
        <p className="text-xs mb-4 flex items-start gap-1.5" style={{ color: '#94A3B8' }}>
          <Info size={12} className="mt-0.5 flex-shrink-0" style={{ color: '#0EA5E9' }} />
          Enter your handle, username, or email for activation delivery.
        </p>
        <input
          type="text"
          placeholder={
            platform.id.startsWith('x-premium')
              ? '@username or email'
              : platform.id.startsWith('discord')
              ? 'Discord username'
              : platform.id.startsWith('telegram')
              ? '@telegram_username'
              : platform.id.startsWith('youtube')
              ? 'YouTube channel URL or email'
              : 'Email or username'
          }
          value={deliveryTarget}
          onChange={(e) => setDeliveryTarget(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
          style={{
            ...inputBase,
            border: touched && !isValid ? '1px solid rgba(220,38,38,0.50)' : '1px solid rgba(148,163,184,0.25)',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(14,165,233,0.45)')}
          onBlur={(e) => {
            e.currentTarget.style.borderColor =
              touched && !isValid ? 'rgba(220,38,38,0.50)' : 'rgba(148,163,184,0.25)';
          }}
        />
        {touched && !isValid && (
          <p className="text-xs mt-1.5" style={{ color: '#DC2626' }}>
            Please enter your delivery details.
          </p>
        )}
      </motion.div>

      {/* Promo code */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18 }}
        className="rounded-2xl p-5 mb-5 card-hover"
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
          border: '1px solid rgba(255,255,255,0.60)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.70), 0 2px 12px rgba(56,189,248,0.06)',
        }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: '#94A3B8' }}>
          <Tag size={12} />
          Promo Code
          {promoResult?.valid && (
            <span className="normal-case tracking-normal font-medium text-xs" style={{ color: '#16A34A' }}>
              — {promoResult.label}
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter promo code (e.g. ARC10)"
            value={promoInput}
            onChange={(e) => { setPromoInput(e.target.value); if (promoResult) setPromoResult(null); }}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-all uppercase"
            style={{
              ...inputBase,
              background: promoResult?.valid ? 'rgba(22,163,74,0.05)' : '#ffffff',
              border: promoResult?.valid
                ? '1px solid rgba(22,163,74,0.30)'
                : promoTouched && promoResult && !promoResult.valid
                ? '1px solid rgba(220,38,38,0.40)'
                : '1px solid rgba(148,163,184,0.25)',
            }}
          />
          <button
            onClick={handleApplyPromo}
            disabled={!promoInput.trim()}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-40"
            style={{ background: '#0EA5E9' }}
          >
            Apply
          </button>
        </div>
        {promoTouched && promoResult && !promoResult.valid && (
          <p className="text-xs mt-1.5" style={{ color: '#DC2626' }}>
            Invalid code. Try: ARC10, LAUNCH, or USDC5
          </p>
        )}
      </motion.div>

      {/* Referral code */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.22 }}
        className="rounded-2xl p-5 mb-5 card-hover"
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
          border: '1px solid rgba(255,255,255,0.60)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.70), 0 2px 12px rgba(56,189,248,0.06)',
        }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-1 flex items-center gap-2" style={{ color: '#94A3B8' }}>
          <Users size={12} />
          Referral Code
          <span className="normal-case tracking-normal font-medium text-xs" style={{ color: '#0EA5E9' }}>
            — Earn 2.5% credit
          </span>
        </h2>
        <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>
          Have a friend's referral code? Enter it to get a 2.5% USDC credit on your order.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="ARC-XXXXXX"
            value={referralInput}
            onChange={(e) => { setReferralInput(e.target.value.toUpperCase()); if (referralValid) setReferralValid(false); }}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none transition-all font-mono"
            style={{
              ...inputBase,
              background: referralValid ? 'rgba(22,163,74,0.05)' : '#ffffff',
              border: referralValid
                ? '1px solid rgba(22,163,74,0.30)'
                : referralTouched && !referralValid
                ? '1px solid rgba(220,38,38,0.40)'
                : '1px solid rgba(148,163,184,0.25)',
            }}
          />
          <button
            onClick={handleApplyReferral}
            disabled={!referralInput.trim()}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-40"
            style={{ background: '#0EA5E9' }}
          >
            Apply
          </button>
        </div>
        {referralTouched && !referralValid && referralInput && (
          <p className="text-xs mt-1.5" style={{ color: '#DC2626' }}>
            Invalid referral code. Format: ARC-XXXXXX
          </p>
        )}
        {referralValid && (
          <p className="text-xs mt-1.5" style={{ color: '#16A34A' }}>
            Referral applied — {formatUSDC(referralCredit)} USDC credit added!
          </p>
        )}
      </motion.div>

      {/* Order summary */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.26 }}
        className="rounded-2xl p-5 mb-6 card-hover"
        style={{
          background: 'rgba(255,255,255,0.80)',
          backdropFilter: 'blur(24px) saturate(1.9)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.9)',
          border: '1px solid rgba(56,189,248,0.22)',
          boxShadow: '0 4px 20px rgba(56,189,248,0.10), 0 2px 10px rgba(244,114,182,0.08), inset 0 1px 1px rgba(255,255,255,0.75)',
        }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#94A3B8' }}>
          Order Summary
        </h2>
        <div className="flex flex-col gap-2.5">
          <div className="flex justify-between text-sm">
            <span style={{ color: '#64748B' }}>{platform.name} — {selectedPlan.label}</span>
            <span className="tabular" style={{ color: '#0F172A' }}>{formatUSDC(original)} USDC</span>
          </div>
          {original > planDiscounted && (
            <div className="flex justify-between text-sm">
              <span style={{ color: '#16A34A' }}>Bundle discount</span>
              <span className="tabular" style={{ color: '#16A34A' }}>-{formatUSDC(original - planDiscounted)} USDC</span>
            </div>
          )}
          {promoResult?.valid && promoExtra > 0 && (
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1" style={{ color: '#16A34A' }}>
                <Tag size={11} />
                Promo ({promoExtra}%)
              </span>
              <span className="tabular" style={{ color: '#16A34A' }}>
                -{formatUSDC(planDiscounted * (promoExtra / 100))} USDC
              </span>
            </div>
          )}
          {referralCredit > 0 && (
            <div className="flex justify-between text-sm">
              <span className="flex items-center gap-1" style={{ color: '#16A34A' }}>
                <Users size={11} />
                Referral credit
              </span>
              <span className="tabular" style={{ color: '#16A34A' }}>-{formatUSDC(referralCredit)} USDC</span>
            </div>
          )}
          <div
            className="flex justify-between pt-2.5 border-t"
            style={{ borderColor: 'rgba(148,163,184,0.15)' }}
          >
            <span className="font-semibold" style={{ color: '#0F172A' }}>Total</span>
            <span className="display font-700 tabular" style={{ color: '#0EA5E9' }}>
              {formatUSDC(finalPrice)} USDC
            </span>
          </div>
        </div>
      </motion.div>

      {/* CTA */}
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleProceed}
        className="w-full py-4 rounded-2xl font-semibold text-base text-white transition-all"
        style={{
          background: 'linear-gradient(135deg, #38BDF8, #0EA5E9)',
          boxShadow: '0 8px 32px rgba(14,165,233,0.22)',
        }}
      >
        Continue to Checkout
      </motion.button>
    </div>
  );
}
