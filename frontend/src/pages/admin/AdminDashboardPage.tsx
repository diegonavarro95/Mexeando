/**
 * src/pages/admin/AdminDashboardPage.tsx
 * A-1 — Dashboard global del administrador
 * Ruta: /admin | Usuario: admin
 * *
 * Spec §04 A-1:
 *  - 4 KPIs: negocios activos, visitas del día, negocios pendientes, rating global
 *  - Gráfica de check-ins por ciudad (CDMX, GDL, MTY)
 *  - Lista de negocios recientes con status y botón de ir a revisión
 *  - GET /api/v1/admin/metrics
 *  - GET /api/v1/admin/businesses
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Eye, Clock, Star,
  RefreshCw, ChevronRight, Bell, Pencil,
} from 'lucide-react';

import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import StatusBadge, { type BusinessStatus } from '../../components/ui/StatusBadge';
import garnachin from '../../assets/garnachin.png';
// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AdminMetrics {
  active_businesses:    number;
  pending_businesses:   number;
  total_checkins_today: number;
  avg_rating_global:    number;
  //FIX: Actualizado para que coincida con lo que manda el backend
  checkins_by_city: { 
    cdmx:        number;
    guadalajara: number;
    monterrey:   number;
  };
}

interface BusinessRow {
  id:            string;
  name:          string;
  category_slug: string;
  city:          string;
  status:        BusinessStatus;
  created_at:    string;
  owner?:        { display_name: string };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { accessToken, userRole, displayName } = useAuthStore();

  const [metrics, setMetrics]               = useState<AdminMetrics | null>(null);
  const [businesses, setBusinesses]         = useState<BusinessRow[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingBiz, setLoadingBiz]         = useState(true);
  const [error, setError]                   = useState<string | null>(null);

  // Guard: solo admin
  useEffect(() => {
    if (!accessToken) { navigate('/login', { replace: true }); return; }
    if (userRole && userRole !== 'admin') { navigate('/explore', { replace: true }); return; }
    loadAll();
  }, [accessToken, userRole]);

  async function loadAll() {
    setLoadingMetrics(true);
    setLoadingBiz(true);
    setError(null);
    try {
      const [mRes, bRes] = await Promise.all([
        api.get('/api/v1/admin/metrics'),
        api.get('/api/v1/admin/businesses'),
      ]);
      
      setMetrics(mRes.data?.data || mRes.data);
      
      // 🔥 FIX CRÍTICO: El backend devuelve un objeto { businesses: [...], total: X }
      // Así que tenemos que extraer específicamente la propiedad 'businesses'
      const dataBizPayload = bRes.data?.data || bRes.data;
      const arrayDeNegocios = dataBizPayload.businesses || [];
      
      // Aseguramos que sea un array para que .filter() nunca vuelva a crashear
      setBusinesses(Array.isArray(arrayDeNegocios) ? arrayDeNegocios : []);

    } catch (err: any) {
      const status = err.response?.status;
      const serverMsg = err.response?.data?.error;
      setError(`Error ${status}: ${serverMsg || 'No se pudo conectar con el servidor.'}`);
    } finally {
      setLoadingMetrics(false);
      setLoadingBiz(false);
    }
  }

  const loading = loadingMetrics || loadingBiz;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#110800] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-white/5 border-t-[#F4A300] rounded-full animate-spin" />
        <p className="text-crema/30 text-[10px] font-black uppercase tracking-[0.3em]">
          Accediendo al Mainframe...
        </p>
      </div>
    );
  }

  const pendingList = businesses.filter((b) => b.status === 'pending');
  const recentList = businesses.filter((b) => b.status === 'active');
  //const recentList  = businesses.slice(0, 10);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-[100dvh] bg-[#110800] text-[#FFF3DC] flex flex-col"
    >
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[#110800]/80 backdrop-blur-xl border-b-2 border-[#F4A300] px-4 py-4">
        <div className="app-shell-form flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={garnachin} className="w-8 h-8 object-contain" alt="Admin" />
            <div>
              <h1 className="text-[11px] font-black uppercase tracking-widest text-[#F4A300]">
                OLA MX — ADMIN
              </h1>
              <p className="text-[9px] text-crema/40 font-bold uppercase tracking-tighter italic">
                Panel de Administración
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell size={18} className="text-crema/40" />
              {pendingList.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#C1121F] rounded-full text-[8px] font-black flex items-center justify-center shadow-[0_0_10px_#C1121F]">
                  {pendingList.length}
                </span>
              )}
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#F4A300]/10 border border-[#F4A300]/30 flex items-center justify-center font-black text-[#F4A300] text-xs">
              {(displayName ?? 'A')[0].toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main className="app-shell-form flex-1 px-4 pt-6 pb-24 space-y-8 sm:px-5 lg:px-6">

        {/* ── Error ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-rojo/10 border border-rojo/30 text-rojo rounded-2xl px-4 py-3 text-xs font-bold"
            >
              ⚠️ {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── KPI Grid ── */}
        {metrics && (
          <section className="grid grid-cols-2 gap-3">
            <KPICard
              icon={<Users className="text-[#2D6A4F]" size={18} />}
              label="Negocios Activos"
              value={metrics.active_businesses.toLocaleString()}
              accent="border-[#2D6A4F]/20"
            />
            <KPICard
              icon={<Eye className="text-[#F4A300]" size={18} />}
              label="Visitas Hoy"
              value={metrics.total_checkins_today.toLocaleString()}
              sub="+18% vs ayer"
              accent="border-[#F4A300]/20"
            />
            <KPICard
              icon={<Clock className="text-[#C1121F]" size={18} />}
              label="Pendientes"
              value={metrics.pending_businesses}
              highlight={metrics.pending_businesses > 0}
              accent="border-[#C1121F]/20"
              onClick={
                metrics.pending_businesses > 0
                  ? () => document.getElementById('pending-section')?.scrollIntoView({ behavior: 'smooth' })
                  : undefined
              }
            />
            <KPICard
              icon={<Star className="text-[#F4A300]" size={18} />}
              label="Rating Global"
              value={metrics.avg_rating_global.toFixed(1) + ' ★'}
              sub="Satisfacción"
              accent="border-[#F4A300]/20"
            />
          </section>
        )}

        {/* ── City Chart ── */}
        {metrics && (
          <section className="bg-white/5 border border-white/5 rounded-3xl p-5 space-y-6">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-crema/30">
              Check-ins hoy por ciudad
            </h2>
            <div className="flex items-end justify-between gap-4 h-32 px-4">
              {/* 🔥 FIX: Cambiado a checkins_by_city */}
              <Bar label="CDMX" value={metrics.checkins_by_city.cdmx}        max={500} color="bg-[#C1121F]" />
              <Bar label="GDL"  value={metrics.checkins_by_city.guadalajara} max={500} color="bg-[#F4A300]" />
              <Bar label="MTY"  value={metrics.checkins_by_city.monterrey}   max={500} color="bg-[#2D6A4F]" />
            </div>
          </section>
        )}

        {/* ── Pendientes de aprobación ── */}
        {pendingList.length > 0 && (
          <section id="pending-section" className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C1121F]">
                Acción Requerida
              </h2>
              <span className="w-1.5 h-1.5 rounded-full bg-[#C1121F] animate-ping" />
              <span className="ml-1 bg-[#C1121F] text-crema text-[9px] font-black px-2 py-0.5 rounded-full">
                {pendingList.length}
              </span>
            </div>
            <div className="space-y-3">
              {pendingList.map((b) => (
                <button
                  key={b.id}
                  onClick={() => navigate(`/admin/review/${b.id}`)}
                  className="w-full flex items-center justify-between p-4
                             bg-[#C1121F]/5 border border-[#C1121F]/20 rounded-2xl
                             hover:bg-[#C1121F]/10 active:scale-[0.98] transition-all group"
                >
                  <div className="text-left min-w-0 flex-1 pr-4">
                    <p className="text-sm font-bold text-white truncate">{b.name}</p>
                    <p className="text-[10px] font-bold text-crema/30 uppercase">
                      {b.city?.toUpperCase()} · {b.category_slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={b.status} />
                    <ChevronRight
                      size={18}
                      className="text-[#C1121F] group-hover:translate-x-1 transition-transform"
                    />
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Negocios Recientes ── */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-crema/30">
            Negocios Recientes
          </h2>
          {recentList.length === 0 ? (
            <p className="text-center text-crema/30 text-sm py-8">
              Sin negocios registrados
            </p>
          ) : (
            <div className="space-y-2">
              {recentList.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">{b.name}</p>
                    <p className="text-[9px] font-medium text-crema/20 uppercase tracking-tighter">
                      {b.city?.toUpperCase()} · {b.category_slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={b.status} />
                    {b.status === 'active' && (
                      <button
                        onClick={() => navigate(`/admin/review/${b.id}`)}
                        className="bg-[#F4A300] text-[#110800] text-[10px] font-black
                                   px-2.5 py-1 rounded-lg hover:bg-[#F4A300]/80 transition-colors"
                      >
                        Revisar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Refrescar ── */}
        <button
          onClick={loadAll}
          className="w-full flex items-center justify-center gap-2 py-4
                     border border-white/10 rounded-2xl
                     text-[10px] font-black uppercase tracking-widest text-crema/40
                     hover:bg-white/5 active:scale-95 transition-all"
        >
          <RefreshCw size={14} /> Sincronizar Datos
        </button>

        {/* ── Crear negocio ──*/}
        <button
          onClick={() => navigate(`/admin/businesses/new`)}
          className="w-full flex items-center justify-center gap-2 py-4
                     border border-white/10 rounded-2xl
                     text-[10px] font-black uppercase tracking-widest text-crema/40
                     hover:bg-white/5 active:scale-95 transition-all"
        >
          <Pencil size={14} /> Registrar nuevo negocio
        </button>

      </main>
    </motion.div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function KPICard({
  icon, label, value, sub, accent, highlight, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  highlight?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`bg-white/5 border ${accent} p-4 rounded-3xl space-y-1 relative overflow-hidden
                  text-left transition-all
                  ${onClick ? 'cursor-pointer hover:bg-white/10 active:scale-95' : ''}`}
    >
      {highlight && (
        <div className="absolute top-0 right-0 w-8 h-8 bg-[#C1121F]/10 blur-xl" />
      )}
      <div className="mb-2 opacity-60">{icon}</div>
      <div className="text-2xl font-black italic tracking-tighter text-white">{value}</div>
      <div className="text-[9px] font-black uppercase tracking-tighter text-crema/30">{label}</div>
      {sub && <div className="text-[9px] font-bold text-[#2D6A4F] mt-1">{sub}</div>}
    </Tag>
  );
}

function Bar({
  label, value, max, color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = `${Math.max((value / max) * 100, 4)}%`;
  return (
    <div className="flex-1 flex flex-col items-center gap-3 h-full justify-end">
      <span className="text-[10px] font-black text-white">{value}</span>
      <motion.div
        initial={{ height: 0 }}
        animate={{ height: pct }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`w-full max-w-[40px] ${color} rounded-t-xl relative shadow-[0_0_20px_rgba(0,0,0,0.3)]`}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      </motion.div>
      <span className="text-[9px] font-black text-crema/20 uppercase tracking-widest">{label}</span>
    </div>
  );
}
