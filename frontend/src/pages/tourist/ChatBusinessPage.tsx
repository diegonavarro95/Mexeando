/**
 * src/pages/tourist/ChatBusinessPage.tsx
 * T-3 — Chat IA con el Negocio (Vía WebSockets)
 * UX/UI Premium: Glassmorphism, Typing Indicators fluidos, Auto-scroll
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import { Send, ChevronLeft, Bot, Sparkles, AlertTriangle } from 'lucide-react';

import { useAuthStore } from '../../store/authStore';
import ChatBubble from '../../components/chat/ChatBubble'; // Reutilizamos tu burbuja de chat

interface ChatMessage {
  id: string;
  role: 'bot' | 'user';
  text: string;
  timestamp: string;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function getCurrentTime() {
  return new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatBusinessPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const navigate = useNavigate();
  const { accessToken, preferredLang } = useAuthStore();
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Estados de conexión y UI
  const [isTyping, setIsTyping] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [bizName, setBizName] = useState('Conectando...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ─── 1. CONEXIÓN DE SOCKET.IO ───
  useEffect(() => {
    if (!accessToken || !businessId) return;

    // Conectamos al servidor de sockets (Asegúrate de que la URL de tu API sea la correcta)
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const newSocket = io(socketUrl, {
      auth: { token: `Bearer ${accessToken}` },
      transports: ['websocket'], // Forzamos websocket para mayor velocidad
    });

    setSocket(newSocket);

    // Al conectar, pedimos unirnos a la sala de este negocio
    newSocket.on('connect', () => {
      newSocket.emit('chat:join', { businessId, preferredLang: preferredLang || 'es' });
    });

    // ─── LISTENERS DEL BACKEND ───
    newSocket.on('chat:joined', (data: { businessName: string, roomName: string }) => {
      setBizName(data.businessName);
      setIsReady(true);
      setMessages([{
        id: generateId(),
        role: 'bot',
        text: `¡Hola! Soy el asistente virtual de ${data.businessName}. ¿En qué te puedo ayudar hoy?`,
        timestamp: getCurrentTime()
      }]);
    });

    newSocket.on('chat:typing', (data: { typing: boolean }) => {
      setIsTyping(data.typing);
    });

    newSocket.on('chat:response', (data: { message: string, timestamp: string }) => {
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'bot',
        text: data.message,
        timestamp: getCurrentTime()
      }]);
    });

    newSocket.on('chat:error', (err: { code: string, message: string }) => {
      console.error("Error de socket:", err);
      setErrorMsg(err.message || "Ocurrió un error en la conexión.");
      setIsTyping(false);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [accessToken, businessId, preferredLang]);

  // ─── 2. AUTO-SCROLL ───
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ─── 3. ENVÍO DE MENSAJES ───
  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !socket || !isReady || isTyping) return;

    // Pintamos el mensaje del usuario inmediatamente
    setMessages(prev => [...prev, {
      id: generateId(),
      role: 'user',
      text: text,
      timestamp: getCurrentTime()
    }]);
    
    // Enviamos el evento al servidor
    socket.emit('chat:message', { message: text });
    
    setInputText('');
    setErrorMsg(null);
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-[100dvh] bg-[#110800] flex flex-col overflow-hidden text-[#FFF3DC]">
      
      {/* ─── HEADER ─── */}
      <header className="bg-[#110800]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="h-[3px] w-full flex">
          <div className="flex-1 bg-[#006847]" /><div className="flex-1 bg-white" /><div className="flex-1 bg-[#C1121F]" />
        </div>
        
        <div className="px-4 py-3 flex items-center gap-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 -ml-2 rounded-full hover:bg-white/5 active:scale-90 transition-all text-white/70 hover:text-white"
          >
            <ChevronLeft size={24} />
          </button>
          
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C1121F] to-[#8b0d14] flex items-center justify-center text-sm font-black border border-white/10 shadow-lg flex-shrink-0">
            IA
          </div>
          
          <div className="flex-1 min-w-0">
            <h1 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C1121F]">
              Asistente Local
            </h1>
            <p className="text-sm font-black italic tracking-tight truncate text-white">
              {bizName}
            </p>
          </div>

          <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 rounded-full border border-white/10 flex-shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${isReady ? 'bg-[#52B788] animate-pulse' : 'bg-white/20'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
              {isReady ? 'Online' : 'Conectando'}
            </span>
          </div>
        </div>
      </header>

      {/* ─── ALERTAS DE ERROR ─── */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-[#C1121F]/10 border-b border-[#C1121F]/30 px-4 py-2 flex items-center gap-2">
            <AlertTriangle size={14} className="text-[#ff6b6b] flex-shrink-0" />
            <p className="text-[11px] font-bold text-[#ff6b6b] leading-tight">{errorMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── FEED DE MENSAJES ─── */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        
        {/* Mensaje de privacidad inicial */}
        <div className="flex flex-col items-center justify-center gap-2 opacity-30 pb-6 pt-4">
          <Sparkles size={24} className="text-[#F4A300]" />
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-center max-w-[200px] leading-relaxed">
            Sesión impulsada por<br />Gemini Intelligence
          </p>
        </div>

        {/* Burbujas de Chat */}
        {messages.map((msg) => (
          <ChatBubble 
            key={msg.id} 
            role={msg.role} 
            message={msg.text} 
            timestamp={msg.timestamp} 
          />
        ))}
        
        {/* Indicador de "Escribiendo..." animado */}
        {isTyping && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-white/40 bg-white/5 w-fit px-4 py-2.5 rounded-[18px] rounded-bl-sm border border-white/5">
            <Bot size={14} className="text-[#C1121F]" />
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} className="w-1.5 h-1.5 bg-[#C1121F] rounded-full block" />
              ))}
            </div>
          </motion.div>
        )}
        
        {/* Ancla invisible para auto-scroll */}
        <div ref={bottomRef} className="h-4" />
      </main>

      {/* ─── INPUT DE TEXTO ─── */}
      <footer className="p-4 pb-8 bg-gradient-to-t from-[#110800] via-[#110800] to-transparent flex-shrink-0">
        <div className="app-shell-form flex items-end gap-2 bg-[#1e1006] border border-white/10 rounded-[20px] p-1.5 pl-4 shadow-lg focus-within:border-[#C1121F]/50 transition-colors">
          <textarea 
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={!isReady || isTyping}
            placeholder={isReady ? "Pregunta sobre el menú, horarios..." : "Conectando al asistente..."}
            className="flex-1 bg-transparent outline-none text-[13px] font-medium py-3 resize-none max-h-[100px] text-white placeholder:text-white/20 disabled:opacity-50 caret-[#F4A300]"
            rows={1}
          />
          <button 
            onClick={handleSend} 
            disabled={!inputText.trim() || !isReady || isTyping}
            className={`w-11 h-11 flex-shrink-0 rounded-[14px] flex items-center justify-center transition-all ${
              inputText.trim() && isReady && !isTyping 
                ? 'bg-[#C1121F] text-white shadow-[0_4px_15px_rgba(193,18,31,0.4)] active:scale-90 cursor-pointer' 
                : 'bg-white/5 text-white/20 cursor-not-allowed'
            }`}
          >
            <Send size={16} className="ml-0.5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
