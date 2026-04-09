/**
 * src/components/ui/RegisterProgressBar.tsx
 * Barra de progreso táctica para el flujo de registro.
 * Merge: Diseño v1 completo — v2 no aporta funcionalidad adicional
 *
 * DISEÑO    → v1: motion con layoutId glow, animate backgroundColor/scale reactivo,
 *                 w-9 h-9, check animado scale+rotate, línea h-[2px] con shimmer
 *                 de pulso en paso activo siguiente
 * FUNCIONES → v1: numeración `0${step}` (pasos siempre < 9 en registro)
 *                 v2 no aporta nada que v1 no tenga en mejor forma
 */

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface Props {
  currentStep: number; // 1-based
  totalSteps: number;
}

export default function RegisterProgressBar({ currentStep, totalSteps }: Props) {
  return (
    <div className="w-full flex items-center justify-between px-1">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step        = i + 1;
        const isCompleted = step < currentStep;
        const isActive    = step === currentStep;

        return (
          <div
            key={step}
            className={`flex items-center ${step < totalSteps ? 'flex-1' : 'flex-initial'}`}
          >
            {/* ── Indicador de Paso ── */}
            <div className="relative flex items-center justify-center">

              {/* Glow exterior animado para el paso activo */}
              {isActive && (
                <motion.div
                  layoutId="glow"
                  className="absolute inset-0 bg-[#C1121F]/30 blur-md rounded-full scale-150"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}

              <motion.div
                initial={false}
                animate={{
                  backgroundColor: isCompleted
                    ? '#2D6A4F'
                    : isActive
                      ? '#C1121F'
                      : 'rgba(255, 243, 220, 0.05)',
                  borderColor: isCompleted
                    ? '#2D6A4F'
                    : isActive
                      ? '#C1121F'
                      : 'rgba(255, 243, 220, 0.1)',
                  scale: isActive ? 1.15 : 1,
                }}
                className="z-10 w-9 h-9 rounded-full border-2 flex items-center justify-center text-[11px] font-black"
              >
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                  >
                    <Check size={16} strokeWidth={4} className="text-white" />
                  </motion.div>
                ) : (
                  <span className={isActive ? 'text-white' : 'text-white/20'}>
                    0{step}
                  </span>
                )}
              </motion.div>
            </div>

            {/* ── Línea de Conexión con shimmer de pulso ── */}
            {step < totalSteps && (
              <div className="flex-1 mx-2 h-[2px] bg-white/5 relative overflow-hidden rounded-full">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: isCompleted ? '100%' : '0%' }}
                  transition={{ duration: 0.8, ease: 'easeInOut' }}
                  className="absolute h-full bg-[#2D6A4F] shadow-[0_0_8px_#2D6A4F]"
                />
                {/* Shimmer de pulso si el siguiente paso es el activo */}
                {isActive && (
                  <motion.div
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                    className="absolute h-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}