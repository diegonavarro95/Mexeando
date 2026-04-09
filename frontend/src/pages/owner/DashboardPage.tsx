/**
 * src/pages/owner/DashboardPage.tsx
 * D-4 — Dashboard del dueño
 *
 * Fixes:
 *  - Botón avatar → modal para subir/cambiar foto de perfil
 *  - "Mi Perfil de Dueño" → redirige a /owner/edit
 *  - IA Insights → solo visible si tiene contenido real útil
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, QrCode, Star, MessageSquare,
  Edit3, TrendingUp, ChevronRight, Sparkles,
  LogOut, User, Camera, X, Loader2, CheckCircle2,
} from 'lucide-react';

import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import StatusBadge, { type BusinessStatus } from '../../components/ui/StatusBadge';
import garnachin from '../../assets/garnachin.png';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DailyMetric {
  date:     string;
  views:    number;
  checkins: number;
}

interface OwnerMetrics {
  has_business:         boolean;
  business_id:          string;
  business_name:        string;
  status:               BusinessStatus;
  profile_views:        number;
  profile_views_today:  number;
  checkin_count:        number;
  checkin_count_today:  number;
  avg_rating:           number;
  review_count:         number;
  daily_metrics:        DailyMetric[];
  ai_summary:           string | null;
}

interface Review {
  id:         string;
  rating:     number;
  body:       string;
  created_at: string;
  profile:    { display_name: string };
}

// ─── Helper: filtrar resúmenes IA vacíos ──────────────────────────────────────

function isUsefulAiSummary(summary: string | null): boolean {
  if (!summary) return false;
  const lc = summary.toLowerCase();
  // Ocultar si es el mensaje de placeholder del backend
  const emptyPhrases = [
    'no hay suficientes',
    'aún no hay',
    'sin reseñas',
    'no tiene reseñas',
    'no se pudo generar',
    'pendiente',
  ];
  return !emptyPhrases.some(p => lc.includes(p));
}

// ─── Modal de Avatar ──────────────────────────────────────────────────────────

function AvatarModal({
  currentAvatar,
  displayName,
  onClose,
  onSuccess,
}: {
  currentAvatar: string | null;
  displayName:   string;
  onClose:       () => void;
  onSuccess:     (url: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview,   setPreview]   = useState<string | null>(currentAvatar);
  const [file,      setFile]      = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [done,      setDone]      = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('Solo se permiten imágenes.'); return; }
    if (f.size > 5 * 1024 * 1024)    { setError('Máximo 5 MB.'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const token = useAuthStore.getState().accessToken;
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post<{ data: { avatar_url: string }; error: string | null }>(
        '/api/v1/profiles/me/avatar',
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.error) throw new Error(res.data.error);
      setDone(true);
      setTimeout(() => {
        onSuccess(res.data.data.avatar_url);
        onClose();
      }, 900);
    } catch (err: any) {
      setError(err.message ?? 'Error al subir la foto.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        exit={{    y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="flex max-h-[min(100svh-1rem,42rem)] w-full max-w-md flex-col gap-5 overflow-y-auto rounded-t-[2.5rem] p-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:p-7 sm:pb-10"
        style={{ background: '#1a0a02', border: '1px solid rgba(201,168,76,0.2)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-[#c9a84c]">Foto de Perfil</p>
            <h3 className="text-base font-black italic text-white uppercase tracking-tighter mt-0.5">
              {displayName}
            </h3>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/30 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Preview */}
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-28 h-28 rounded-full border-2 border-[#c9a84c]/40 overflow-hidden flex items-center justify-center cursor-pointer relative group"
            style={{ background: '#110800' }}
            onClick={() => fileInputRef.current?.click()}
          >
            {preview ? (
              <img src={preview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-black text-[#c9a84c]">
                {displayName[0]?.toUpperCase()}
              </span>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera size={22} className="text-white" />
            </div>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-[10px] font-black uppercase tracking-widest text-[#c9a84c] hover:text-white transition-colors"
          >
            {preview ? 'Cambiar foto' : 'Seleccionar foto'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleFile}
          />
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-[#ff6b6b] font-bold text-center"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Botón subir */}
        <button
          onClick={handleUpload}
          disabled={!file || uploading || done}
          className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40"
          style={{
            background: done ? '#2D6A4F' : '#C1121F',
            color: '#FFF3DC',
            boxShadow: '0 8px 20px rgba(193,18,31,0.25)',
          }}
        >
          {done ? (
            <><CheckCircle2 size={17} /> ¡Foto actualizada!</>
          ) : uploading ? (
            <><Loader2 size={17} className="animate-spin" /> Subiendo...</>
          ) : (
            <><Camera size={17} /> Guardar foto</>
          )}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const { accessToken, displayName, setAuth } = useAuthStore();

  const [metrics,      setMetrics]      = useState<OwnerMetrics | null>(null);
  const [reviews,      setReviews]      = useState<Review[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [avatarUrl,    setAvatarUrl]    = useState<string | null>(null);
  const [showAvatar,   setShowAvatar]   = useState(false);

  useEffect(() => {
    if (!accessToken) { navigate('/login', { replace: true }); return; }
    loadAll();
  }, [accessToken]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      // Cargar dashboard y perfil en paralelo
      const [dashRes, profileRes] = await Promise.all([
        api.get('/api/v1/owner/dashboard'),
        api.get<{ data: { avatar_url: string | null } }>('/api/v1/profiles/me'),
      ]);

      const d = dashRes.data.data;
      setMetrics({
        has_business:        d.has_business ?? false,
        business_id:         d.business_id,
        business_name:       d.business_name,
        status:              d.status,
        profile_views:       d.profile_views        ?? 0,
        profile_views_today: d.profile_views_today  ?? 0,
        checkin_count:       d.total_checkins       ?? 0,
        checkin_count_today: d.checkins_today       ?? 0,
        avg_rating:          Number(d.avg_rating)   || 0,
        review_count:        d.total_reviews        ?? 0,
        daily_metrics:       d.daily_metrics        ?? [],
        ai_summary:          d.ai_summary           ?? null,
      });

      setReviews(
        (d.recent_reviews ?? []).map((r: any, i: number) => ({
          id:         r.id ?? `rev-${i}`,
          rating:     r.rating,
          body:       r.comment ?? '',
          created_at: r.created_at,
          profile:    { display_name: r.users?.display_name ?? 'Usuario Anónimo' },
        }))
      );

      setAvatarUrl(profileRes.data.data.avatar_url);
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('refreshToken');
    setAuth('', '', '', '', '');
    navigate('/login', { replace: true });
  };

  // ── Estados de carga/error ───────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#110800] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-white/5 border-t-[#C1121F] rounded-full animate-spin" />
        <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.3em]">
          Sincronizando Mainframe...
        </p>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="min-h-screen bg-[#110800] flex flex-col items-center justify-center gap-4 p-6">
        <span className="text-5xl">⚠️</span>
        <p className="text-red-400 text-sm text-center">{error}</p>
        <button onClick={loadAll} className="bg-[#E85D04] text-white font-black px-6 py-3 rounded-2xl text-sm">
          Reintentar
        </button>
      </div>
    );
  }

  // ── Sin negocio registrado ───────────────────────────────────

  if (!metrics.has_business) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-[100dvh] bg-[#110800] text-[#FFF3DC] flex flex-col"
      >
        <div className="h-[3px] w-full flex">
          <div className="flex-1 bg-[#006847]" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-[#C1121F]" />
        </div>

        <header className="bg-[#110800]/80 backdrop-blur-xl border-b border-white/5 p-5">
          <div className="app-shell-form flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={garnachin} className="w-8 h-8 object-contain" alt="Logo" />
              <div>
                <h1 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#C1121F]">Control de Mando</h1>
                <p className="text-sm font-black italic text-white uppercase tracking-tighter leading-none mt-0.5">Owner Dashboard</p>
              </div>
            </div>
            <button onClick={handleLogout} className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#C1121F] hover:bg-white/10 active:scale-90 transition-all">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <main className="app-shell-form w-full p-4 flex flex-col gap-8 flex-1 sm:p-5 lg:p-6">
          <section className="pt-4">
            <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.3em]">Bienvenido,</p>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white mt-1">{displayName}</h2>
          </section>

          <section className="relative overflow-hidden bg-white/5 border border-[#C1121F]/20 rounded-[2.5rem] p-7">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#C1121F]/10 blur-3xl rounded-full pointer-events-none" />
            <div className="relative space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#C1121F]/15 rounded-2xl">
                  <Sparkles size={20} className="text-[#C1121F]" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">Tu negocio te espera</p>
                  <h3 className="text-base font-black italic uppercase tracking-tighter text-white">Faltan 2 pasos</h3>
                </div>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">
                Configura tu negocio en minutos y empieza a aparecer en el mapa de OLA MX para miles de viajeros.
              </p>
              <div className="space-y-3">
                <StepItem number="01" icon="🤖" title="Cuéntale a la IA de tu negocio" desc="Un chat rápido — nombre, categoría y especialidades" accent="border-[#C1121F]/30 bg-[#C1121F]/8" numberColor="text-[#C1121F]" />
                <StepItem number="02" icon="📍" title="Dirección y contacto" desc="Dónde encontrarte y cómo llamarte" accent="border-[#F4A300]/20 bg-[#F4A300]/5" numberColor="text-[#F4A300]" />
              </div>
              <button
                onClick={() => navigate('/owner/onboarding')}
                className="w-full bg-[#C1121F] text-white font-black py-4 rounded-2xl text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-[0_8px_25px_rgba(193,18,31,0.3)] active:scale-95 transition-all"
              >
                <Sparkles size={15} /> Empezar configuración <ChevronRight size={15} />
              </button>
            </div>
          </section>

          <section className="pt-4 mt-auto border-t border-white/5">
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 px-6 py-5 border border-[#C1121F]/30 rounded-2xl active:scale-95 transition-all">
              <LogOut size={18} className="text-[#C1121F]" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[#C1121F]">Cerrar Sesión</span>
            </button>
          </section>
        </main>
      </motion.div>
    );
  }

  // ── Dashboard principal ──────────────────────────────────────

  return (
    <>
      {/* Modal de avatar */}
      <AnimatePresence>
        {showAvatar && (
          <AvatarModal
            currentAvatar={avatarUrl}
            displayName={displayName ?? 'D'}
            onClose={() => setShowAvatar(false)}
            onSuccess={(url) => setAvatarUrl(url)}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-[100dvh] bg-[#110800] text-[#FFF3DC] flex flex-col pb-28"
      >
        {/* Bandera */}
        <div className="h-[3px] w-full flex sticky top-0 z-[60]">
          <div className="flex-1 bg-[#006847]" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-[#C1121F]" />
        </div>

        {/* Header */}
        <header className="bg-[#110800]/80 backdrop-blur-xl border-b border-white/5 p-5 sticky top-[3px] z-50">
          <div className="app-shell-form flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={garnachin} className="w-8 h-8 object-contain drop-shadow-md" alt="Logo" />
              <div>
                <h1 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#C1121F]">Control de Mando</h1>
                <p className="text-sm font-black italic text-white uppercase tracking-tighter leading-none mt-0.5">Owner Dashboard</p>
              </div>
            </div>

            {/* Avatar button — abre modal */}
            <button
              onClick={() => setShowAvatar(true)}
              className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#C1121F]/40 hover:border-[#C1121F] transition-all active:scale-90 relative group"
              style={{ background: '#1a0a02' }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center font-black text-[#F4A300] text-sm">
                  {(displayName ?? 'D')[0].toUpperCase()}
                </span>
              )}
              {/* Hover overlay con cámara */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={13} className="text-white" />
              </div>
            </button>
          </div>
        </header>

        <main className="app-shell-form w-full p-4 space-y-8 sm:p-5 lg:p-6">

          {/* Nombre + Status */}
          <section className="flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">
                {metrics.business_name}
              </h2>
              <div className="flex items-center gap-2 text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">
                <TrendingUp size={12} className="text-[#2D6A4F]" />
                Rendimiento 2026
              </div>
            </div>
            <StatusBadge status={metrics.status} />
          </section>

          {/* KPI Grid */}
          <section className="grid grid-cols-2 gap-3">
            <KPICard icon={<Eye size={18} />}           label="Vistas"   value={metrics.profile_views.toLocaleString()} sub={metrics.profile_views_today > 0 ? `+${metrics.profile_views_today} hoy` : undefined} accent="border-[#F4A300]/20 text-[#F4A300]" />
            <KPICard icon={<QrCode size={18} />}        label="QR Scans" value={metrics.checkin_count.toLocaleString()}  sub={metrics.checkin_count_today > 0 ? `+${metrics.checkin_count_today} hoy` : undefined}  accent="border-[#C1121F]/20 text-[#C1121F]" />
            <KPICard icon={<Star size={18} />}          label="Rating"   value={`${metrics.avg_rating.toFixed(1)} ★`}   accent="border-[#F4A300]/20 text-[#F4A300]" />
            <KPICard icon={<MessageSquare size={18} />} label="Reseñas"  value={metrics.review_count}                    accent="border-[#2D6A4F]/20 text-[#2D6A4F]" />
          </section>

          {/* Gráfica */}
          <section className="bg-white/5 border border-white/5 rounded-[2.5rem] p-6 space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Tráfico Semanal</h3>
            {metrics.daily_metrics.length > 0 ? (
              <div className="flex items-end justify-between h-28 gap-2 px-2">
                {metrics.daily_metrics.slice(-7).map((day, i, arr) => (
                  <Bar key={i} value={day.views} max={Math.max(...arr.map(d => d.views), 1)} date={day.date} isToday={i === arr.length - 1} />
                ))}
              </div>
            ) : (
              <p className="text-center text-white/20 text-xs py-4">Sin datos todavía</p>
            )}
          </section>

          {/* IA Insights — solo si tiene contenido real */}
          {isUsefulAiSummary(metrics.ai_summary) && (
            <section className="relative overflow-hidden bg-gradient-to-br from-[#2D6A4F]/10 to-transparent border border-[#2D6A4F]/20 rounded-[2.5rem] p-7">
              <div className="absolute top-[-20px] right-[-20px] opacity-10 pointer-events-none">
                <Sparkles size={100} />
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-[#52B788]/20 rounded-xl text-[#52B788]">
                  <Sparkles size={16} />
                </div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-[#52B788]">IA Insights</h3>
              </div>
              <p className="text-sm leading-relaxed text-white/70 italic">"{metrics.ai_summary}"</p>
            </section>
          )}

          {/* Reseñas recientes */}
          {reviews.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30">Feedback Reciente</h3>
                <ChevronRight size={14} className="text-white/20" />
              </div>
              <div className="space-y-3">
                {reviews.map(rev => (
                  <div key={rev.id} className="bg-white/5 border border-white/5 rounded-3xl p-5 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white">{rev.profile.display_name}</span>
                      <div className="flex text-[#F4A300]">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={10} fill={i < rev.rating ? 'currentColor' : 'none'} className={i < rev.rating ? '' : 'opacity-20'} />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed italic">"{rev.body}"</p>
                    <p className="text-[9px] font-bold text-white/20 uppercase">{new Date(rev.created_at).toLocaleDateString('es-MX')}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Acciones rápidas */}
          <section className="space-y-3 pt-4">
            <ActionButton onClick={() => navigate('/owner/edit')}  icon={<Edit3 size={16} />}  label="Gestionar Negocio" className="bg-white/5 border border-white/10 text-white" />
            <ActionButton onClick={() => navigate('/owner/qr')}    icon={<QrCode size={16} />} label="Mi Código QR"      className="bg-[#C1121F] border-transparent text-white shadow-lg shadow-[#C1121F]/20" />
          </section>

          {/* Perfil y Salida */}
          <section className="pt-10 border-t border-white/5 flex flex-col gap-4">

            {/* ← Ahora redirige a /owner/edit en lugar de /owner/profile */}
            <button
              onClick={() => navigate('/owner/edit')}
              className="flex items-center justify-between px-6 py-4 bg-white/5 rounded-2xl group active:scale-95 transition-all"
            >
              <div className="flex items-center gap-3">
                <User size={18} className="text-white/30 group-hover:text-[#F4A300] transition-colors" />
                <span className="text-[11px] font-black uppercase tracking-widest text-white/60 group-hover:text-white transition-colors">
                  Editar mi Negocio
                </span>
              </div>
              <ChevronRight size={16} className="text-white/20" />
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-3 px-6 py-5 border border-[#C1121F]/30 rounded-2xl group active:scale-95 transition-all"
            >
              <LogOut size={18} className="text-[#C1121F]" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[#C1121F]">Cerrar Sesión</span>
            </button>
          </section>

        </main>
      </motion.div>
    </>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function KPICard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; accent: string;
}) {
  return (
    <div className={`bg-white/5 border ${accent} p-5 rounded-[2rem] space-y-1`}>
      <div className="opacity-40 mb-2">{icon}</div>
      <div className="text-2xl font-black italic tracking-tighter text-white">{value}</div>
      <p className="text-[9px] font-black uppercase tracking-widest text-white/30">{label}</p>
      {sub && <p className="text-[9px] font-bold text-[#52B788] mt-1">{sub}</p>}
    </div>
  );
}

function Bar({ value, max, date, isToday }: { value: number; max: number; date: string; isToday: boolean }) {
  const pct = (value / max) * 100;
  const DAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  const label = DAY_LABELS[new Date(date).getDay()];
  return (
    <div className="flex-1 flex flex-col items-center gap-3 h-full justify-end px-1">
      <motion.div
        initial={{ height: 0 }}
        animate={{ height: `${Math.max(pct, 10)}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`w-full max-w-[14px] rounded-t-full relative ${isToday ? 'bg-[#C1121F]' : 'bg-[#F4A300]/20'}`}
      >
        {isToday && <div className="absolute inset-0 bg-[#C1121F] blur-md opacity-40 rounded-t-full" />}
      </motion.div>
      <span className="text-[8px] font-black text-white/20 uppercase">{label}</span>
    </div>
  );
}

function ActionButton({ onClick, icon, label, className }: {
  onClick: () => void; icon: React.ReactNode; label: string; className: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] active:scale-95 transition-all border ${className}`}
    >
      {icon} {label}
    </button>
  );
}

function StepItem({ number, icon, title, desc, accent, numberColor }: {
  number: string; icon: string; title: string; desc: string; accent: string; numberColor: string;
}) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-2xl border ${accent}`}>
      <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
        <span className={`text-[10px] font-black ${numberColor}`}>{number}</span>
        <span className="text-lg leading-none">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-wider text-white leading-tight">{title}</p>
        <p className="text-[10px] text-white/40 leading-snug mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
