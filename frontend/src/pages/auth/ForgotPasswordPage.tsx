/**
 * src/pages/auth/ForgotPasswordPage.tsx
 * P-0X — Solicitar recuperación de contraseña
 * Ruta: /forgot-password
 */

import { useState } from 'react';
import { useNavigate} from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/api';
import garnachin from '../../assets/garnachin.png';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const { data } = await api.post<{ data: { message: string } }>('/api/v1/auth/forgot-password', { email });
      setSuccessMsg(data.data.message);
      setEmail(''); // Limpiar el input
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error ?? 'Ocurrió un error. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#110800] flex items-center justify-center p-6 relative overflow-hidden">
      {/* ── Decoración ambiental ── */}
      <div className="absolute top-[-5%] left-[-5%] w-72 h-72 bg-rojo/5 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-5%] right-[-5%] w-72 h-72 bg-amarillo/5 blur-[120px] rounded-full" />

      {/* ── Toast — Éxito ── */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-50
                       bg-[#006847] text-white px-6 py-3 rounded-2xl
                       shadow-[0_10px_30px_rgba(0,104,71,0.4)]
                       text-[11px] font-black uppercase tracking-widest border border-white/10 text-center"
          >
            ✅ {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="app-auth-panel flex flex-col items-center z-10">
        {/* ── Logo & Hero ── */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex gap-1 mb-6">
            <span className="w-8 h-1.5 rounded-full bg-[#006847] shadow-[0_0_10px_rgba(0,104,71,0.3)]" />
            <span className="w-8 h-1.5 rounded-full bg-white  shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
            <span className="w-8 h-1.5 rounded-full bg-[#C1121F] shadow-[0_0_10px_rgba(193,18,31,0.3)]" />
          </div>

          <div className="relative mb-4">
            <div className="absolute inset-0 bg-rojo/20 blur-3xl rounded-full scale-90" />
            <img
              src={garnachin}
              alt="Garnachín"
              className="w-28 h-28 object-contain relative animate-float"
              style={{ filter: 'drop-shadow(0 12px 20px rgba(0,0,0,0.6))' }}
            />
          </div>

          <div className="text-center">
            <h1 className="flex flex-col items-center">
              <span className="text-white font-black text-xl italic uppercase tracking-tighter leading-none">
                Recuperar
              </span>
              <span className="text-rojo font-black text-4xl italic uppercase tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(193,18,31,0.3)]">
                Contraseña
              </span>
            </h1>
            <p className="text-crema/60 text-[11px] mt-4 font-medium text-center px-4">
              Ingresa el correo con el que te registraste. Te enviaremos un enlace mágico para recuperarla.
            </p>
          </div>
        </div>

        {/* ── Formulario ── */}
        <form onSubmit={handleSubmit} className="w-full space-y-5">
          <div className="space-y-1.5">
            <label className="text-crema/40 text-[10px] font-black uppercase tracking-widest ml-1">
              Correo electrónico
            </label>
            <input
              type="email"
              placeholder="turista@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 text-white
                         placeholder:text-white/20 rounded-2xl px-4 py-3.5 text-sm
                         outline-none focus:border-rojo/50 focus:bg-white/10 transition-all"
            />
          </div>

          <AnimatePresence>
            {errorMsg && (
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="text-rojo text-[11px] font-bold bg-rojo/5 border border-rojo/20 rounded-xl px-4 py-3"
              >
                {errorMsg}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={isLoading || !email}
            className="w-full bg-rojo text-white font-black py-4 rounded-2xl text-xs
                       uppercase tracking-[0.2em]
                       shadow-[0_8px_25px_rgba(193,18,31,0.3)] hover:bg-[#a0101a]
                       active:scale-95 disabled:opacity-50 transition-all"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <SpinnerIcon /> Enviando...
              </span>
            ) : (
              'Enviar Enlace'
            )}
          </button>
        </form>

        {/* ── Footer Links ── */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <button
            onClick={() => navigate('/login')}
            className="text-crema/40 text-[10px] font-black uppercase tracking-widest hover:text-crema transition-colors flex items-center gap-1"
          >
            ← Volver a Iniciar Sesión
          </button>
        </div>
      </div>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
