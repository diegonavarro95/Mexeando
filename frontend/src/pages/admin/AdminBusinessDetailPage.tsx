/**
 * src/pages/admin/AdminBusinessDetailPage.tsx
 * A-6 — Detalle de negocio aprobado (admin)
 * Ruta: /admin/businesses/:businessId | Usuario: admin
 *
 * Para negocios con status: 'active' | 'inactive'
 * Diferencias clave vs ReviewPage (A-2, para pendientes):
 *  - Muestra métricas reales: rating, check-ins, reseñas, sello Ola
 *  - Acciones de status: Desactivar (active→inactive) | Reactivar (inactive→active)
 *                        Enviar a revisión (→pending)
 *  - Botones secundarios: Editar datos, Eliminar (soft delete)
 *  - Modal de confirmación con campo de razón para cambios de estado
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Phone, Globe, CreditCard,
  Calendar, Info, User, Star, CheckCircle2,
  Pencil, Trash2, ShieldAlert, ToggleLeft, ToggleRight,
  Award, TrendingUp, MessageSquare,
} from 'lucide-react';

import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import StatusBadge from '../../components/ui/StatusBadge';
import AdminTopBar from '../../components/admin/AdminTopBar';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface BusinessImage {
  id:           string;
  storage_path: string;
  is_primary:   boolean;
}

interface BusinessFull {
  id:               string;
  name:             string;
  slug:             string;
  description:      string | null;
  address:          string;
  city:             string;
  phone:            string | null;
  website:          string | null;
  accepts_card:     boolean;
  status:           'active' | 'inactive' | 'pending' | 'rejected';
  ola_verified:     boolean;
  ola_verified_at:  string | null;
  updated_at:       string;
  avg_rating:       number;
  review_count:     number;
  checkin_count:    number;
  recent_heat_score: number;
  schedule:         Record<string, [string, string] | null> | null;
  created_at:       string;
  images:           BusinessImage[];
  categories:       { slug: string; icon: string } | null;
  profiles:         { id: string; display_name: string; avatar_url: string | null } | null;
}

type ModalType = 'deactivate' | 'reactivate' | 'send_review' | null;

// ─── Constantes ───────────────────────────────────────────────────────────────

const SCHEDULE_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS: Record<string, string> = {
  mon: 'Lun', tue: 'Mar', wed: 'Mié',
  thu: 'Jue', fri: 'Vie', sat: 'Sáb', sun: 'Dom',
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminBusinessDetailPage() {
  const { businessId }            = useParams<{ businessId: string }>();
  const navigate                  = useNavigate();
  const { accessToken, userRole } = useAuthStore();
  const supabaseUrl               = import.meta.env.VITE_SUPABASE_URL;

  const [business, setBusiness]     = useState<BusinessFull | null>(null);
  const [loading, setLoading]       = useState(true);
  const [busy, setBusy]             = useState(false);
  const [imgIndex, setImgIndex]     = useState(0);
  const [modal, setModal]           = useState<ModalType>(null);
  const [reason, setReason]         = useState('');
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

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
      const data = res.data.data;
      data.images = [...(data.images ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));

      if (data.status === 'pending' || (data.status === 'active' && !data.ola_verified)) {
        navigate(`/admin/review/${data.id}`, { replace: true });
        return;
      }

      setBusiness(data);
    } catch (err: any) {
      const status  = err?.response?.status;
      const message = err?.response?.data?.error ?? err?.message ?? 'Error desconocido';
      console.error(`[AdminBusinessDetailPage] HTTP ${status}:`, message);
      showToast(`Error ${status ?? ''}: ${message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleStatusChange(newStatus: 'active' | 'inactive' | 'pending') {
    if (!businessId) return;
    setBusy(true);
    setModal(null);

    try {
      await api.patch(`/api/v1/admin/businesses/${businessId}/status`, {
        status: newStatus,
        ...(reason.trim() ? { rejection_reason: reason.trim() } : {}),
      });

      const messages: Record<string, string> = {
        active:   'Negocio reactivado correctamente.',
        inactive: 'Negocio desactivado. Ya no aparece en el mapa.',
        pending:  'Se solicitó revisión de cambios al owner.',
      };

      showToast(messages[newStatus], newStatus === 'active' ? 'success' : 'error');
      setReason('');

      // Recargar el negocio para reflejar el nuevo status
      setTimeout(() => loadBusiness(), 1200);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Error al cambiar el estado.';
      showToast(msg, 'error');
    } finally {
      setBusy(false);
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

  const categorySlug = business.categories?.slug ?? '—';
  const categoryIcon = business.categories?.icon ?? '🏪';
  const ownerName    = business.profiles?.display_name ?? 'Propietario';
  const isActive     = business.status === 'active';
  const hasOwnerUpdates =
    Boolean(business.ola_verified) &&
    Boolean(business.updated_at) &&
    Boolean(business.ola_verified_at) &&
    new Date(business.updated_at).getTime() > new Date(business.ola_verified_at ?? '').getTime();
  const createdAt    = new Date(business.created_at).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const getImageUrl = (path: string) => (
    /^https?:\/\//i.test(path)
      ? path
      : `${supabaseUrl}/storage/v1/object/public/business_images/${path}`
  );

  // Config del modal según la acción seleccionada
  const MODAL_CONFIG = {
    deactivate: {
      title:        'Desactivar negocio',
      description:  `"${business.name}" dejará de aparecer en el mapa. El dueño recibirá una notificación.`,
      confirmLabel: 'Desactivar',
      confirmClass: 'bg-[#C1121F]',
      onConfirm:    () => handleStatusChange('inactive'),
      hasReason:    true,
    },
    reactivate: {
      title:        'Reactivar negocio',
      description:  `"${business.name}" volverá a aparecer en el mapa inmediatamente.`,
      confirmLabel: 'Reactivar',
      confirmClass: 'bg-[#2D6A4F]',
      onConfirm:    () => handleStatusChange('active'),
      hasReason:    false,
    },
    send_review: {
      title:        'Solicitar revisión de cambios',
      description:  `Se notificará al owner para revisar y confirmar los cambios recientes de "${business.name}".`,
      confirmLabel: 'Solicitar revisión',
      confirmClass: 'bg-[#F4A300] text-[#110800]',
      onConfirm:    () => handleStatusChange('pending'),
      hasReason:    true,
    },
  };

  const activeModal = modal ? MODAL_CONFIG[modal] : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[100dvh] bg-[#110800] text-[#FFF3DC] flex flex-col pb-44">

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100]
                        px-6 py-3 rounded-2xl shadow-2xl font-black uppercase
                        text-[10px] tracking-widest border border-white/10
                        ${toast.type === 'success' ? 'bg-[#2D6A4F] text-white' : 'bg-[#C1121F] text-white'}`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal de confirmación ── */}
      <AnimatePresence>
        {modal && activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-end justify-center p-6 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              className="w-full max-w-lg bg-[#1a0e00] border border-white/10 rounded-3xl p-6 space-y-4"
            >
              <div className="space-y-1">
                <p className="text-sm font-black uppercase tracking-widest text-crema/90">
                  {activeModal.title}
                </p>
                <p className="text-[11px] text-crema/40 font-bold leading-relaxed">
                  {activeModal.description}
                </p>
              </div>

              {activeModal.hasReason && (
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase tracking-widest text-crema/30">
                    Razón (opcional — se notifica al dueño)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    maxLength={400}
                    placeholder="Ej: Información desactualizada, fotos incorrectas..."
                    className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10
                               text-crema text-xs focus:outline-none focus:border-[#F4A300]/40
                               placeholder:text-crema/20 resize-none transition-colors"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => { setModal(null); setReason(''); }}
                  className="py-3 rounded-2xl border border-white/10 text-crema/50
                             font-black uppercase text-[10px] tracking-widest
                             hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  disabled={busy}
                  onClick={activeModal.onConfirm}
                  className={`py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest
                              text-white shadow-lg active:scale-95 transition-all disabled:opacity-40
                              ${activeModal.confirmClass}`}
                >
                  {busy
                    ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
                    : activeModal.confirmLabel
                  }
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AdminTopBar
        title="Detalle del Negocio"
        subtitle="Negocio Activo"
        onBack={() => navigate('/admin')}
        rightSlot={
          business.ola_verified
            ? <span title="Verificado Ola México" className="text-[#F4A300] mt-2 mr-2"><Award size={20} /></span>
            : <div className="w-10 h-10" />
        }
      />

      {/* ── Contenido ── */}
      <main className="max-w-md mx-auto w-full">

        {/* Galería */}
        <div className="relative h-56 bg-white/5 overflow-hidden">
          {business.images.length > 0 ? (
            <>
              <img
                src={getImageUrl(business.images[imgIndex].storage_path)}
                alt={business.name}
                className="w-full h-full object-cover"
                onError={() => {
                  console.error('[AdminBusinessDetailPage] Error cargando imagen:', business.images[imgIndex]?.storage_path);
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#110800] via-transparent to-transparent" />
              {business.images.length > 1 && (
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
                  {business.images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setImgIndex(i)}
                      className={`h-1.5 rounded-full transition-all
                                  ${i === imgIndex ? 'bg-[#F4A300] w-6' : 'bg-white/20 w-2'}`}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-crema/20 italic text-xs uppercase font-black tracking-widest">
              Sin imágenes
            </div>
          )}
        </div>

        {business.images.length > 1 && (
          <div className="px-6 -mt-4 relative z-20">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {business.images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setImgIndex(i)}
                  className={`w-16 h-16 rounded-2xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                    i === imgIndex ? 'border-[#F4A300] scale-105' : 'border-white/10 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={getImageUrl(img.storage_path)}
                    alt={`Foto ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 -mt-6 relative z-10 space-y-6">

          {/* ── Cabecera del negocio ── */}
          <div className="bg-[#110800] p-6 rounded-[2rem] border border-white/5 space-y-3 shadow-xl">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#2D6A4F]">
                {categoryIcon} {categorySlug}
              </span>
              <StatusBadge status={business.status as any} />
            </div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-tight">
              {business.name}
            </h2>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1.5 text-crema/40 text-[10px] font-black uppercase tracking-widest">
                <MapPin size={11} className="text-[#F4A300]" />
                {business.city?.toUpperCase()}
              </span>
              <span className="text-crema/20 text-[10px] font-bold">
                Desde {createdAt}
              </span>
            </div>
          </div>

          {/* ── KPIs del negocio ── */}
          <section className="grid grid-cols-3 gap-3">
            <MetricCard
              icon={<Star size={14} className="text-[#F4A300]" />}
              value={Number(business.avg_rating).toFixed(1)}
              label="Rating"
              accent="border-[#F4A300]/20"
            />
            <MetricCard
              icon={<TrendingUp size={14} className="text-[#2D6A4F]" />}
              value={business.checkin_count.toLocaleString()}
              label="Check-ins"
              accent="border-[#2D6A4F]/20"
            />
            <MetricCard
              icon={<MessageSquare size={14} className="text-crema/40" />}
              value={business.review_count.toLocaleString()}
              label="Reseñas"
              accent="border-white/10"
            />
          </section>

          {/* Sello Ola */}
          {business.ola_verified && (
            <div className="flex items-center gap-3 px-5 py-4
                            bg-[#F4A300]/5 border border-[#F4A300]/20 rounded-2xl">
              <Award size={18} className="text-[#F4A300] flex-shrink-0" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#F4A300]">
                  Verificado Ola México
                </p>
                {business.ola_verified_at && (
                  <p className="text-[9px] text-crema/30 font-bold mt-0.5">
                    {new Date(business.ola_verified_at).toLocaleDateString('es-MX', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </p>
                )}
              </div>
              <CheckCircle2 size={16} className="text-[#F4A300] ml-auto flex-shrink-0" />
            </div>
          )}

          {hasOwnerUpdates && (
            <div className="flex items-start gap-3 px-5 py-4 bg-[#F4A300]/8 border border-[#F4A300]/20 rounded-2xl">
              <ShieldAlert size={18} className="text-[#F4A300] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#F4A300]">
                  Cambios del Owner
                </p>
                <p className="text-[11px] text-crema/50 font-bold leading-relaxed mt-1">
                  Este negocio fue modificado después de su última aprobación. Sigue activo, pero conviene revisar los cambios.
                </p>
              </div>
            </div>
          )}

          {/* ── Detalles ── */}
          <section className="space-y-3">
            <SectionHeader icon={<Info size={14} />} title="Detalles del Establecimiento" />
            <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden">
              <DetailRow icon={<MapPin size={14} />}     label="Dirección" value={business.address} />
              <DetailRow icon={<Phone size={14} />}      label="Teléfono"  value={business.phone} fallback="No proporcionado" />
              <DetailRow icon={<Globe size={14} />}      label="Website"   value={business.website} fallback="No disponible" />
              <DetailRow icon={<CreditCard size={14} />} label="Terminal"  value={business.accepts_card ? 'Acepta Tarjeta' : 'Solo Efectivo'} />
            </div>
          </section>

          {/* ── Propietario ── */}
          <section className="space-y-3">
            <SectionHeader icon={<User size={14} />} title="Propietario" />
            <div className="flex items-center gap-4 p-5 bg-white/5 border border-white/5 rounded-3xl">
              <div className="w-12 h-12 bg-[#2D6A4F]/20 rounded-2xl flex items-center justify-center
                              font-black text-[#2D6A4F] uppercase text-lg flex-shrink-0">
                {ownerName[0]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{ownerName}</p>
                {business.profiles?.id && (
                  <p className="text-[9px] text-crema/30 font-mono mt-0.5">
                    {business.profiles.id.slice(0, 16)}…
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ── Horario ── */}
          {business.schedule && Object.keys(business.schedule).length > 0 && (
            <section className="space-y-3">
              <SectionHeader icon={<Calendar size={14} />} title="Horario de Operación" />
              <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden">
                {SCHEDULE_KEYS.map((key, i) => {
                  const hours = business.schedule?.[key];
                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between px-5 py-3
                                  ${i < SCHEDULE_KEYS.length - 1 ? 'border-b border-white/5' : ''}`}
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest text-crema/30 w-8">
                        {DAY_LABELS[key]}
                      </span>
                      <span className={`text-xs font-bold ${hours ? 'text-crema/70' : 'text-crema/20 italic'}`}>
                        {hours ? `${hours[0]} — ${hours[1]}` : 'Cerrado'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Descripción ── */}
          {business.description && (
            <section className="space-y-3 pb-6">
              <SectionHeader icon={<Info size={14} />} title="Descripción" />
              <p className="text-sm italic leading-relaxed text-crema/50 px-1">
                "{business.description}"
              </p>
            </section>
          )}

        </div>
      </main>

      {/* ── Footer de acciones ── */}
      <footer className="fixed bottom-0 left-0 right-0 p-5
                         bg-gradient-to-t from-[#110800] via-[#110800]/95 to-transparent z-[90]">
        <div className="max-w-lg mx-auto space-y-3">

          {/* Fila 1: acción principal de status */}
          <div className="grid grid-cols-2 gap-3">

            {/* Desactivar / Reactivar */}
            {isActive ? (
              <button
                disabled={busy}
                onClick={() => setModal('deactivate')}
                className="flex items-center justify-center gap-2 py-4
                           bg-white/5 border border-[#C1121F]/30 text-[#C1121F]
                           rounded-2xl font-black uppercase text-[10px] tracking-widest
                           active:scale-95 transition-all disabled:opacity-30"
              >
                <ToggleLeft size={16} /> Desactivar
              </button>
            ) : (
              <button
                disabled={busy}
                onClick={() => setModal('reactivate')}
                className="flex items-center justify-center gap-2 py-4
                           bg-[#2D6A4F] text-white
                           rounded-2xl font-black uppercase text-[10px] tracking-widest
                           shadow-lg shadow-[#2D6A4F]/20 active:scale-95 transition-all disabled:opacity-30"
              >
                <ToggleRight size={16} /> Reactivar
              </button>
            )}

            {/* Solicitar revisión de cambios */}
            <button
              disabled={busy}
              onClick={() => setModal('send_review')}
              className="flex items-center justify-center gap-2 py-4
                         bg-[#F4A300]/10 border border-[#F4A300]/30 text-[#F4A300]
                         rounded-2xl font-black uppercase text-[10px] tracking-widest
                         active:scale-95 transition-all disabled:opacity-30"
            >
              <ShieldAlert size={16} /> Solicitar Revisión
            </button>
          </div>

          {/* Fila 2: Editar / Eliminar */}
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={busy}
              onClick={() => navigate(`/admin/businesses/${businessId}/edit`)}
              className="flex items-center justify-center gap-2 py-3
                         bg-white/5 border border-white/10 text-crema/60
                         rounded-2xl font-black uppercase text-[10px] tracking-widest
                         active:scale-95 transition-all disabled:opacity-30"
            >
              <Pencil size={13} /> Editar
            </button>
            <button
              disabled={busy}
              onClick={() => navigate(`/admin/businesses/${businessId}/delete`)}
              className="flex items-center justify-center gap-2 py-3
                         bg-white/5 border border-[#C1121F]/15 text-[#C1121F]/60
                         rounded-2xl font-black uppercase text-[10px] tracking-widest
                         active:scale-95 transition-all disabled:opacity-30"
            >
              <Trash2 size={13} /> Eliminar
            </button>
          </div>

        </div>
      </footer>
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

function DetailRow({
  icon, label, value, fallback,
}: {
  icon:      React.ReactNode;
  label:     string;
  value?:    string | null;
  fallback?: string;
}) {
  const display = value || fallback;
  if (!display) return null;
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-white/5 last:border-0">
      <div className="text-[#F4A300] opacity-40 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[8px] font-black uppercase tracking-tighter text-crema/20">{label}</p>
        <p className={`text-xs font-bold truncate ${value ? 'text-crema/80' : 'text-crema/30 italic'}`}>
          {display}
        </p>
      </div>
    </div>
  );
}

function MetricCard({
  icon, value, label, accent,
}: {
  icon:   React.ReactNode;
  value:  string;
  label:  string;
  accent: string;
}) {
  return (
    <div className={`bg-white/5 border ${accent} p-4 rounded-2xl flex flex-col items-center gap-1`}>
      <div className="opacity-70">{icon}</div>
      <span className="text-xl font-black italic tracking-tighter text-white">{value}</span>
      <span className="text-[8px] font-black uppercase tracking-widest text-crema/30">{label}</span>
    </div>
  );
}
