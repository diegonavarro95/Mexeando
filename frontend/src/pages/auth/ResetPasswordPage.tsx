/**
 * src/pages/auth/ResetPasswordPage.tsx
 * P-0X — Crear nueva contraseña
 * Ruta: /reset-password?token=...
 */

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/api';
import garnachin from '../../assets/garnachin.png';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setErrorMsg('Falta el token de seguridad. Usa el enlace de tu correo.');
      return;
    }

    setErrorMsg('');
    setIsLoading(true);

    try {
      await api.post('/api/v1/auth/reset-password', { token, new_password: password });
      
      setSuccess(true);
      // Redirigir después de 1 segundo para mostrar el Toast
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1500);

    } catch (err: any) {
      setErrorMsg(err.response?.data?.error ?? 'El token expiró o es inválido.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#110800] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-5%] left-[-5%] w-72 h-72 bg-rojo/5 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-5%] right-[-5%] w-72 h-72 bg-amarillo/5 blur-[120px] rounded-full" />

      {/* ── Toast — Éxito (1 segundo antes de redirigir) ── */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-50
                       bg-[#006847] text-white px-6 py-3 rounded-2xl
                       shadow-[0_10px_30px_rgba(0,104,71,0.4)]
                       text-[11px] font-black uppercase tracking-widest border border-white/10"
          >
            ✅ CONTRASEÑA RECUPERADA
          </motion.div>
        )}
      </AnimatePresence>

      <div className="app-auth-panel flex flex-col items-center z-10">
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
                Nueva
              </span>
              <span className="text-rojo font-black text-4xl italic uppercase tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(193,18,31,0.3)]">
                Contraseña
              </span>
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-5">
          <div className="space-y-1.5">
            <label className="text-crema/40 text-[10px] font-black uppercase tracking-widest ml-1">
              Nueva Contraseña (mínimo 8 caracteres)
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-white/5 border border-white/10 text-white
                           placeholder:text-white/20 rounded-2xl px-4 py-3.5 pr-12 text-sm
                           outline-none focus:border-rojo/50 focus:bg-white/10 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-crema/20 hover:text-crema/60 transition-colors"
              >
                {showPass ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
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
            disabled={isLoading || success}
            className="w-full bg-rojo text-white font-black py-4 rounded-2xl text-xs
                       uppercase tracking-[0.2em]
                       shadow-[0_8px_25px_rgba(193,18,31,0.3)] hover:bg-[#a0101a]
                       active:scale-95 disabled:opacity-50 transition-all"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <SpinnerIcon /> Guardando...
              </span>
            ) : (
              'Guardar y Entrar'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Micro-íconos SVG inline ──────────────────────────────────────────────────
function EyeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
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
