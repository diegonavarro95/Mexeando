/**
 * src/components/ui/BottomNav.tsx
 * Spec §05 — Barra de navegación táctica (Turista 2026)
 * Merge: Diseño v2 (inline) + iconos fill/outline dinámicos de v1
 *
 * DISEÑO    → v2: motion layoutId dot animado, h-20, shadow inferior, border-white/5,
 *                 icono scale-110 + drop-shadow glow + strokeWidth dinámico,
 *                 label text-white activo, group-hover, whileTap overlay, z-50
 * FUNCIONES → v1: iconos SVG con fill/stroke dinámico (filled cuando activo,
 *                 outline cuando inactivo) — feedback visual más rico que solo color
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: (active: boolean) => React.ReactNode;
}

// ─── Iconos SVG con fill/stroke dinámico (de v1) ─────────────────────────────

const NAV_ITEMS: NavItem[] = [
  {
    id: 'explore',
    label: 'Inicio',
    path: '/feed',
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-all duration-300 ${active ? 'drop-shadow-[0_0_5px_rgba(193,18,31,0.4)]' : ''}`}
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
      >
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    id: 'map',
    label: 'Mapa',
    path: '/explore',
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-all duration-300 ${active ? 'drop-shadow-[0_0_5px_rgba(193,18,31,0.4)]' : ''}`}
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
      >
        <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    id: 'chat',
    label: 'Chat',
    path: '/chat',
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-all duration-300 ${active ? 'drop-shadow-[0_0_5px_rgba(193,18,31,0.4)]' : ''}`}
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
      >
        <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    id: 'passport',
    label: 'Pasaporte',
    path: '/passport',
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-all duration-300 ${active ? 'drop-shadow-[0_0_5px_rgba(193,18,31,0.4)]' : ''}`}
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
      >
        <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: 'profile',
    label: 'Perfil',
    path: '/profile',
    icon: (active) => (
      <svg
        className={`w-5 h-5 transition-all duration-300 ${active ? 'drop-shadow-[0_0_5px_rgba(193,18,31,0.4)]' : ''}`}
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
      >
        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

// ─── Componente ───────────────────────────────────────────────────────────────

interface Props {
  activeTab?: string;
}

export default function BottomNav({ activeTab }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  // Detección inteligente de tab activa por pathname
  const currentTab = activeTab ?? (() => {
    const path = location.pathname;
    if (path.startsWith('/feed'))     return 'explore';
    if (path.startsWith('/explore'))  return 'map';
    if (path.startsWith('/chat'))     return 'chat';
    if (path.startsWith('/passport')) return 'passport';
    if (path.startsWith('/profile'))  return 'profile';
    return 'explore';
  })();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto flex h-[4.5rem] max-w-xl items-center justify-around border-t border-white/5 bg-[#110800]/80 px-1 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:h-20 sm:px-2">

        {NAV_ITEMS.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="group relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2 outline-none sm:px-3"
            >
              {/* ── Dot indicador animado (de v2) ── */}
              {isActive && (
                <motion.div
                  layoutId="navIndicator"
                  className="absolute -top-2 w-1 h-1 bg-[#C1121F] rounded-full shadow-[0_0_8px_#C1121F]"
                />
              )}

              {/* ── Icono con escala + color (de v2) + fill dinámico (de v1) ── */}
              <div className={`transition-all duration-300 ${
                isActive
                  ? 'text-[#C1121F] scale-110'
                  : 'text-white/20 group-hover:text-white/40'
              }`}>
                {item.icon(isActive)}
              </div>

              {/* ── Label ── */}
              <span className={`max-w-full truncate text-[8px] font-black uppercase tracking-[0.08em] transition-colors duration-300 sm:text-[9px] sm:tracking-[0.1em] ${
                isActive ? 'text-white' : 'text-white/20'
              }`}>
                {item.label}
              </span>

              {/* ── Feedback táctil (de v2) ── */}
              <motion.div
                whileTap={{ scale: 0.8 }}
                className="absolute inset-0 rounded-xl"
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
