import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Home,
  ShoppingBag,
  ListOrdered,
  ShieldCheck,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Settings2,
} from 'lucide-react';
import { ConnectKitButton } from 'connectkit';
import type { Page } from '../types';

/* ─────────────────────────────────────────────────────────────
   LIGHT GLASS PALETTE — 100 % opaque backgrounds, zero bleed
   ───────────────────────────────────────────────────────────── */
const BG        = '#ffffff';          // solid white face
const BG_HOVER  = '#f0f9ff';          // sky-50 hover tint
const BG_ACTIVE = '#e0f2fe';          // sky-100 active tint
const BORDER    = '#e2e8f0';          // slate-200
const ACT_TEXT  = '#0284c7';          // sky-600
const ACT_BORDER = '#38bdf8';         // sky-400
const PINK_DOT  = '#f472b6';          // pastel-pink accent
const TEXT_HEAD = '#0f172a';          // slate-900 headings
const TEXT_BODY = '#1e293b';          // slate-800 nav labels
const TEXT_MUTE = '#64748b';          // slate-500 subtext
const ICON_DEF  = '#38bdf8';          // sky-400 icons

/* Gradient mesh orb colours (painted as a decorative layer, never
   behind text — always below the solid white face) */
const MESH_SKY  = 'rgba(56,189,248,0.12)';
const MESH_PINK = 'rgba(244,114,182,0.10)';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  isAdmin?: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const NAV_ITEMS: {
  page: Page;
  label: string;
  icon: React.ElementType;
  dividerBefore?: boolean;
}[] = [
  { page: 'home',    label: 'Home',          icon: Home },
  { page: 'catalog', label: 'Browse Store',  icon: ShoppingBag },
  { page: 'orders',  label: 'My Orders',     icon: ListOrdered },
  { page: 'refund',  label: 'Escrow Refund', icon: ShieldCheck },
  { page: 'support', label: 'Support',       icon: HelpCircle },
  { page: 'admin',   label: 'Admin',         icon: Settings2, dividerBefore: true },
];

