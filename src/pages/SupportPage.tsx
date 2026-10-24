import { motion } from 'framer-motion';
import { MessageCircle, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const FAQS = [
  {
    q: 'How long does delivery take?',
    a: 'Activation codes and gift links are typically delivered within minutes of your payment confirming on-chain. The escrow contract notifies the fulfillment system automatically.',
  },
  {
    q: 'What if my order is not fulfilled in 24 hours?',
    a: 'After 24 hours without fulfillment, the "Claim Refund" button becomes active on your order. Visit the Escrow Refund page to withdraw the full USDC amount directly from the smart contract.',
  },
  {
    q: 'How does Arc USDC escrow work?',
    a: 'When you pay, your USDC is locked in a smart contract (ArcEscrow) on Arc Testnet. The funds are only released to the merchant when an admin fulfills the order with your activation code. If unfulfilled, you reclaim the funds via requestRefund().',
  },
  {
    q: 'Which platforms are supported?',
    a: 'Currently: X (Twitter) Premium, Discord Nitro, Discord Nitro Basic, Telegram Premium, YouTube Premium, and Spotify Premium. More platforms will be added soon.',
  },
  {
    q: 'Can I trust the activation codes?',
    a: 'Yes — the delivery data is stored on-chain inside the fulfilled order, so you can verify it at any time via the Arc Testnet explorer. Codes are sourced directly from official platform reseller channels.',
  },
  {
    q: 'What wallet do I need?',
    a: "Any browser-based wallet that supports Arc Testnet (Chain ID 5042002) — such as MetaMask. Add the network, get test USDC from the sidebar faucet, and you're ready to buy.",
  },
];

export function SupportPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="display text-2xl font-700 mb-1" style={{ letterSpacing: '-0.03em', color: '#0F172A' }}>
          Support
        </h1>
        <p className="text-sm" style={{ color: '#64748B' }}>
          Frequently asked questions about Premium Create.
        </p>
      </motion.div>

      {/* Contact strip */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
        className="flex items-center gap-4 p-4 rounded-2xl card-hover-sm"
        style={{
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(20px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
          border: '1px solid rgba(56,189,248,0.22)',
          boxShadow: '0 4px 16px rgba(56,189,248,0.10), inset 0 1px 1px rgba(255,255,255,0.70)',
        }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(14,165,233,0.10)' }}>
          <MessageCircle size={18} style={{ color: '#0EA5E9' }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: '#0F172A' }}>Need direct help?</p>
          <p className="text-xs" style={{ color: '#64748B' }}>Open a support ticket or chat with our team.</p>
        </div>
        <a
          href="https://explorer.testnet.arc.io"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all flex-shrink-0"
          style={{ background: '#0EA5E9', color: '#ffffff' }}
        >
          Explorer
          <ExternalLink size={11} />
        </a>
      </motion.div>

      {/* FAQ accordion */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="flex flex-col gap-2">
        {FAQS.map((faq, i) => (
          <FaqItem key={i} q={faq.q} a={faq.a} delay={i * 0.04} />
        ))}
      </motion.div>
    </div>
  );
}

function FaqItem({ q, a, delay }: { q: string; a: string; delay: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="rounded-xl overflow-hidden card-hover-sm"
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${open ? 'rgba(56,189,248,0.32)' : 'rgba(255,255,255,0.55)'}`,
        boxShadow: open
          ? '0 8px 20px rgba(56,189,248,0.12), 0 4px 10px rgba(244,114,182,0.08), inset 0 1px 1px rgba(255,255,255,0.70)'
          : 'inset 0 1px 1px rgba(255,255,255,0.65)',
      }}
    >
      <button
        className="w-full flex items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-slate-50"
        onClick={() => setOpen((v) => !v)}
      >
        <p className="text-sm font-medium leading-snug" style={{ color: '#0F172A' }}>{q}</p>
        {open ? (
          <ChevronUp size={15} style={{ color: '#0EA5E9', flexShrink: 0 }} />
        ) : (
          <ChevronDown size={15} style={{ color: '#94A3B8', flexShrink: 0 }} />
        )}
      </button>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
          className="px-4 pb-4" style={{ borderTop: '1px solid rgba(148,163,184,0.12)' }}
        >
          <p className="text-sm leading-relaxed pt-3" style={{ color: '#64748B' }}>{a}</p>
        </motion.div>
      )}
    </motion.div>
  );
}
