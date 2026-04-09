/**
 * src/pages/admin/ReviewPage.tsx
 * A-2 — Revisión de negocio
 * Ruta: /admin/review/:businessId | Usuario: admin
 *
 * FIXES aplicados:
 *  1. Endpoint corregido: /api/v1/admin/businesses/:id  (era /api/v1/businesses/:id)
 *     La ruta pública filtra status='active', por eso los pendientes no aparecían.
 *  2. Tipo BusinessFull alineado con la respuesta real del backend admin:
 *     - categories: { slug, icon }  (era category_slug / category_icon planos)
 *     - profiles: { id, display_name }  (el email no viene del endpoint admin)
 *  3. catch mejorado: loggea el error real + muestra el código HTTP
 *  4. Botones Editar / Eliminar estilizados en el footer
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, CheckCircle2, XCircle,
  User, MapPin, Phone, Globe, CreditCard,
  Calendar, Info, AlertTriangle, Pencil, Trash2,
} from 'lucide-react';

import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import StatusBadge from '../../components/ui/StatusBadge';
import garnachin from '../../assets/garnachin.png';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface BusinessImage {
  id:           string;
  storage_path: string;
  is_primary:   boolean;
}

// FIX: alineado con lo que devuelve GET /api/v1/admin/businesses/:id
interface BusinessFull {
  id:           string;
  name:         string;
  description:  string | null;
  address:      string;
  city:         string;
  phone:        string | null;
  website:      string | null;
  accepts_card: boolean;
  status:       string;
  schedule:     Record<string, [string, string] | null> | null;
  images:       BusinessImage[];
  // El endpoint admin devuelve objetos anidados, no campos planos
  categories:   { slug: string; icon: string } | null;
  profiles:     { id: string; display_name: string } | null;  // email no viene del admin endpoint
}

type ActionStatus = 'idle' | 'approving' | 'rejecting' | 'done';

// ─── Constantes ───────────────────────────────────────────────────────────────

const SCHEDULE_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS: Record<string, string> = {
  mon: 'Lun', tue: 'Mar', wed: 'Mié',
  thu: 'Jue', fri: 'Vie', sat: 'Sáb', sun: 'Dom',
};

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ReviewPage() {
  const { businessId }            = useParams<{ businessId: string }>();
  const navigate                  = useNavigate();
  const { accessToken, userRole } = useAuthStore();

  const [business, setBusiness]           = useState<BusinessFull | null>(null);
  const [loading, setLoading]             = useState(true);
  const [actionStatus, setActionStatus]   = useState<ActionStatus>('idle');
  const [toast, setToast]                 = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [imgIndex, setImgIndex]           = useState(0);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);

  // Guard
  useEffect(() => {
    if (!accessToken) { navigate('/login', { replace: true }); return; }
    if (userRole && userRole !== 'admin') { navigate('/explore', { replace: true }); return; }
    if (businessId) loadBusiness();
  }, [accessToken, userRole, businessId]);

  async function loadBusiness() {
    setLoading(true);
    try {
      // FIX 1: ruta corregida a /admin/businesses/:id
      // La ruta pública /businesses/:id solo devuelve negocios con status='active'
      const res = await api.get<{ data: BusinessFull }>(`/api/v1/admin/businesses/${businessId}`);
      const data = res.data.data;
      data.images = [...(data.images ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
      setBusiness(data);
    } catch (err: any) {
      // FIX 2: loggea el error real para facilitar el debug
      const status  = err?.response?.status;
      const message = err?.response?.data?.error ?? err?.message ?? 'Error desconocido';
      console.error(`[ReviewPage] loadBusiness failed — HTTP ${status}:`, message);
      showToast(`Error ${status ?? ''}: ${message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleAction(action: 'approve' | 'reject') {
    if (!businessId) return;
    setConfirmAction(null);
    setActionStatus(action === 'approve' ? 'approving' : 'rejecting');

    try {
      await api.patch(`/api/v1/admin/businesses/${businessId}/status`, {
        status: action === 'approve' ? 'active' : 'rejected',
      });
      setActionStatus('done');
      showToast(
        action === 'approve'
          ? '¡Negocio aprobado! Ya aparece en el mapa.'
          : 'Negocio rechazado. El dueño será notificado.',
        action === 'approve' ? 'success' : 'error',
      );
      setTimeout(() => navigate('/admin'), 2200);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showToast(msg ?? 'Error al procesar la acción.', 'error');
      setActionStatus('idle');
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

  const isBusy = actionStatus === 'approving' || actionStatus === 'rejecting';
  const isDone = actionStatus === 'done';

  // Helpers para acceder a los datos anidados
  const categorySlug = business.categories?.slug ?? '—';
  const categoryIcon = business.categories?.icon ?? '🏪';
  const ownerName    = business.profiles?.display_name ?? 'Propietario';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[100dvh] bg-[#110800] text-[#FFF3DC] flex flex-col pb-52 sm:pb-40">

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

      {/* ── Modal de confirmación ── */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 10 }}
              className="w-full max-w-md max-h-[calc(100svh-2rem)] space-y-6 overflow-y-auto rounded-[2.5rem] border border-white/10 bg-[#1a1000] p-6 text-center shadow-2xl sm:max-h-[calc(100svh-3rem)] sm:p-8"
            >
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center
                              ${confirmAction === 'approve'
                                ? 'bg-[#2D6A4F]/20 text-[#2D6A4F]'
                                : 'bg-[#C1121F]/20 text-[#C1121F]'}`}>
                {confirmAction === 'approve'
                  ? <CheckCircle2 size={40} />
                  : <AlertTriangle size={40} />}
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">
                  ¿Confirmar Acción?
                </h3>
                <p className="text-xs text-crema/50 leading-relaxed font-medium">
                  {confirmAction === 'approve'
                    ? `Al aprobar, "${business.name}" será visible para todos los turistas.`
                    : `El dueño recibirá una notificación de rechazo y podrá corregir su información.`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="py-4 rounded-2xl bg-white/5 text-[10px] font-black uppercase tracking-widest border border-white/10"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleAction(confirmAction)}
                  className={`py-4 rounded-2xl text-white text-[10px] font-black uppercase tracking-widest
                              ${confirmAction === 'approve' ? 'bg-[#2D6A4F]' : 'bg-[#C1121F]'}`}
                >
                  {confirmAction === 'approve' ? 'Aprobar' : 'Rechazar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[#110800]/90 backdrop-blur-xl border-b-2 border-[#F4A300] p-4">
        <div className="app-shell-form flex items-center justify-between">
          <button
            onClick={() => navigate('/admin')}
            className="p-2 -ml-2 text-crema hover:text-[#F4A300] transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col items-center">
            <img src={garnachin} className="w-6 h-6 object-contain mb-1" alt="Admin" />
            <h1 className="text-[9px] font-black uppercase tracking-[0.3em] text-[#F4A300]">
              Expediente N° {business.id.slice(0, 5)}
            </h1>
          </div>
          {/* FIX: accede a categories?.icon en vez de category_icon */}
          <span className="text-lg">{categoryIcon}</span>
        </div>
      </header>

      {/* ── Contenido ── */}
      <main className="app-shell-form w-full">

        {/* Galería */}
        <div className="relative h-64 bg-white/5 overflow-hidden">
          {business.images.length > 0 ? (
            <>
              <img
                src={business.images[imgIndex].storage_path}
                alt={business.name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#110800] via-transparent to-transparent" />
              {business.images.length > 1 && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
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
              Sin imágenes adjuntas
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 -mt-6 relative z-10 space-y-8">

          {/* Info cabecera */}
          <div className="bg-[#110800] p-6 rounded-[2rem] border border-white/5 space-y-3 shadow-xl">
            <div className="flex justify-between items-start">
              {/* FIX: usa categorySlug en vez de business.category_slug */}
              <span className="text-[10px] font-black uppercase tracking-widest text-rojo">
                {categorySlug}
              </span>
              <StatusBadge status={business.status as any} />
            </div>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">
              {business.name}
            </h2>
            <div className="flex items-center gap-2 text-crema/40 text-[10px] font-black uppercase tracking-widest">
              <MapPin size={12} className="text-[#F4A300]" />
              {business.city?.toUpperCase()}
            </div>
          </div>

          {/* Detalles del establecimiento */}
          <section className="space-y-4">
            <SectionHeader icon={<Info size={14} />} title="Detalles del Establecimiento" />
            <div className="grid grid-cols-1 gap-1 bg-white/5 border border-white/5 rounded-3xl overflow-hidden">
              <ReviewRow icon={<MapPin size={14} />}     label="Dirección" value={business.address} />
              <ReviewRow icon={<Phone size={14} />}      label="Contacto"  value={business.phone || 'No proporcionado'} />
              <ReviewRow icon={<Globe size={14} />}      label="Sitio Web" value={business.website || 'No disponible'} />
              <ReviewRow icon={<CreditCard size={14} />} label="Terminal"  value={business.accepts_card ? 'Acepta Tarjeta' : 'Solo Efectivo'} />
            </div>
          </section>

          {/* Dueño */}
          {/* FIX: usa business.profiles en vez de business.owner */}
          <section className="space-y-4">
            <SectionHeader icon={<User size={14} />} title="Perfil del Propietario" />
            <div className="flex items-center gap-4 p-5 bg-white/5 border border-white/5 rounded-3xl">
              <div className="w-12 h-12 bg-rojo/20 rounded-2xl flex items-center justify-center font-black text-rojo uppercase text-lg">
                {ownerName[0]}
              </div>
              <div>
                <p className="text-sm font-bold text-white">{ownerName}</p>
                {business.profiles?.id && (
                  <p className="text-[10px] text-crema/30 font-bold uppercase tracking-tighter mt-1 font-mono">
                    {business.profiles.id.slice(0, 12)}…
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Horario */}
          {business.schedule && (
            <section className="space-y-4">
              <SectionHeader icon={<Calendar size={14} />} title="Horarios de Operación" />
              <div className="bg-white/5 border border-white/5 rounded-3xl p-5 space-y-3">
                {SCHEDULE_KEYS.map((key) => {
                  const hours = business.schedule?.[key];
                  return (
                    <div key={key} className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-crema/20">
                        {DAY_LABELS[key]}
                      </span>
                      <span className={`text-xs font-bold ${hours ? 'text-crema/70' : 'text-crema/20'}`}>
                        {hours ? `${hours[0]} – ${hours[1]}` : 'Cerrado'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Descripción */}
          {business.description && (
            <section className="space-y-3 pb-10">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-crema/30">
                Descripción del Dueño
              </h3>
              <p className="text-sm italic leading-relaxed text-crema/60">
                "{business.description}"
              </p>
            </section>
          )}
        </div>
      </main>

      {/* ── Footer Acciones ── */}
      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#110800] via-[#110800] to-transparent z-[90]">
        <div className="app-shell-form space-y-3">

          {/* Fila 1: Rechazar / Aprobar */}
          <div className="grid grid-cols-2 gap-4">
            <button
              disabled={isBusy || isDone}
              onClick={() => setConfirmAction('reject')}
              className="flex items-center justify-center gap-2 py-4
                         bg-white/5 backdrop-blur-md border border-[#C1121F]/30
                         text-[#C1121F] rounded-2xl font-black uppercase text-[10px] tracking-widest
                         active:scale-95 transition-all disabled:opacity-30"
            >
              {actionStatus === 'rejecting'
                ? <div className="w-4 h-4 border-2 border-[#C1121F]/30 border-t-[#C1121F] rounded-full animate-spin" />
                : <XCircle size={16} />}
              {actionStatus === 'rejecting' ? 'Rechazando...' : 'Rechazar'}
            </button>

            <button
              disabled={isBusy || isDone}
              onClick={() => setConfirmAction('approve')}
              className="flex items-center justify-center gap-2 py-4
                         bg-[#2D6A4F] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest
                         shadow-lg shadow-[#2D6A4F]/20 active:scale-95 transition-all disabled:opacity-30"
            >
              {actionStatus === 'approving'
                ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                : <CheckCircle2 size={16} />}
              {actionStatus === 'approving' ? 'Aprobando...' : 'Aprobar'}
            </button>
          </div>

          {/* Fila 2: Editar / Eliminar — FIX: estilizados */}
          <div className="grid grid-cols-2 gap-4">
            <button
              disabled={isBusy || isDone}
              onClick={() => navigate(`/admin/businesses/${businessId}/edit`)}
              className="flex items-center justify-center gap-2 py-3
                         bg-white/5 border border-[#F4A300]/30
                         text-[#F4A300] rounded-2xl font-black uppercase text-[10px] tracking-widest
                         active:scale-95 transition-all disabled:opacity-30"
            >
              <Pencil size={14} /> Editar
            </button>

            <button
              disabled={isBusy || isDone}
              onClick={() => navigate(`/admin/businesses/${businessId}/delete`)}
              className="flex items-center justify-center gap-2 py-3
                         bg-white/5 border border-[#C1121F]/20
                         text-[#C1121F]/70 rounded-2xl font-black uppercase text-[10px] tracking-widest
                         active:scale-95 transition-all disabled:opacity-30"
            >
              <Trash2 size={14} /> Eliminar
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
    <div className="flex items-center gap-2 px-2">
      <span className="text-[#F4A300]">{icon}</span>
      <h2 className="text-[10px] font-black uppercase tracking-widest text-crema/40">{title}</h2>
    </div>
  );
}

function ReviewRow({
  icon, label, value,
}: {
  icon:   React.ReactNode;
  label:  string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-4 px-5 py-4 border-b border-white/5 last:border-0">
      <div className="text-[#F4A300] opacity-40">{icon}</div>
      <div className="min-w-0">
        <p className="text-[8px] font-black uppercase tracking-tighter text-crema/20">{label}</p>
        <p className="text-xs font-bold text-crema/80 break-words">{value}</p>
      </div>
    </div>
  );
}