export function Sidebar({
  currentPage,
  onNavigate,
  isAdmin = false,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const handleNav = (page: Page) => {
    onNavigate(page);
    onMobileClose();
  };

  return (
    <>
      {/* ── Mobile backdrop — dims page content completely ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mob-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onMobileClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40,
              backgroundColor: 'rgba(0,0,0,0.60)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            key="mob-drawer"
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: 280,
              zIndex: 9999,
              /* 100 % opaque white face — NO alpha */
              backgroundColor: BG,
              borderRight: `1px solid ${BORDER}`,
              boxShadow: '6px 0 40px rgba(0,0,0,0.18)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Decorative gradient mesh painted as a pseudo-layer BEHIND the content
                but inside the opaque container — creates depth without bleeding */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 0,
                background: `
                  radial-gradient(ellipse 200px 200px at 10% 15%,  ${MESH_SKY}  0%, transparent 70%),
                  radial-gradient(ellipse 180px 180px at 85% 80%, ${MESH_PINK} 0%, transparent 70%)
                `,
              }}
            />

            {/* Close button */}
            <button
              onClick={onMobileClose}
              aria-label="Close menu"
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 32,
                height: 32,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: TEXT_MUTE,
                background: BG_HOVER,
                border: `1px solid ${BORDER}`,
                cursor: 'pointer',
                zIndex: 2,
              }}
            >
              <X size={16} />
            </button>

            {/* Content sits above the mesh layer */}
            <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <SidebarContent
                currentPage={currentPage}
                onNavigate={handleNav}
                collapsed={false}
                isAdmin={isAdmin}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Desktop sidebar — plain div wrapper so Tailwind `hidden` is never overridden ── */}
      <div
        className="hidden lg:block flex-shrink-0"
        style={{
          width: collapsed ? 68 : 240,
          transition: 'width 0.26s cubic-bezier(0.32,0.72,0,1)',
          height: '100dvh',
          position: 'sticky',
          top: 0,
          zIndex: 30,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: BG,
            borderRight: `1px solid ${BORDER}`,
            boxShadow: '2px 0 16px rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Decorative mesh inside desktop sidebar */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 0,
              background: `
                radial-gradient(ellipse 160px 160px at 20% 10%,  ${MESH_SKY}  0%, transparent 70%),
                radial-gradient(ellipse 140px 140px at 80% 90%, ${MESH_PINK} 0%, transparent 70%)
              `,
            }}
          />

          <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <SidebarContent
              currentPage={currentPage}
              onNavigate={handleNav}
              collapsed={collapsed}
              isAdmin={isAdmin}
            />
          </div>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              position: 'absolute',
              right: -12,
              top: 32,
              width: 24,
              height: 24,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: BG,
              border: `1px solid ${BORDER}`,
              color: ACT_TEXT,
              cursor: 'pointer',
              zIndex: 10,
              boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
            }}
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Shared nav content ─── */
function SidebarContent({
  currentPage,
  onNavigate,
  collapsed,
  isAdmin,
}: {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  collapsed: boolean;
  isAdmin: boolean;
}) {
  const visibleItems = NAV_ITEMS.filter((item) => item.page !== 'admin' || isAdmin);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '20px 16px 16px',
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg,#38BDF8,#F472B6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 10px rgba(56,189,248,0.30)',
          }}
        >
          <ShoppingBag size={17} color="#fff" />
        </div>
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.04 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: TEXT_HEAD, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Premium{' '}
              <span
                style={{
                  background: 'linear-gradient(90deg,#38BDF8,#F472B6)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Create
              </span>
            </p>
            <p style={{ fontSize: 11, color: TEXT_MUTE, marginTop: 2 }}>Digital Store</p>
          </motion.div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visibleItems.map((item) => {
            const isActive =
              currentPage === item.page ||
              (item.page === 'home' && (currentPage === 'plan' || currentPage === 'checkout'));
            return (
              <div key={item.page}>
                {item.dividerBefore && (
                  <div style={{ borderTop: `1px solid ${BORDER}`, margin: '8px 4px' }} />
                )}
                <NavItem
                  item={item}
                  isActive={isActive}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              </div>
            );
          })}
        </div>
      </nav>

      {/* Wallet section */}
      <div
        style={{
          padding: '12px 12px 16px',
          borderTop: `1px solid ${BORDER}`,
          flexShrink: 0,
          background: 'linear-gradient(to top, rgba(56,189,248,0.04), transparent)',
        }}
      >
        {collapsed ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ConnectKitButton.Custom>
              {({ isConnected, show }) => (
                <button
                  onClick={show}
                  aria-label="Connect wallet"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isConnected
                      ? 'linear-gradient(135deg,rgba(56,189,248,0.15),rgba(244,114,182,0.10))'
                      : 'linear-gradient(135deg,#38BDF8,#F472B6)',
                    border: `1px solid ${BORDER}`,
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: isConnected ? '#22C55E' : '#fff',
                    }}
                  />
                </button>
              )}
            </ConnectKitButton.Custom>
          </div>
        ) : (
          <ConnectKitButton
            customTheme={{
              '--ck-font-family': "'DM Sans', sans-serif",
              '--ck-primary-button-background': 'linear-gradient(135deg,#38BDF8,#0EA5E9)',
              '--ck-primary-button-hover-background': '#0284C7',
              '--ck-primary-button-color': '#ffffff',
              '--ck-body-background': '#ffffff',
              '--ck-body-color': '#0f172a',
              '--ck-border-radius': '12px',
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Single nav item ─── */
function NavItem({
  item,
  isActive,
  collapsed,
  onNavigate,
}: {
  item: (typeof NAV_ITEMS)[number];
  isActive: boolean;
  collapsed: boolean;
  onNavigate: (page: Page) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const Icon = item.icon;

  return (
    <button
      onClick={() => onNavigate(item.page)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={collapsed ? item.label : undefined}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        width: '100%',
        padding: '10px 12px',
        borderRadius: 12,
        border: 'none',
        borderLeft: isActive ? `3px solid ${ACT_BORDER}` : '3px solid transparent',
        cursor: 'pointer',
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: isActive ? ACT_TEXT : TEXT_BODY,
        backgroundColor: isActive ? BG_ACTIVE : hovered ? BG_HOVER : 'transparent',
        fontSize: 14,
        fontWeight: isActive ? 600 : 500,
        transition: 'all 0.15s ease',
        textAlign: 'left',
      }}
    >
      {/* Pink active dot */}
      {isActive && !collapsed && (
        <span
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: PINK_DOT,
            boxShadow: `0 0 6px ${PINK_DOT}`,
          }}
        />
      )}
      <Icon
        size={17}
        style={{
          flexShrink: 0,
          color: isActive ? ACT_BORDER : ICON_DEF,
          filter: isActive ? 'drop-shadow(0 0 4px rgba(56,189,248,0.40))' : 'none',
        }}
      />
      {!collapsed && (
        <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
      )}
    </button>
  );
}
