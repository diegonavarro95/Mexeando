/**
 * src/components/PointsCounter.tsx
 * Componente de visualización de puntaje y gamificación.
 * Merge: Diseño v1 (doc) + easing easeOutCubic y texto de progreso de v2
 *
 * DISEÑO    → v1: easeOutExpo, w-full/max-w-xs, justify-between, tipografía italic,
 *                 glow+scale+drop-shadow en icono ready, Sparkles con motion,
 *                 barra con motion.div + shimmer, labels "Energía Acumulada" /
 *                 "¡SOBRE LISTO!" / "X faltantes", fix textContent inicial
 * FUNCIONES → v2: easing easeOutCubic (1-(1-p)³) como alternativa más suave,
 *                 texto de progreso más descriptivo ("pts para el siguiente sobre"),
 *                 duration 800ms para animaciones cortas
 */

import { useEffect, useRef } from 'react'
import { Zap, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

interface PointsCounterProps {
  points: number
  threshold?: number
  animated?: boolean
  size?: 'sm' | 'md' | 'lg'
  showProgress?: boolean
  className?: string
}

export default function PointsCounter({
  points,
  threshold = 200,
  animated = true,
  size = 'md',
  showProgress = false,
  className = '',
}: PointsCounterProps) {
  const prevRef    = useRef(0)
  const displayRef = useRef<HTMLSpanElement>(null)

  // ── Animación de Conteo ──────────────────────────────────────────────────
  // easeOutCubic (de v2): más suave y natural para incrementos pequeños
  useEffect(() => {
    if (!animated || !displayRef.current) {
      prevRef.current = points
      if (displayRef.current) displayRef.current.textContent = points.toLocaleString('es-MX')
      return
    }

    const start    = prevRef.current
    const end      = points || 0
    const duration = 800 // ms — de v2, snappy sin perder suavidad
    const startTime = performance.now()

    const step = (now: number) => {
      const elapsed  = now - startTime
      const progress = Math.min(elapsed / duration, 1)

      // easeOutCubic: frenado natural, excelente para rangos pequeños (de v2)
      const eased   = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(start + (end - start) * eased)

      if (displayRef.current) {
        displayRef.current.textContent = current.toLocaleString('es-MX')
      }

      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        prevRef.current = end
      }
    }
    requestAnimationFrame(step)
  }, [points, animated])

  // ── Configuración de Escala (de v1: tipografía italic + tamaños mayores) ──
  const sizeMap = {
    sm: { wrapper: 'px-3 py-1.5 gap-1.5', icon: 14, text: 'text-sm font-black',            label: 'text-[9px]' },
    md: { wrapper: 'px-4 py-2   gap-2',   icon: 18, text: 'text-2xl font-black italic',     label: 'text-[10px]' },
    lg: { wrapper: 'px-6 py-3   gap-3',   icon: 24, text: 'text-4xl font-black italic',     label: 'text-xs' },
  }

  const cfg     = sizeMap[size]
  const pct     = Math.min(((points || 0) / threshold) * 100, 100)
  const isReady = (points || 0) >= threshold

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={`inline-flex flex-col gap-2 w-full max-w-xs ${className}`}>

      {/* ── Badge del Contador ── */}
      <div
        className={`relative overflow-hidden flex items-center justify-between ${cfg.wrapper} rounded-2xl border transition-all duration-500 ${
          isReady
            ? 'bg-[#F4A300]/10 border-[#F4A300] shadow-[0_0_20px_rgba(244,163,0,0.2)]'
            : 'bg-white/5 border-white/10 shadow-inner'
        }`}
      >
        <div className="flex items-center gap-2 z-10">
          <Zap
            size={cfg.icon}
            className={`shrink-0 transition-all duration-500 ${
              isReady
                ? 'text-[#F4A300] scale-110 drop-shadow-[0_0_8px_#F4A300]'
                : 'text-white/20'
            }`}
            fill={isReady ? '#F4A300' : 'transparent'}
          />
          <div className="flex items-baseline gap-1">
            <span
              ref={displayRef}
              className={`${cfg.text} text-white tracking-tighter tabular-nums drop-shadow-md`}
            >
              {prevRef.current.toLocaleString('es-MX')}
            </span>
            <span className={`${cfg.label} font-black uppercase tracking-[0.2em] text-white/30`}>
              PTS
            </span>
          </div>
        </div>

        {isReady && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="z-10"
          >
            <Sparkles size={16} className="text-[#F4A300] animate-pulse" />
          </motion.div>
        )}
      </div>

      {/* ── Barra de Progreso ── */}
      {showProgress && (
        <div className="space-y-1.5 px-1">
          <div className="flex justify-between items-center">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20">
              Energía Acumulada
            </p>
            <p className={`text-[9px] font-black uppercase tracking-widest ${isReady ? 'text-[#52B788]' : 'text-white/40'}`}>
              {isReady
                ? '¡Listo para abrir sobre!'                                    // texto de v2, más claro
                : `${Math.max(threshold - (points || 0), 0)} pts para el siguiente sobre`  // de v2
              }
            </p>
          </div>

          <div className="relative w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="h-full rounded-full relative"
              style={{
                background: isReady
                  ? 'linear-gradient(90deg, #F4A300, #FFE6A7)'
                  : 'linear-gradient(90deg, #C1121F, #F4A300)',
              }}
            >
              {/* Shimmer en la barra */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </motion.div>
          </div>
        </div>
      )}
    </div>
  )
}