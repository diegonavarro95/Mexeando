/**
 * src/components/StampGrid.tsx
 * D-7 — Rejilla de Estampas / Pasaporte (Merge: Diseño v1 + raridades/UX de v2)
 *
 * DISEÑO    → v1: motion.button con stagger delay, rounded-2xl, gap-3, backdrop-blur-sm,
 *                 grayscale+opacity-40 en locked con gradiente overlay, Sparkles en legendary,
 *                 hover group con scale-110 en icono, nombre en absolute bottom-2,
 *                 efecto brillo hover via-white/5, colores text en rarityConfig
 * FUNCIONES → v2: glow más intenso (/70, /80), nombre visible en estampas bloqueadas,
 *                 hover:scale-105 + active:scale-95 (más táctil que solo active:scale-90)
 */

import { Lock, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import type { StampCollection } from '../store/passportStore'
import { isStampImageSource } from '../lib/passportCatalog'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Stamp = StampCollection['stamps'][number] & {
  rarity?: 'common' | 'rare' | 'epic' | 'legendary'
  description?: string
}

interface StampGridProps {
  stamps: Stamp[]
  cols?: 3 | 4 | 5
  showLocked?: boolean
  onStampClick?: (stamp: Stamp) => void
  className?: string
}

// ─── Configuración de Rarezas ─────────────────────────────────────────────────
// Bordes/glow más intensos de v2, colores de texto y badge de v1

const rarityConfig = {
  common: {
    border: 'border-white/10',
    glow:   '',
    badge:  'bg-white/10 text-white/40',
    label:  'C',
    color:  'text-white/20',
  },
  rare: {
    border: 'border-[#2D6A4F]/70',                          // intensidad de v2
    glow:   'shadow-[0_0_12px_rgba(45,106,79,0.4)]',        // intensidad de v2
    badge:  'bg-[#2D6A4F]/20 text-[#52B788]',
    label:  'R',
    color:  'text-[#52B788]',
  },
  epic: {
    border: 'border-[#C1121F]/70',                          // intensidad de v2
    glow:   'shadow-[0_0_12px_rgba(193,18,31,0.4)]',        // intensidad de v2
    badge:  'bg-[#C1121F]/20 text-[#C1121F]',
    label:  'E',
    color:  'text-[#C1121F]',
  },
  legendary: {
    border: 'border-[#F4A300]/80',                          // intensidad de v2
    glow:   'shadow-[0_0_18px_rgba(244,163,0,0.5)]',        // intensidad de v2
    badge:  'bg-[#F4A300]/20 text-[#F4A300]',
    label:  'L',
    color:  'text-[#F4A300]',
  },
}

const colsMap: Record<3 | 4 | 5, string> = {
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function StampGrid({
  stamps,
  cols = 4,
  showLocked = true,
  onStampClick,
  className = '',
}: StampGridProps) {
  const visible = showLocked ? stamps : stamps.filter((s) => s.obtained)

  return (
    <div className={`grid ${colsMap[cols]} gap-3 ${className}`}>
      {visible.map((stamp, index) => {
        const rarity    = stamp.rarity ?? 'common'
        const rCfg      = rarityConfig[rarity]
        const isObtained = stamp.obtained

        return (
          <motion.button
            key={stamp.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.03 }}   // stagger de v1
            onClick={() => onStampClick?.(stamp)}
            className={`
              relative flex flex-col items-center justify-center
              aspect-square rounded-2xl border transition-all duration-300
              ${isObtained
                ? `${rCfg.border} ${rCfg.glow} bg-white/5 backdrop-blur-sm`
                : 'border-white/5 bg-black/40 grayscale opacity-40'
              }
              ${onStampClick
                ? 'cursor-pointer hover:scale-105 active:scale-95 hover:border-white/30'
                : 'cursor-default'
              }
            `}
          >
            {isObtained ? (
              <>
                {/* ── Icono / Imagen ── */}
                <div className="absolute inset-0 w-full h-full overflow-hidden rounded-2xl group">
                  {rarity === 'legendary' && (
                    <Sparkles
                      size={12}
                      className="absolute top-2 right-2 text-[#F4A300] animate-pulse z-20"
                    />
                  )}
                  {isStampImageSource(stamp.icon) ? (
                    <img
                      src={stamp.icon}
                      alt={stamp.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex w-full h-full items-center justify-center">
                      <span className="text-3xl leading-none select-none drop-shadow-md group-hover:scale-110 transition-transform block">
                        {stamp.icon}
                      </span>
                    </div>
                  )}
                  {/* Gradiente oscuro en la parte inferior para que el texto sea legible */}
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                </div>

                {/* ── Badge de Rareza ── */}
                <span
                  className={`absolute z-10 top-1.5 right-1.5 text-[7px] font-black px-1.5 py-0.5 rounded-full leading-none shadow-sm backdrop-blur-md ${rCfg.badge}`}
                >
                  {rCfg.label}
                </span>

                {/* ── Nombre ── */}
                <span className="absolute z-10 bottom-2 text-[8px] font-black uppercase tracking-wider text-white truncate w-[90%] text-center drop-shadow-md">
                  {stamp.name}
                </span>
              </>
            ) : (
              <>
                <Lock size={16} className="text-white/10 mb-1" />
                {/* Nombre visible en bloqueadas (UX de v2: el usuario sabe qué le falta) */}
                <span className="text-[7px] font-black uppercase tracking-tighter text-white/20 truncate w-[80%] text-center mt-0.5">
                  {stamp.name}
                </span>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-2xl pointer-events-none" />
              </>
            )}

            {/* Brillo hover para estampas obtenidas */}
            {isObtained && (
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
