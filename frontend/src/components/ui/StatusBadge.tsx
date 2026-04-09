/**
 * src/components/ui/StatusBadge.tsx
 * Spec §05 — Badge de estado operativo (Versión 2026)
 * Indica la validez del negocio en la plataforma.
 */
import { motion } from 'framer-motion';

export type BusinessStatus = 'active' | 'pending' | 'rejected' | 'inactive';

interface Props {
  status: BusinessStatus;
}

const CONFIG: Record<BusinessStatus, { 
  label: string; 
  dot: string; 
  bg: string; 
  border: string; 
  text: string 
}> = {
  active: {
    label: 'En Línea',
    dot: '#52B788',
    bg: 'rgba(45,106,79,0.18)',
    border: 'rgba(45,106,79,0.5)',
    text: '#52B788',
  },
  pending: {
    label: 'Revisión',
    dot: '#F4A300',
    bg: 'rgba(244,163,0,0.15)',
    border: 'rgba(244,163,0,0.45)',
    text: '#F4A300',
  },
  rejected: {
    label: 'Rechazado',
    dot: '#C1121F',
    bg: 'rgba(193,18,31,0.15)',
    border: 'rgba(193,18,31,0.45)',
    text: '#ff6b6b',
  },
  inactive: {
    label: 'Pausado',
    dot: '#6b6375',
    bg: 'rgba(107,99,117,0.15)',
    border: 'rgba(107,99,117,0.35)',
    text: '#9ca3af',
  },
};

export default function StatusBadge({ status }: Props) {
  const cfg = CONFIG[status] ?? CONFIG.inactive;
  const isActive = status === 'active';

  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full border backdrop-blur-md transition-all duration-300 shadow-sm"
      style={{
        background: cfg.bg,
        borderColor: cfg.border,
        color: cfg.text,
      }}
    >
      {/* ── Punto de Estado Animado ── */}
      <div className="relative flex items-center justify-center">
        {isActive && (
          <motion.div
            animate={{ scale: [1, 2], opacity: [0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            className="absolute w-2 h-2 rounded-full"
            style={{ background: cfg.dot }}
          />
        )}
        <div
          className="relative w-1.5 h-1.5 rounded-full"
          style={{ background: cfg.dot }}
        />
      </div>

      {/* ── Etiqueta ── */}
      <span className="text-[9px] font-black uppercase tracking-[0.2em] leading-none">
        {cfg.label}
      </span>
    </div>
  );
}