import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ConnectKitButton } from 'connectkit';
import { useAccount } from 'wagmi';
import { Menu } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { DashboardHome } from './pages/DashboardHome';
import { CatalogPage } from './pages/CatalogPage';
import { PlanPage } from './pages/PlanPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrdersPage } from './pages/OrdersPage';
import { RefundPage } from './pages/RefundPage';
import { SupportPage } from './pages/SupportPage';
import { AdminPage } from './pages/AdminPage';
import type { OrderSummary, Page, Platform } from './types';

const pageVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export default function App() {
  const { isConnected, address } = useAccount();

  // Admin/merchant wallet — only this address sees the Admin nav item and can access AdminPage
  const ADMIN_WALLET = (import.meta.env.VITE_MERCHANT_WALLET as string | undefined)?.toLowerCase();
  const isAdmin = Boolean(
    isConnected && address && ADMIN_WALLET && address.toLowerCase() === ADMIN_WALLET,
  );
  const [page, setPage] = useState<Page>('home');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);
  const [activePromoCode, setActivePromoCode] = useState<string | undefined>();
  const [activePromoDiscount, setActivePromoDiscount] = useState<number | undefined>();
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);

  // Derive the effective page: if a non-admin is on the admin page (e.g. wallet disconnected
  // mid-session), treat it as 'home' for rendering purposes without mutating state in an effect.
  const effectivePage: Page = page === 'admin' && !isAdmin ? 'home' : page;

  const navigate = useCallback((target: Page) => {
    // Silently drop navigation to admin for non-admins
    if (target === 'admin' && !isAdmin) return;
    setPage(target);
    const main = document.getElementById('dashboard-main');
    if (main) main.scrollTop = 0;
  }, [isAdmin]);

  const handleSelectPlatform = useCallback(
    (platform: Platform, promoCode?: string, promoDiscount?: number) => {
      setSelectedPlatform(platform);
      setActivePromoCode(promoCode);
      setActivePromoDiscount(promoDiscount);
      navigate('plan');
    },
    [navigate],
  );

  const handleProceedToCheckout = useCallback(
    (summary: OrderSummary) => {
      setOrderSummary(summary);
      navigate('checkout');
    },
    [navigate],
  );

  const handleOrderComplete = useCallback(() => {
    // Bump refresh key so OrdersPage re-fetches immediately when navigated to
    setOrdersRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="flex min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      {/* Ambient gradient mesh — fixed sky+pink radial orbs for glass refraction */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div style={{
          position: 'absolute', top: '-10%', left: '-5%', width: '55%', height: '55%',
          background: 'radial-gradient(ellipse, rgba(56,189,248,0.13) 0%, transparent 70%)',
          filter: 'blur(48px)',
        }} />
        <div style={{
          position: 'absolute', top: '30%', right: '-8%', width: '45%', height: '45%',
          background: 'radial-gradient(ellipse, rgba(244,114,182,0.11) 0%, transparent 70%)',
          filter: 'blur(48px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-5%', left: '25%', width: '50%', height: '40%',
          background: 'radial-gradient(ellipse, rgba(56,189,248,0.09) 0%, rgba(244,114,182,0.07) 50%, transparent 70%)',
          filter: 'blur(56px)',
        }} />
      </div>
      {/* LEFT SIDEBAR — no wrapper div; mobile drawer/backdrop are fixed so no stacking context needed */}
      <Sidebar
        currentPage={effectivePage}
        onNavigate={navigate}
        isAdmin={isAdmin}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* MAIN CONTENT */}
      <div
        id="dashboard-main"
        className="flex-1 min-w-0 overflow-y-auto"
        style={{ maxHeight: '100dvh', isolation: 'isolate' }}
      >
        {/* Top header bar */}
        <div
          className="sticky top-0 z-30 flex items-center gap-3 px-4 h-14"
          style={{
            background: 'rgba(255,255,255,0.80)',
            backdropFilter: 'blur(28px) saturate(1.9)',
            WebkitBackdropFilter: 'blur(28px) saturate(1.9)',
            borderBottom: '1px solid rgba(255,255,255,0.55)',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.70), 0 1px 12px rgba(56,189,248,0.08)',
          }}
        >
          {/* ── Hamburger (mobile only, lg:hidden) ──────────────────────────── */}
          <button
            className="lg:hidden flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-95"
            style={{
              background: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(56,189,248,0.22)',
              boxShadow: '0 2px 8px rgba(56,189,248,0.12), inset 0 1px 1px rgba(255,255,255,0.80)',
            }}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Open navigation menu"
          >
            <Menu size={19} style={{ color: '#0EA5E9' }} />
          </button>

          {/* ── Mobile app title (center, hidden on lg+) ─────────────────────── */}
          <div className="lg:hidden flex-1 flex items-center min-w-0">
            <span
              className="display text-sm font-700 truncate"
              style={{ letterSpacing: '-0.02em', color: '#0F172A' }}
            >
              Premium <span style={{ color: '#0EA5E9' }}>Create</span>
            </span>
          </div>

          {/* ── Desktop spacer ───────────────────────────────────────────────── */}
          <div className="hidden lg:flex flex-1" />

          {/* ── Network status pill ──────────────────────────────────────────── */}
          {isConnected && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full mr-1 text-xs font-medium flex-shrink-0"
              style={{
                background: 'rgba(22,163,74,0.08)',
                border: '1px solid rgba(22,163,74,0.20)',
                color: '#16A34A',
              }}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                  style={{ background: '#16A34A' }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ background: '#16A34A' }}
                />
              </span>
              Arc Testnet
            </motion.div>
          )}

          {/* ── Connect Wallet ───────────────────────────────────────────────── */}
          <div className="flex-shrink-0">
            <ConnectKitButton
              customTheme={{
                '--ck-font-family': "'DM Sans', sans-serif",
                '--ck-primary-button-background': '#0EA5E9',
                '--ck-primary-button-hover-background': '#0284C7',
                '--ck-primary-button-color': '#ffffff',
                '--ck-body-background': '#ffffff',
                '--ck-body-color': '#0F172A',
                '--ck-border-radius': '12px',
              }}
            />
          </div>
        </div>

        <main className="px-5 md:px-8 py-6 md:py-8 max-w-4xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={effectivePage}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {effectivePage === 'home' && <DashboardHome onNavigate={navigate} />}

              {effectivePage === 'catalog' && (
                <CatalogPage
                  onSelectPlatform={handleSelectPlatform}
                  onNavigate={navigate}
                />
              )}

              {effectivePage === 'plan' && selectedPlatform && (
                <PlanPage
                  platform={selectedPlatform}
                  onNavigate={navigate}
                  onProceedToCheckout={handleProceedToCheckout}
                  initialPromoCode={activePromoCode}
                  initialPromoDiscount={activePromoDiscount}
                />
              )}
              {effectivePage === 'plan' && !selectedPlatform && (
                <div className="flex items-center justify-center min-h-64">
                  <button
                    onClick={() => navigate('catalog')}
                    className="text-sm transition-colors"
                    style={{ color: '#0EA5E9' }}
                  >
                    Please select a platform first
                  </button>
                </div>
              )}

              {effectivePage === 'checkout' && orderSummary && (
                <CheckoutPage
                  summary={orderSummary}
                  onNavigate={navigate}
                  onOrderComplete={handleOrderComplete}
                />
              )}
              {effectivePage === 'checkout' && !orderSummary && (
                <div className="flex items-center justify-center min-h-64">
                  <button
                    onClick={() => navigate('catalog')}
                    className="text-sm transition-colors"
                    style={{ color: '#0EA5E9' }}
                  >
                    Please select a plan first
                  </button>
                </div>
              )}

              {effectivePage === 'orders' && <OrdersPage onNavigate={navigate} refreshKey={ordersRefreshKey} />}
              {effectivePage === 'refund' && <RefundPage />}
              {effectivePage === 'support' && <SupportPage />}
              {effectivePage === 'admin' && isAdmin && <AdminPage />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
