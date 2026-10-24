import { ConnectKitButton } from 'connectkit';
import { motion } from 'framer-motion';
import { ShoppingBag, ListOrdered } from 'lucide-react';
import type { Page } from '../types';

interface NavbarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function Navbar({ currentPage, onNavigate }: NavbarProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-50 w-full"
      style={{
        background: 'rgba(11, 15, 23, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 182, 193, 0.10)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2.5 group"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #FFB6C1, #FF69B4)' }}
          >
            <ShoppingBag size={16} className="text-gray-900" />
          </div>
          <span className="display text-base font-700 tracking-tight text-white">
            Arc <span style={{ color: '#FFB6C1' }}>Premium</span>
          </span>
        </button>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {(['catalog', 'orders'] as Page[]).map((page) => (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all"
              style={{
                color: currentPage === page ? '#FFB6C1' : '#94a3b8',
                background: currentPage === page ? 'rgba(255, 182, 193, 0.08)' : 'transparent',
              }}
            >
              {page === 'catalog' ? 'Store' : 'My Orders'}
            </button>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('orders')}
            className="md:hidden p-2 rounded-lg transition-colors"
            style={{ color: '#94a3b8' }}
            aria-label="My Orders"
          >
            <ListOrdered size={18} />
          </button>
          <ConnectKitButton
            customTheme={{
              '--ck-font-family': "'DM Sans', sans-serif",
              '--ck-primary-button-background': '#FFB6C1',
              '--ck-primary-button-hover-background': '#FF69B4',
              '--ck-primary-button-color': '#0B0F17',
              '--ck-body-background': '#141926',
              '--ck-body-color': '#f9faf3',
              '--ck-border-radius': '12px',
            }}
          />
        </div>
      </div>
    </motion.header>
  );
}
