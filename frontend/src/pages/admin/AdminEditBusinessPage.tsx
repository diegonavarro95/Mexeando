/**
 * src/pages/admin/AdminEditBusinessPage.tsx
 * A-4 — Editar negocio (admin)
 * Ruta: /admin/businesses/:businessId/edit | Usuario: admin
 *
 * PATCH /api/v1/admin/businesses/:id
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Info, MapPin, Phone,
  CreditCard, Save, RefreshCw,
} from 'lucide-react';

import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import StatusBadge from '../../components/ui/StatusBadge';
import garnachin from '../../assets/garnachin.png';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface BusinessFull {
  id:           string;
  name:         string;
  description:  string | null;
  category_id:  number;
  address:      string;
  city:         'cdmx' | 'guadalajara' | 'monterrey';
  phone:        string | null;
  website:      string | null;
  accepts_card: boolean;
  status:       string;
  categories?:  { slug: string; icon: string };
  profiles?:    { id: string; display_name: string };
}

interface FormData {
  name:         string;
  description:  string;
  category_id:  number;
  address:      string;
  city:         'cdmx' | 'guadalajara' | 'monterrey';
  lat:          string;
  lng:          string;
  phone:        string;
  website:      string;
  accepts_card: boolean;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminEditBusinessPage() {
  const { businessId }            = useParams<{ businessId: string }>();
  const navigate                  = useNavigate();
  const { accessToken, userRole } = useAuthStore();

  const [business, setBusiness]   = useState<BusinessFull | null>(null);
  const [form, setForm]           = useState<FormData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [dirty, setDirty]         = useState(false);
  const [toast, setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

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
      setBusiness(data);
      setForm({
        name:         data.name         ?? '',
        description:  data.description  ?? '',
        category_id:  data.category_id  ?? 1,
        address:      data.address       ?? '',
        city:         data.city          ?? 'cdmx',
        lat:          '',
        lng:          '',
        phone:        data.phone         ?? '',
        website:      data.website       ?? '',
        accepts_card: data.accepts_card  ?? false,
      });
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

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;
    setForm((prev) => prev
      ? { ...prev, [name]: type === 'checkbox' ? target.checked : value }
      : prev
    );
    setDirty(true);
  }

  function handleDiscard() {
    if (dirty) { setConfirmDiscard(true); return; }
    navigate(`/admin/review/${businessId}`);
  }

  async function handleSave() {
    if (!form || !businessId) return;

    if (!form.name || !form.address) {
      showToast('Nombre y dirección son obligatorios.', 'error');
      return;
    }

    // Validar coordenadas solo si el usuario las ingresó
    const hasCoords = form.lat !== '' || form.lng !== '';
    if (hasCoords) {
      const lat = parseFloat(form.lat);
      const lng = parseFloat(form.lng);
      if (isNaN(lat) || isNaN(lng)) {
        showToast('Latitud y Longitud deben ser números válidos.', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name:         form.name,
        description:  form.description  || undefined,
        category_id:  form.category_id,
        address:      form.address,
        city:         form.city,
        phone:        form.phone        || undefined,
        website:      form.website      || undefined,
        accepts_card: form.accepts_card,
      };

      if (hasCoords) {
        payload.lat = parseFloat(form.lat);
        payload.lng = parseFloat(form.lng);
      }

      await api.patch(`/api/v1/admin/businesses/${businessId}`, payload);
      setDirty(false);
      showToast('Negocio actualizado correctamente.', 'success');
      setTimeout(() => navigate('/admin'), 1800);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Error al guardar cambios.';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
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

  if (!business || !form) {
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

      {/* ── Modal: descartar cambios ── */}
      <AnimatePresence>
        {confirmDiscard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] flex items-end justify-center p-6"
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              className="w-full max-w-lg bg-[#1a0e00] border border-white/10 rounded-3xl p-6 space-y-4"
            >
              <p className="text-sm font-black uppercase tracking-widest text-center text-crema/80">
                ¿Descartar cambios?
              </p>
              <p className="text-[10px] text-crema/40 text-center font-bold">
                Los cambios no guardados se perderán.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => setConfirmDiscard(false)}
                  className="py-3 rounded-2xl border border-white/10 text-crema/60
                             font-black uppercase text-[10px] tracking-widest
                             hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => navigate(`/admin/review/${businessId}`)}
                  className="py-3 rounded-2xl bg-[#C1121F] text-white
                             font-black uppercase text-[10px] tracking-widest
                             shadow-lg active:scale-95 transition-all"
                >
                  Descartar
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
            onClick={handleDiscard}
            className="p-2 -ml-2 text-crema hover:text-[#F4A300] transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col items-center">
            <img src={garnachin} className="w-6 h-6 object-contain mb-1" alt="Admin" />
            <h1 className="text-[9px] font-black uppercase tracking-[0.3em] text-[#F4A300]">
              Editar Negocio
            </h1>
          </div>
          {/* Indicador de cambios sin guardar */}
          {dirty
            ? <span className="w-2 h-2 rounded-full bg-[#F4A300] animate-pulse" title="Cambios sin guardar" />
            : <div className="w-6 h-6" />
          }
        </div>
      </header>

      {/* ── Info de referencia (solo lectura) ── */}
      <div className="app-shell-form w-full px-4 pt-5 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between p-4
                        bg-white/5 border border-white/5 rounded-2xl mb-6">
          <div className="min-w-0">
            <p className="text-[8px] font-black uppercase tracking-widest text-crema/30 mb-1">
              ID · {business.id.slice(0, 8)}…
            </p>
            <p className="text-xs font-bold text-white truncate">{business.name}</p>
            <p className="text-[9px] text-crema/30 uppercase font-bold tracking-tighter mt-0.5">
              {business.categories?.icon} {business.categories?.slug} · {business.city?.toUpperCase()}
            </p>
          </div>
          <StatusBadge status={business.status as any} />
        </div>
      </div>

      {/* ── Formulario ── */}
      <main className="app-shell-form w-full px-4 space-y-6 sm:px-5 lg:px-6">

        {/* Información básica */}
        <SectionHeader icon={<Info size={14} />} title="Información básica" />
        <FormInput
          label="Nombre"
          name="name"
          value={form.name}
          onChange={handleChange}
          required
        />
        <FormTextArea
          label="Descripción"
          name="description"
          value={form.description}
          onChange={handleChange}
        />
        <FormInput
          label="ID de Categoría"
          name="category_id"
          value={form.category_id}
          onChange={handleChange}
          type="number"
          required
        />

        {/* Ubicación */}
        <SectionHeader icon={<MapPin size={14} />} title="Ubicación" />
        <FormInput
          label="Dirección"
          name="address"
          value={form.address}
          onChange={handleChange}
          required
        />

        <div className="flex flex-col mb-2">
          <label className="text-[8px] font-black uppercase tracking-tighter text-crema/30 mb-1">
            Ciudad
          </label>
          <select
            name="city"
            value={form.city}
            onChange={handleChange}
            className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10
                       text-crema focus:outline-none"
          >
            <option value="cdmx">CDMX</option>
            <option value="guadalajara">Guadalajara</option>
            <option value="monterrey">Monterrey</option>
          </select>
        </div>

        <div className="space-y-1">
          <p className="text-[8px] font-black uppercase tracking-widest text-crema/30 px-1">
            Coordenadas — dejar vacío para no modificar
          </p>
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Latitud"
              name="lat"
              value={form.lat}
              onChange={handleChange}
              placeholder="19.4326"
            />
            <FormInput
              label="Longitud"
              name="lng"
              value={form.lng}
              onChange={handleChange}
              placeholder="-99.1332"
            />
          </div>
        </div>

        {/* Contacto */}
        <SectionHeader icon={<Phone size={14} />} title="Contacto" />
        <FormInput
          label="Teléfono"
          name="phone"
          value={form.phone}
          onChange={handleChange}
          placeholder="+52 55 0000 0000"
        />
        <FormInput
          label="Website"
          name="website"
          value={form.website}
          onChange={handleChange}
          placeholder="https://..."
        />

        {/* Opciones */}
        <SectionHeader icon={<CreditCard size={14} />} title="Opciones" />
        <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl">
          <input
            type="checkbox"
            id="accepts_card"
            name="accepts_card"
            checked={form.accepts_card}
            onChange={handleChange}
            className="accent-[#F4A300] w-4 h-4"
          />
          <label
            htmlFor="accepts_card"
            className="text-xs font-bold uppercase text-crema/50 cursor-pointer"
          >
            Acepta pago con tarjeta
          </label>
        </div>

        {/* Acciones */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <button
            onClick={handleDiscard}
            className="flex items-center justify-center gap-2 py-4
                       border border-white/10 rounded-2xl
                       text-[10px] font-black uppercase tracking-widest text-crema/40
                       hover:bg-white/5 active:scale-95 transition-all"
          >
            <RefreshCw size={14} /> Descartar
          </button>
          <button
            disabled={saving || !dirty}
            onClick={handleSave}
            className="flex items-center justify-center gap-2 py-4
                       bg-[#2D6A4F] text-white rounded-2xl
                       font-black uppercase text-[10px] tracking-widest
                       shadow-lg shadow-[#2D6A4F]/20 active:scale-95 transition-all
                       disabled:opacity-30"
          >
            {saving
              ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              : <Save size={14} />
            }
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>

      </main>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="text-[#F4A300]">{icon}</span>
      <h2 className="text-[10px] font-black uppercase tracking-widest text-crema/40">{title}</h2>
    </div>
  );
}

function FormInput({
  label, name, value, onChange, required = false, type = 'text', placeholder,
}: {
  label:        string;
  name:         string;
  value:        string | number;
  onChange:     (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?:    boolean;
  type?:        string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col">
      <label className="text-[8px] font-black uppercase tracking-tighter text-crema/30 mb-1">
        {label}{required && ' *'}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10
                   text-crema focus:outline-none focus:border-[#F4A300]/40
                   placeholder:text-crema/20 transition-colors"
      />
    </div>
  );
}

function FormTextArea({
  label, name, value, onChange,
}: {
  label:    string;
  name:     string;
  value:    string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div className="flex flex-col">
      <label className="text-[8px] font-black uppercase tracking-tighter text-crema/30 mb-1">
        {label}
      </label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={3}
        className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10
                   text-crema focus:outline-none focus:border-[#F4A300]/40
                   resize-none transition-colors"
      />
    </div>
  );
}
