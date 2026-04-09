/**
 * src/pages/tourist/GlobalChatPage.tsx
 * Chat Global del Turista con el Asistente IA (RAG)
 *
 * Utiliza llamadas REST al endpoint /api/v1/assistant/chat
 * Mantiene la UI original estilo Telegram.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate }                    from 'react-router-dom';
import { motion, AnimatePresence }        from 'framer-motion';
import { useAuthStore }                   from '../../store/authStore';
import { api }                            from '../../services/api';
import ChatBubble                         from '../../components/chat/ChatBubble';
import BottomNav                          from '../../components/ui/BottomNav';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Message {
  id:        string;
  role:      'bot' | 'user';
  text:      string;
  timestamp: string;
  action?:   { label: string; url: string; }; 
}

type LangCode = 'es' | 'en' | 'fr' | 'pt' | 'de' | 'zh';

const LANG_LABELS: Record<LangCode, string> = {
  es: 'ES 🇲🇽', en: 'EN 🇺🇸', fr: 'FR 🇫🇷',
  pt: 'PT 🇧🇷', de: 'DE 🇩🇪', zh: 'ZH 🇨🇳',
};

// Respuestas rápidas para el Asistente Global
const QUICK_REPLIES: string[] = [
  '¿Cuáles son los mejores locales?',
  '¿Qué me recomiendas hacer hoy?',
  '¿Cómo funciona el pasaporte?',
  '¿Qué lugares me recomiendas visitar?',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function nowTime(): string {
  return new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function uid(): string {
  return Math.random().toString(36).slice(2);
}

// ─── Typing indicator — framer-motion bouncing dots ───────────────────────────
function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="flex items-end gap-2 mb-1"
    >
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C1121F] to-[#8b0d14] flex items-center justify-center text-sm flex-shrink-0 border border-white/10">
        AI
      </div>
      <div className="bg-[#1e1006] border border-[#C1121F]/20 rounded-[4px_18px_18px_18px] px-4 py-3 flex gap-1.5 items-center">
        {[0, 200, 400].map((delay) => (
          <motion.span
            key={delay}
            className="w-1.5 h-1.5 rounded-full bg-[#C1121F] block"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: delay / 1000 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function GlobalChatPage() {
  const navigate                        = useNavigate();
  const { accessToken, preferredLang }  = useAuthStore();

  const bottomRef                       = useRef<HTMLDivElement>(null);
  const inputRef                        = useRef<HTMLInputElement>(null);

  const [messages, setMessages]         = useState<Message[]>([]);
  const [inputText, setInputText]       = useState('');
  const [isTyping, setIsTyping]         = useState(false);
  
  const [isReady, setIsReady]           = useState(false); 
  const [lang, setLang]                 = useState<LangCode>((preferredLang as LangCode) ?? 'es');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);

  // Coordenadas del usuario para consultas de cercanía
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  // ── Inicialización ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) {
      navigate('/login', { replace: true });
      return;
    }

    // Pedir ubicación al cargar para que funcione la intención "BUSCAR_CERCANOS"
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("Ubicación denegada:", err) 
      );
    }

    // Mensaje de bienvenida
    setMessages([{
      id: uid(),
      role: 'bot',
      text: `¡Hola! Soy Ola, tu asistente del Mundial. Pregúntame sobre restaurantes, tu pasaporte de estampas o qué hacer en la ciudad.`,
      timestamp: nowTime(),
    }]);
    setIsReady(true);
  }, [accessToken, navigate]);


  // ── Scroll al fondo ─────────────────────────────────────────────────────────
  const scrollBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  }, []);

  useEffect(() => {
    scrollBottom();
  }, [messages, isTyping, scrollBottom]);

  // ── Enviar mensaje al API REST ──────────────────────────────────────────────
  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    // 1. Mostrar mensaje del usuario
    setMessages((prev) => [...prev, {
      id: uid(),
      role: 'user',
      text: trimmed,
      timestamp: nowTime(),
    }]);
    
    setInputText('');
    setIsTyping(true);
    setErrorMsg(null);
    scrollBottom();

    // 2. Preparar el historial
    const historyText = messages.slice(-4).map(m => `${m.role === 'bot' ? 'Asistente' : 'Usuario'}: ${m.text}`).join('\n');

    try {
      // 3. Llamar al nuevo endpoint REST
      const response = await api.post('/api/v1/assistant/chat', {
        message: trimmed,
        history: historyText,
        lat: userLocation?.lat,
        lng: userLocation?.lng
      });

      // 4. Mostrar respuesta con el botón dinámico
      setMessages((prev) => [...prev, {
        id: uid(),
        role: 'bot',
        text: response.data.data.reply,
        action: response.data.data.action, 
        timestamp: nowTime(),
      }]);

    } catch (err) {
      console.error(err);
      setErrorMsg("Ocurrió un error al contactar al asistente. Intenta de nuevo.");
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
      scrollBottom();
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#110800] text-[#FFF3DC] relative">

      {/* ── Header con tricolor Spec §01 ────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full">
        <div className="h-[3px] w-full flex">
          <div className="flex-1 bg-[#006847]" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-[#C1121F]" />
        </div>

        <div
          className="bg-[#110800]/90 backdrop-blur-xl border-b border-[#C1121F]/10 pb-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
        >
          <div className="app-shell-form flex items-center gap-3 px-4 sm:px-5 lg:px-6">
            {/* Back Button (Opcional, pero bueno por si navegan aquí desde otro lado) */}
            <button
              onClick={() => navigate(-1)}
              className="text-[#FFF3DC]/60 hover:text-[#FFF3DC] transition-colors"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>

            {/* Bot avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C1121F] to-[#8b0d14] flex items-center justify-center text-sm font-bold flex-shrink-0 border border-white/10 shadow-lg">
              AI
            </div>

            {/* Nombre + estado */}
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-[15px] truncate">Asistente Ola MX</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full transition-colors ${
                    isReady ? 'bg-[#52B788]' : 'bg-zinc-600'
                  }`}
                  style={isReady ? { boxShadow: '0 0 0 2px rgba(82,183,136,0.3)' } : undefined}
                />
                <span className={`text-[10px] uppercase font-black tracking-widest ${isReady ? 'text-[#52B788]' : 'text-[#FFF3DC]/30'}`}>
                  {isReady ? 'En línea' : 'Iniciando...'}
                </span>
              </div>
            </div>

            {/* Selector de idioma */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowLangMenu((p) => !p)}
                className="bg-[#C1121F]/20 border border-[#C1121F]/40 text-[#FFF3DC] px-2.5 py-1 rounded-lg text-[11px] font-bold"
              >
                {LANG_LABELS[lang]}
              </button>
              <AnimatePresence>
                {showLangMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    className="absolute right-0 top-9 z-30 bg-[#1e1006] border border-[#C1121F]/30 rounded-xl shadow-2xl p-1 min-w-[110px]"
                  >
                    {(Object.keys(LANG_LABELS) as LangCode[]).map((code) => (
                      <button
                        key={code}
                        onClick={() => { setLang(code); setShowLangMenu(false); }}
                        className={`block w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                          lang === code
                            ? 'bg-[#C1121F] text-[#FFF3DC] font-bold'
                            : 'text-[#FFF3DC]/60 hover:bg-white/5'
                        }`}
                      >
                        {LANG_LABELS[code]}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* ── Error  ───────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="app-shell-form mt-2 rounded-xl border border-[#C1121F]/40 bg-[#C1121F]/15 px-4 py-2.5 text-[13px] text-[#ff6b6b] flex-shrink-0"
          >
            ⚠️ {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Área de mensajes ──────────────────────────────────────────────────── */}
      <main
        className="flex-1 overflow-y-auto py-4"
        style={{
          backgroundImage: 'radial-gradient(#C1121F08 1px, transparent 0)',
          backgroundSize: '24px 24px',
          paddingBottom: '18rem',
        }}
      >
        <div className="app-shell-form flex flex-col gap-2 px-4 sm:px-5 lg:px-6">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <div key={msg.id} className="flex flex-col">
                <ChatBubble
                  role={msg.role}
                  message={msg.text}
                  timestamp={msg.timestamp}
                />
                
                {/* ── BOTÓN DINÁMICO NAVEGABLE ── */}
                {msg.action && (
                  <motion.button
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (msg.action?.url) {
                        navigate(msg.action.url.trim());
                      }
                    }}
                    className="mt-1 ml-[48px] self-start flex items-center gap-2 bg-[#C1121F]/10 border border-[#C1121F]/40 text-[#F4A300] px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#C1121F]/20 transition-colors shadow-lg backdrop-blur-sm z-10 cursor-pointer"
                  >
                    {msg.action.label}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </motion.button>
                )}
              </div>
            ))}
          </AnimatePresence>

          <AnimatePresence>
            {isTyping && <TypingIndicator />}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>
      </main>

      {/* ── Input + quick replies — sticky bottom ──────────────────────────── */}
      <section className="fixed inset-x-0 z-40 bg-gradient-to-t from-[#110800] via-[#110800] to-transparent pt-10 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-[calc(5rem+env(safe-area-inset-bottom))]">
        <div className="app-shell-form px-4 sm:px-5 lg:px-6">
          {/* Quick replies */}
          <div className="flex gap-2 overflow-x-auto pb-4 [scrollbar-width:none]">
            {QUICK_REPLIES.map((qr) => (
              <button
                key={qr}
                onClick={() => sendMessage(qr)}
                disabled={!isReady || isTyping}
                className="flex-shrink-0 px-4 py-2 rounded-full border border-[#C1121F]/30 bg-[#1E1006] text-[#FFF3DC]/80 text-[12px] font-semibold whitespace-nowrap hover:border-[#C1121F] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {qr}
              </button>
            ))}
          </div>

          {/* Input row */}
          <div className="mb-3 flex items-center gap-2 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
            <div className="flex-1 bg-[#1E1006] border border-[#C1121F]/20 rounded-2xl flex items-center px-4 py-1 focus-within:border-[#C1121F]/50 transition-all">
              <input
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(inputText);
                  }
                }}
                placeholder={isReady ? 'Pregúntame algo del Mundial...' : 'Iniciando...'}
                disabled={!isReady || isTyping}
                className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-[#FFF3DC]/20 disabled:opacity-50 caret-[#F4A300]"
              />
              <button
                onClick={() => sendMessage(inputText)}
                disabled={!inputText.trim() || !isReady || isTyping}
                className={`p-2 rounded-xl transition-all ${
                  inputText.trim() && isReady && !isTyping
                    ? 'bg-[#C1121F] text-white shadow-[0_2px_12px_rgba(193,18,31,0.4)] cursor-pointer'
                    : 'text-[#FFF3DC]/10 cursor-not-allowed'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13"/>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      <BottomNav activeTab="chat" />
    </div>
  );
}
