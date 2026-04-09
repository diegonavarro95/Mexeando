/**
 * src/components/ui/OlaBadge.tsx
 * Spec §05 — Badge "Ola MX" Verificado (Versión 2026)
 * Merge: v1 completo — v2 no aporta funcionalidad adicional
 *
 * Solo se renderiza, no requiere props (el padre decide si lo monta)
 */

import { ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export default function OlaBadge() {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-1.5 px-3 py-1
                 bg-[#2D6A4F]/10 border border-[#2D6A4F]/30
                 rounded-full backdrop-blur-md shadow-[0_0_15px_rgba(45,106,79,0.1)]"
    >
      {/* Punto de estado activo con pulso */}
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#52B788] opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#52B788]" />
      </span>

      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#52B788]">
        OLA MX
      </span>

      <ShieldCheck size={12} className="text-[#52B788] ml-0.5" strokeWidth={3} />
    </motion.span>
  );
}