/**
 * src/pages/owner/OnboardingPage.tsx
 * D-1 — Onboarding IA — Registro del negocio (Paso 2 de 3)
 *
 * Guard removido del componente — lo maneja App.tsx con ProtectedRoute.
 * Esto evita el race condition donde userRole aún es null al navegar
 * recién después del registro.
 *
 * Flujo completo owner:
 *   RegisterStep1Page (1/3) → OnboardingPage (2/3) → RegisterStep2Page (3/3)
 *
 * Este componente contiene todo el chat IA inline:
 *   - ChatBubble, TypingIndicator, BotAvatar integrados
 *   - Llama a POST /api/v1/businesses/onboarding/chat (Gemini)
 *   - Al completar guarda en useOnboardingStore → setGeminiData()
 *   - Redirige a /register/step2
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Send, CheckCheck, Rocket, AlertTriangle,
  ChevronRight, Sparkles, Bot,
} from 'lucide-react';

import { useOnboardingStore, type GeminiData } from '../../store/onboardingStore';

import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import ProgressBar from '../../components/ui/RegisterProgressBar';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Message {
  id: number;
  from: 'bot' | 'user';
  text: string;
  timestamp: string;
}

// ─── Animaciones ──────────────────────────────────────────────────────────────


const DAY_LABELS: Record<string, string> = {
  mon: 'Lun', tue: 'Mar', wed: 'Mié',
  thu: 'Jue', fri: 'Vie', sat: 'Sáb', sun: 'Dom',
};

function formatHorario(horario?: Record<string, string[] | null>): string {
  if (!horario) return 'No especificado';
  const dias = Object.entries(horario)
    .filter(([, val]) => Array.isArray(val) && val.length === 2)
    .map(([day, val]) => `${DAY_LABELS[day] ?? day} ${(val as string[])[0]}–${(val as string[])[1]}`);
  return dias.length > 0 ? dias.join(', ') : 'No especificado';
}


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

// ─── Sub-componentes de Chat ──────────────────────────────────────────────────

function BotAvatar() {
  return (
    <div className="relative flex-shrink-0">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center border border-white/10 shadow-lg text-[14px]"
        style={{
          background: 'linear-gradient(135deg, #C1121F, #8b0d14)',
          boxShadow: '0 0 0 2px rgba(193,18,31,0.33)',
        }}
      >
        🌮
      </div>
      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#52B788] rounded-full border-2 border-[#110800]" />
    </div>
  );
}



function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 mb-4">
      <BotAvatar />
      <div
        className="px-4 py-3 rounded-[4px] rounded-br-[18px] rounded-bl-[18px] rounded-tr-[18px]"
        style={{ background: '#1e1006', border: '1px solid rgba(193,18,31,0.2)' }}
      >
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
              className="w-1.5 h-1.5 bg-[#52B788] rounded-full block"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ message, role, timestamp }: { message: string; role: 'bot' | 'user'; timestamp: string }) {
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
        {!isUser && <BotAvatar />}
        <div
          className={`relative px-4 py-3 text-[14px] leading-relaxed ${
            isUser
              ? 'text-white rounded-[18px] rounded-br-[4px]'
              : 'text-[#FFF3DC] border border-[#C1121F]/20 rounded-[4px] rounded-br-[18px] rounded-bl-[18px] rounded-tr-[18px]'
          }`}
          style={
            isUser
              ? { background: '#C1121F', boxShadow: '0 2px 12px rgba(193,18,31,0.27)' }
              : { background: '#1e1006', boxShadow: '0 1px 6px rgba(0,0,0,0.4)' }
          }
        >
          <div className="whitespace-pre-wrap break-words font-medium">{message}</div>
          {isUser && (
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 rounded-[18px] pointer-events-none" />
          )}
        </div>
      </div>
      <div className={`flex items-center gap-1.5 mt-1.5 px-1 ${isUser ? 'flex-row' : 'ml-11'}`}>
        <span className="text-[9px] font-black uppercase tracking-widest text-[#FFF3DC]/25">{timestamp}</span>
        {isUser && <CheckCheck size={12} className="text-[#C1121F] opacity-50" />}
      </div>
    </motion.div>
  );
}

// ─── Pantalla de Confirmación (datos capturados por IA) ───────────────────────

function SuccessScreen({ data, onContinue }: { data: GeminiData; onContinue: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full items-center justify-center px-6 gap-5 overflow-y-auto py-8"
      style={{ background: '#110800' }}
    >
      {/* Icono */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center border flex-shrink-0"
        style={{
          background: 'rgba(45,106,79,0.15)',
          borderColor: 'rgba(45,106,79,0.4)',
          boxShadow: '0 0 40px rgba(45,106,79,0.2)',
          fontSize: 36,
        }}
      >
        🎉
      </div>

      {/* Título */}
      <div className="text-center flex-shrink-0">
        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-1">
          ¡Datos capturados!
        </h2>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(255,243,220,0.4)' }}>
          Así registré tu negocio — revisa que todo esté correcto
        </p>
      </div>

      {/* Tarjetas */}
      <div
        className="w-full rounded-2xl p-4 flex flex-col gap-3 flex-shrink-0"
        style={{ background: '#1a1000', border: '1px solid rgba(45,106,79,0.35)' }}
      >
        {[
          { label: 'Nombre',        value: data.nombre,                         emoji: '🏪' },
          { label: 'Categoría',     value: data.categoria,                      emoji: '🗂️' },
          { label: 'Descripción',   value: data.descripcion,                    emoji: '✨' },
          { 
            label: 'Especialidades',
            value: data.especialidades?.map(esp => 
              esp.precio ? `${esp.nombre} ($${esp.precio})` : esp.nombre
            ).join(', ') || '—', 
            emoji: '⭐' 
          },
          { label: 'Horario',       value: formatHorario(data.horario),           emoji: '🕐' },
        ].map(({ label, value, emoji }) => (
          <div
            key={label}
            className="flex items-start gap-3 p-3 rounded-xl"
            style={{ background: '#241500', border: '1px solid rgba(45,106,79,0.2)' }}
          >
            <span className="text-xl flex-shrink-0 mt-0.5">{emoji}</span>
            <div className="min-w-0">
              <p
                className="text-[9px] font-black uppercase tracking-widest mb-0.5"
                style={{ color: 'rgba(255,243,220,0.35)' }}
              >
                {label}
              </p>
              <p className="text-xs font-bold text-[#FFF3DC] leading-relaxed">{value || '—'}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA — Paso 3 */}
      <button
        onClick={onContinue}
        className="w-full py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 flex-shrink-0"
        style={{ background: '#E85D04', color: '#FFF3DC', letterSpacing: '0.3px' }}
      >
        <Rocket size={17} />
        Siguiente: Ubicación y contacto
        <ChevronRight size={16} />
      </button>

      <p
        className="text-center text-[10px] leading-relaxed flex-shrink-0"
        style={{ color: 'rgba(255,243,220,0.3)' }}
      >
        Casi listo — solo faltan tu dirección,<br />teléfono y método de pago.
      </p>
    </motion.div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function OnboardingPage() {
  const navigate      = useNavigate();
  const setGeminiData  = useOnboardingStore((s) => s.setGeminiData);

  // ── Estado del chat ──────────────────────────────────────────────────────
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [tokenReady,    setTokenReady]    = useState(false);
  const [inputValue,    setInputValue]    = useState('');
  const [isTyping,      setIsTyping]      = useState(false);
  const [chatHistory,   setChatHistory]   = useState('');
  const [isComplete,    setIsComplete]    = useState(false);
  const [extractedData, setExtractedData] = useState<GeminiData | null>(null);
  const [sendingToAPI,  setSendingToAPI]  = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const getTime = () =>
    new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  // ── Esperar token + saludo inicial ──────────────────────────────────────
  // El token puede llegar null justo al montar si setAuth() corrió después
  // del navigate() en RegisterStep1Page. Polling cada 100ms hasta 5s.
  useEffect(() => {
    let attempts = 0;
    const MAX    = 50; // 50 × 100ms = 5 segundos máximo

    function tryInit() {
      const token = useAuthStore.getState().accessToken;
      if (token) {
        setTokenReady(true);
        // Saludo
        const t1 = setTimeout(() => setIsTyping(true), 300);
        const t2 = setTimeout(() => {
          setIsTyping(false);
          setMessages([{
            id: Date.now(),
            from: 'bot',
            text: '¡Hola! Soy el asistente IA de OLA MX 🌮\n\n¿Cómo se llama tu negocio?',
            timestamp: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          }]);
          setTimeout(() => inputRef.current?.focus(), 150);
        }, 1200);
        return () => { clearTimeout(t1); clearTimeout(t2); };
      }
      if (++attempts < MAX) {
        setTimeout(tryInit, 100);
      }
    }

    tryInit();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isComplete]);

  function addBotMessage(text: string) {
    setMessages(prev => [...prev, { id: Date.now(), from: 'bot', text, timestamp: getTime() }]);
    setTimeout(() => inputRef.current?.focus(), 150);
  }

  // ── Envío de mensaje ─────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    // Solo bloqueamos si ya hay llamada en curso — quitamos isTyping del guard
    // para evitar race condition con el saludo inicial
    if (!text || sendingToAPI) return;

    setMessages(prev => [...prev, { id: Date.now(), from: 'user', text, timestamp: getTime() }]);
    setInputValue('');
    setError(null);

    const updatedHistory = chatHistory
      ? `${chatHistory}\nDueño: ${text}`
      : `Dueño: ${text}`;

    setSendingToAPI(true);
    setIsTyping(true);

    try {
      const res = await api.post<{
        data: {
          isComplete:      boolean;
          reply:           string;
          extractedData?:  GeminiData;
          updatedHistory?: string;
        };
        error: string | null;
      }>('/api/v1/businesses/onboarding/chat', {
        message: text,
        history: chatHistory || undefined,
      });

      const { isComplete: done, reply, extractedData: extracted, updatedHistory: newHistory } = res.data.data;
      console.log('[OnboardingChat] Respuesta API:', { done, extracted, reply });


      setChatHistory(newHistory ?? `${updatedHistory}\nAsistente: ${reply}`);
      setIsTyping(false);
      setSendingToAPI(false);

      if (done && extracted) {
        setGeminiData(extracted);
        setExtractedData(extracted);
        addBotMessage(reply);
        setIsComplete(true);
      } else {
        addBotMessage(reply);
      }
    } catch (err: any) {
      setIsTyping(false);
      setSendingToAPI(false);

      // Diagnóstico detallado — abre DevTools > Console para ver el detalle
      const status = err?.response?.status;
      const detail = err?.response?.data;
      console.error('[OnboardingChat] Error /onboarding/chat', { status, detail });
      console.error('[OnboardingChat] Detail completo:', JSON.stringify(detail, null, 2));
      console.error('[OnboardingChat] Token al momento del error:', useAuthStore.getState().accessToken ? 'PRESENTE' : 'NULL');

      const rawMsg = detail?.error ?? detail?.message ?? detail;
      const userMsg =
        status === 401 ? 'Error 401 — token no enviado o expirado.' :
        status === 403 ? 'Error 403 — usuario sin rol owner.' :
        status === 422 ? 'Error 422 — body rechazado por el backend.' :
        typeof rawMsg === 'string' ? rawMsg : `Error ${status ?? 'de red'}.`;

      setError(userMsg);
      addBotMessage('Tuve un problema técnico 😅 Abre DevTools > Console.');
    }
  }, [inputValue, chatHistory, sendingToAPI, setGeminiData]);

  // ── Progreso estimado ────────────────────────────────────────────────────
  const turnosDueño   = chatHistory.split('\n').filter(l => l.startsWith('Dueño:')).length;
  const chatProgress  = Math.min(Math.round((turnosDueño / 5) * 100), 95);

  // ── Continuar a Paso 3 ───────────────────────────────────────────────────
  function handleContinue() {
    navigate('/register/step2', { replace: true });
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-[#110800] flex flex-col overflow-hidden">

      {/* ── Banderita Tricolor ── */}
      <div className="h-[3px] w-full flex sticky top-0 z-[60]">
        <div className="flex-1 bg-[#006847]" />
        <div className="flex-1 bg-white"    />
        <div className="flex-1 bg-[#C1121F]" />
      </div>

      {/* ── Header ── */}
      <header className="bg-[#110800]/80 backdrop-blur-xl border-b border-white/5 sticky top-[3px] z-50">
        {/* ProgressBar — Paso 2 de 3 */}
        <div className="app-shell-form px-4 pt-4 pb-2 sm:px-5 lg:px-6">
          <ProgressBar currentStep={2} totalSteps={3} />
        </div>

        <div className="app-shell-form flex items-center justify-between px-4 pb-4 sm:px-5 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#C1121F]/10 rounded-xl">
              <Bot size={20} className="text-[#C1121F]" />
            </div>
            <div>
              <h1 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#C1121F]">
                Asistente IA
              </h1>
              <p className="text-sm font-black italic text-white uppercase tracking-tighter leading-none mt-0.5">
                Cuéntame de tu negocio
              </p>
            </div>
          </div>

          {/* Badge de estado */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-[#52B788] animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40">En línea</span>
          </div>
        </div>

        {/* Mini barra de progreso del chat */}
        {!isComplete && (
          <div className="h-[3px]" style={{ background: 'rgba(82,183,136,0.15)' }}>
            <motion.div
              className="h-full rounded-r-full"
              style={{ background: '#F4A300' }}
              animate={{ width: `${chatProgress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        )}
      </header>

      {/* ── Área principal ── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {isComplete && extractedData ? (
          // ── Pantalla de confirmación ──
          <div className="flex-1 overflow-y-auto z-10">
            <div className="app-shell-form h-full">
              <SuccessScreen data={extractedData} onContinue={handleContinue} />
            </div>
          </div>
        ) : (
          // ── Chat — flex column: feed crece, input se queda abajo ──
          <div className="flex-1 flex flex-col overflow-hidden z-10">
            <div className="app-shell-form flex-1 flex flex-col overflow-hidden">

              {/* Feed — ocupa todo el espacio disponible y hace scroll */}
              <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide">
                {messages.map(msg => (
                  <ChatBubble
                    key={msg.id}
                    role={msg.from}
                    message={msg.text}
                    timestamp={msg.timestamp}
                  />
                ))}

                {isTyping && <TypingIndicator />}

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 mx-2 mb-4 p-3 rounded-xl text-[#ff6b6b] text-xs font-bold"
                      style={{ background: 'rgba(193,18,31,0.15)', border: '1px solid rgba(193,18,31,0.4)' }}
                    >
                      <AlertTriangle size={14} className="flex-shrink-0" />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={bottomRef} />
              </div>

              {/* Input — anclado al fondo, parte del flujo normal */}
              <div
                className="flex-shrink-0 px-4 py-3 border-t border-white/5"
                style={{ background: '#110800' }}
              >
                <div
                  className="flex items-center gap-2 rounded-3xl p-2 pl-5"
                  style={{ background: '#1e1200', border: '1px solid rgba(45,106,79,0.5)' }}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    className="flex-1 bg-transparent outline-none border-none text-sm font-medium"
                    style={{ color: '#FFF3DC', caretColor: '#F4A300' }}
                    placeholder={!tokenReady ? 'Conectando...' : 'Escribe tu respuesta...'}
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    disabled={isTyping || sendingToAPI || !tokenReady}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isTyping || sendingToAPI || !tokenReady}
                    className="w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 disabled:opacity-40"
                    style={{ background: '#2D6A4F', color: '#FFF3DC' }}
                  >
                    {sendingToAPI
                      ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      : <Send size={17} />
                    }
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="p-4 bg-[#110800] border-t border-white/5 flex-shrink-0">
        <div className="app-shell-form flex items-center justify-center gap-2 opacity-20">
          <Sparkles size={12} className="text-[#FFF3DC]" />
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-[#FFF3DC]">
            Powered by OLA MX Intelligence
          </p>
        </div>
      </footer>

    </div>
  );
}
