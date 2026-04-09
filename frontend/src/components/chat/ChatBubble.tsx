/**
 * src/components/chat/ChatBubble.tsx
 * Spec §05 — Burbuja de Chat Táctica (Versión 2026)
 */
import { motion, type Variants } from 'framer-motion';
import { CheckCheck } from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface ChatBubbleProps {
  message:    string;
  role:       'bot' | 'user';
  timestamp?: string;
}

// ─── Animaciones ─────────────────────────────────────────────────────────────
const bubbleVariants: Variants = {
  hidden: (role: 'bot' | 'user') => ({
    opacity: 0,
    x: role === 'user' ? 20 : -20,
    y: 6,
    scale: 0.95,
  }),
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 380, damping: 28 },
  },
};

// ─── Sub-componente: Avatar del Bot ──────────────────────────────────────────
function BotAvatar() {
  return (
    <div className="relative flex-shrink-0">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center border border-white/10 shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #C1121F, #8b0d14)',
          boxShadow: '0 0 0 2px rgba(193,18,31,0.33)',
          fontSize: 16,
        }}
      >
        🌮
      </div>
      {/* Indicador de IA Activa */}
      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-verde rounded-full border-2 border-bgDark" />
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function ChatBubble({ message, role, timestamp }: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <motion.div
      custom={role}
      variants={bubbleVariants}
      initial="hidden"
      animate="visible"
      className={`flex flex-col mb-4 ${isUser ? 'items-end' : 'items-start'}`}
    >
      <div className={`flex items-end gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>

        {/* Avatar: solo bot */}
        {!isUser && <BotAvatar />}

        {/* ── Burbuja ── */}
        <div
          className={`
            relative px-4 py-3 text-[14.5px] leading-relaxed
            ${isUser
              ? 'text-white rounded-[18px] rounded-br-[4px]'
              : 'text-crema border border-rojo/20 rounded-[4px] rounded-br-[18px] rounded-bl-[18px] rounded-tr-[18px] backdrop-blur-md'
            }
          `}
          style={isUser
            ? {
                background: '#C1121F',
                boxShadow: '0 2px 12px rgba(193,18,31,0.27)',
              }
            : {
                background: '#1e1006',
                boxShadow: '0 1px 6px rgba(0,0,0,0.4)',
              }
          }
        >
          {/* Mensaje con soporte multilínea */}
          <div className="whitespace-pre-wrap break-words font-medium">
            {message}
          </div>

          {/* Gradiente decorativo para burbuja del usuario */}
          {isUser && (
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 rounded-[18px] pointer-events-none" />
          )}
        </div>
      </div>

      {/* ── Timestamp + Status ── */}
      {timestamp && (
        <div className={`flex items-center gap-1.5 mt-1.5 px-1 ${isUser ? 'flex-row' : 'ml-12'}`}>
          <span className="text-[9px] font-black uppercase tracking-widest text-crema/25">
            {timestamp}
          </span>
          {isUser && (
            <CheckCheck size={12} className="text-rojo opacity-50" />
          )}
        </div>
      )}
    </motion.div>
  );
}