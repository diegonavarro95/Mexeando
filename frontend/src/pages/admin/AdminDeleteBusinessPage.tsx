/**
 * src/pages/admin/AdminDeleteBusinessPage.tsx
 * A-5 — Eliminar negocio (soft delete, admin)
 * Ruta: /admin/businesses/:businessId/delete | Usuario: admin
 *
 * DELETE /api/v1/admin/businesses/:id
 *
 * Esta página actúa como pantalla de confirmación explícita antes
 * del soft-delete. Muestra los datos del negocio y requiere que el
 * admin escriba el nombre para confirmar, igual que GitHub o Supabase.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, AlertTriangle, Trash2,
  MapPin, User, Info,
} from 'lucide-react';

import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import StatusBadge from '../../components/ui/StatusBadge';
import garnachin from '../../assets/garnachin.png';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface BusinessFull {
  id:          string;
  name:        string;
  city:        string;
  status:      string;
  address:     string;
  categories?: { slug: string; icon: string };
  profiles?:   { id: string; display_name: string };
  created_at:  string;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminDeleteBusinessPage() {
  const { businessId }            = useParams<{ businessId: string }>();
  const navigate                  = useNavigate();
  const { accessToken, userRole } = useAuthStore();

  const [business, setBusiness]   = useState<BusinessFull | null>(null);
  const [loading, setLoading]     = useState(true);
  const [deleting, setDeleting]   = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Guard
  useEffect(() => {
    if (!accessToken) { navigate('/login', { replace: true }); return; }
    if (userRole && userRole !== 'admin') { navigate('/explore', { replace: true }); return; }
    if (businessId) loadBusiness();
  }, [accessToken, userRole, businessId]);

  async function loadBusiness() {
    setLoading(true);
    try {
      const res = await api.get<{ data: BusinessFull }>(`/api/v1/admin/businesses/${businessId}`);
      setBusiness(res.data.data);
    } catch {
      showToast('No se pudo cargar el negocio.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleDelete() {
    if (!businessId || !business) return;
    if (confirmText.trim() !== business.name.trim()) {
      showToast('El nombre no coincide. Escríbelo exactamente.', 'error');
      return;
    }

    setDeleting(true);
    try {
      await api.delete(`/api/v1/admin/businesses/${businessId}`);
      showToast('Negocio eliminado correctamente.', 'success');
      setTimeout(() => navigate('/admin'), 2000);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Error al eliminar el negocio.';
      showToast(msg, 'error');
      setDeleting(false);
    }
  }

  // ── Estados de carga ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#110800] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-white/5 border-t-[#F4A300] rounded-full animate-spin" />
        <p className="text-crema/30 text-[10px] font-black uppercase tracking-[0.3em]">
          Cargando expediente...
        </p>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-[#110800] flex flex-col items-center justify-center gap-4 p-6">
        <span className="text-5xl">🔍</span>
        <p className="text-crema/50 text-sm text-center">Negocio no encontrado.</p>
        <button
          onClick={() => navigate('/admin')}
          className="bg-[#F4A300] text-[#110800] font-black px-6 py-3 rounded-2xl text-sm"
        >
          Volver al panel
        </button>
      </div>
    );
  }

  const nameMatches  = confirmText.trim() === business.name.trim();
  const createdAt    = new Date(business.created_at).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[100dvh] bg-[#110800] text-[#FFF3DC] flex flex-col pb-40">

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100]
                        px-6 py-3 rounded-2xl shadow-2xl
                        font-black uppercase text-[10px] tracking-widest border border-white/10
                        ${toast.type === 'success' ? 'bg-[#2D6A4F] text-white' : 'bg-[#C1121F] text-white'}`}
          >
            {toast.type === 'success' ? '✅ ' : '❌ '}{toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[#110800]/90 backdrop-blur-xl border-b-2 border-[#C1121F] p-4">
        <div className="app-shell-form flex items-center justify-between">
          <button
            onClick={() => navigate(`/admin/review/${businessId}`)}
            className="p-2 -ml-2 text-crema hover:text-[#F4A300] transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col items-center">
            <img src={garnachin} className="w-6 h-6 object-contain mb-1" alt="Admin" />
            <h1 className="text-[9px] font-black uppercase tracking-[0.3em] text-[#C1121F]">
              Zona de Peligro
            </h1>
          </div>
          <div className="w-6 h-6" />
        </div>
      </header>

      <main className="app-shell-form w-full px-4 pt-6 space-y-6 sm:px-5 lg:px-6">

        {/* ── Banner de advertencia ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-4 p-5
                     bg-[#C1121F]/10 border border-[#C1121F]/30 rounded-3xl"
        >
          <AlertTriangle size={22} className="text-[#C1121F] flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-black uppercase tracking-widest text-[#C1121F]">
              Acción irreversible
            </p>
            <p className="text-[10px] font-bold text-crema/50 leading-relaxed">
              El negocio quedará oculto en la plataforma (soft delete). Los datos
              históricos se conservan pero el dueño perderá acceso inmediatamente.
            </p>
          </div>
        </motion.div>

        {/* ── Datos del negocio ── */}
        <section className="space-y-3">
          <SectionHeader icon={<Info size={14} />} title="Negocio a eliminar" />
          <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden">
            <InfoRow label="Nombre"     value={business.name} />
            <InfoRow label="ID"         value={business.id} mono />
            <InfoRow
              label="Categoría"
              value={`${business.categories?.icon ?? ''} ${business.categories?.slug ?? '—'}`}
            />
            <InfoRow label="Registrado" value={createdAt} />
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeader icon={<MapPin size={14} />} title="Ubicación" />
          <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden">
            <InfoRow label="Ciudad"    value={business.city?.toUpperCase()} />
            <InfoRow label="Dirección" value={business.address} />
          </div>
        </section>

        {business.profiles && (
          <section className="space-y-3">
            <SectionHeader icon={<User size={14} />} title="Propietario" />
            <div className="flex items-center gap-4 p-5
                            bg-white/5 border border-white/5 rounded-3xl">
              <div className="w-10 h-10 bg-[#C1121F]/20 rounded-xl flex items-center justify-center
                              font-black text-[#C1121F] uppercase text-base">
                {business.profiles.display_name[0]}
              </div>
              <div>
                <p className="text-sm font-bold text-white">{business.profiles.display_name}</p>
                <p className="text-[9px] text-crema/30 font-bold uppercase tracking-tighter mt-0.5">
                  Perderá acceso al panel del negocio
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ── Estado actual ── */}
        <div className="flex items-center justify-between p-4
                        bg-white/5 border border-white/5 rounded-2xl">
          <span className="text-[10px] font-black uppercase tracking-widest text-crema/30">
            Estado actual
          </span>
          <StatusBadge status={business.status as any} />
        </div>

        {/* ── Confirmación por nombre ── */}
        <section className="space-y-3 pt-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-crema/40">
            Escribe el nombre del negocio para confirmar:
          </p>
          <p className="text-xs font-bold text-[#F4A300] font-mono px-1">
            {business.name}
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Escribe el nombre exacto..."
            className={`w-full px-4 py-3 rounded-2xl bg-white/5 border text-crema
                        focus:outline-none transition-colors placeholder:text-crema/20
                        ${confirmText.length > 0
                          ? nameMatches
                            ? 'border-[#2D6A4F]'
                            : 'border-[#C1121F]/60'
                          : 'border-white/10'
                        }`}
          />
          {confirmText.length > 0 && !nameMatches && (
            <p className="text-[9px] font-bold text-[#C1121F] px-1">
              ✗ El nombre no coincide
            </p>
          )}
          {nameMatches && (
            <p className="text-[9px] font-bold text-[#2D6A4F] px-1">
              ✓ Nombre verificado
            </p>
          )}
        </section>

        {/* ── Botones ── */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <button
            onClick={() => navigate(`/admin/review/${businessId}`)}
            disabled={deleting}
            className="py-4 border border-white/10 rounded-2xl
                       text-[10px] font-black uppercase tracking-widest text-crema/40
                       hover:bg-white/5 active:scale-95 transition-all disabled:opacity-30"
          >
            Cancelar
          </button>
          <button
            disabled={!nameMatches || deleting}
            onClick={handleDelete}
            className="flex items-center justify-center gap-2 py-4
                       bg-[#C1121F] text-white rounded-2xl
                       font-black uppercase text-[10px] tracking-widest
                       shadow-lg shadow-[#C1121F]/20 active:scale-95 transition-all
                       disabled:opacity-30"
          >
            {deleting
              ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              : <Trash2 size={14} />
            }
            {deleting ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>

      </main>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-[#F4A300]">{icon}</span>
      <h2 className="text-[10px] font-black uppercase tracking-widest text-crema/40">{title}</h2>
    </div>
  );
}

function InfoRow({
  label, value, mono = false,
}: {
  label: string;
  value?: string | null;
  mono?:  boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4
                    px-5 py-3 border-b border-white/5 last:border-0">
      <p className="text-[8px] font-black uppercase tracking-tighter text-crema/30 flex-shrink-0 pt-0.5">
        {label}
      </p>
      <p className={`text-xs font-bold text-crema/70 text-right break-all
                     ${mono ? 'font-mono text-[9px] text-crema/40' : ''}`}>
        {value}
      </p>
    </div>
  );
}
