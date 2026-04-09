/**
 * src/pages/admin/AdminCreateBusinessPage.tsx
 * A-3 — Crear negocio (admin)
 * Ruta: /admin/businesses/new
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Info, MapPin, Phone, Search, X, Check, Clock } from 'lucide-react';

import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import garnachin from '../../assets/garnachin.png';

// ─── Tipos ────────────────────────────────────────────────────────────────────

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayKey  = typeof DAY_KEYS[number];
type Schedule = Partial<Record<DayKey, [string, string] | null>>;

const DAY_LABELS: Record<DayKey, string> = {
  mon: 'Lun', tue: 'Mar', wed: 'Mié',
  thu: 'Jue', fri: 'Vie', sat: 'Sáb', sun: 'Dom',
};

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
  owner_id:     string;
}

interface OwnerOption {
  id:           string;
  display_name: string;
  avatar_url:   string | null;
}

interface CategoryOption {
  id:   number;
  slug: string;
  icon: string;
}

const CATEGORY_FALLBACK: CategoryOption[] = [
  { id: 1, slug: 'food',          icon: '🌮' },
  { id: 2, slug: 'crafts',        icon: '🎨' },
  { id: 3, slug: 'tourism',       icon: '🧳' },
  { id: 4, slug: 'entertainment', icon: '🎵' },
  { id: 5, slug: 'wellness',      icon: '💆' },
  { id: 6, slug: 'retail',        icon: '🛍️' },
];

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminCreateBusinessPage() {
  const navigate                  = useNavigate();
  const { accessToken, userRole } = useAuthStore();

  const [form, setForm] = useState<FormData>({
    name:         '',
    description:  '',
    category_id:  1,
    address:      '',
    city:         'cdmx',
    lat:          '',
    lng:          '',
    phone:        '',
    website:      '',
    accepts_card: false,
    owner_id:     '',
  });

  // Horario — empieza vacío (todos cerrados)
  const [schedule, setSchedule] = useState<Schedule>({});

  // Categorías
  const [categories, setCategories] = useState<CategoryOption[]>(CATEGORY_FALLBACK);

  // Buscador de owners
  const [ownerQuery, setOwnerQuery]       = useState('');
  const [ownerResults, setOwnerResults]   = useState<OwnerOption[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<OwnerOption | null>(null);
  const [ownerLoading, setOwnerLoading]   = useState(false);
  const [showDropdown, setShowDropdown]   = useState(false);
  const ownerDebounceRef                  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef                       = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [toast, setToast]     = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Guard
  if (!accessToken || userRole !== 'admin') {
    navigate('/login', { replace: true });
    return null;
  }

  useEffect(() => {
    api.get<{ data: CategoryOption[] }>('/api/v1/categories')
      .then((res) => {
        const cats = res.data?.data;
        if (Array.isArray(cats) && cats.length > 0) setCategories(cats);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Horario ────────────────────────────────────────────────────────────────

  function toggleDay(key: DayKey) {
    setSchedule((prev) =>
      prev[key] !== undefined && prev[key] !== null
        ? { ...prev, [key]: null }          // abierto → cerrado
        : { ...prev, [key]: ['09:00', '21:00'] }  // cerrado/sin definir → abierto con defaults
    );
  }

  function updateHour(key: DayKey, idx: 0 | 1, val: string) {
    setSchedule((prev) => {
      const curr = prev[key] ?? ['09:00', '21:00'];
      const next: [string, string] = [curr[0], curr[1]];
      next[idx] = val;
      return { ...prev, [key]: next };
    });
  }

  // ── Buscador de owners ─────────────────────────────────────────────────────

  function handleOwnerQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setOwnerQuery(q);
    setSelectedOwner(null);
    setForm((prev) => ({ ...prev, owner_id: '' }));

    if (ownerDebounceRef.current) clearTimeout(ownerDebounceRef.current);

    if (q.trim().length < 1) {
      setOwnerResults([]);
      setShowDropdown(false);
      return;
    }

    ownerDebounceRef.current = setTimeout(async () => {
      setOwnerLoading(true);
      try {
        const res = await api.get<{ data: { owners: OwnerOption[] } }>(
          `/api/v1/admin/owners?q=${encodeURIComponent(q.trim())}`
        );
        const owners = res.data?.data?.owners ?? [];
        setOwnerResults(owners);
        setShowDropdown(true);
      } catch {
        setOwnerResults([]);
      } finally {
        setOwnerLoading(false);
      }
    }, 350);
  }

  function handleSelectOwner(owner: OwnerOption) {
    setSelectedOwner(owner);
    setOwnerQuery(owner.display_name);
    setForm((prev) => ({ ...prev, owner_id: owner.id }));
    setShowDropdown(false);
    setOwnerResults([]);
  }

  function handleClearOwner() {
    setSelectedOwner(null);
    setOwnerQuery('');
    setForm((prev) => ({ ...prev, owner_id: '' }));
    setOwnerResults([]);
    setShowDropdown(false);
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox'
        ? target.checked
        : name === 'category_id'
            ? Number(value)
            : value,
    }));
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleSubmit() {
    if (!form.name || !form.address || !form.lat || !form.lng) {
      showToast('Nombre, dirección y coordenadas son obligatorios.', 'error');
      return;
    }
    if (!form.owner_id) {
      showToast('Selecciona un propietario de la lista.', 'error');
      return;
    }
    const lat = parseFloat(form.lat);
    const lng = parseFloat(form.lng);
    if (isNaN(lat) || isNaN(lng)) {
      showToast('Latitud y Longitud deben ser números válidos.', 'error');
      return;
    }

    if (form.website && !form.website.startsWith('http')) {
       showToast('El website debe incluir http:// o https://', 'error');
       return;
    }

    // Filtrar días sin definir del schedule (solo enviar los que tienen valor)
    const schedulePayload: Schedule = {};
    for (const key of DAY_KEYS) {
      if (key in schedule) schedulePayload[key] = schedule[key];
    }

    setLoading(true);
    try {
      await api.post('/api/v1/admin/businesses', {
        name:         form.name,
        description:  form.description  || undefined,
        category_id:  form.category_id,
        address:      form.address,
        city:         form.city,
        lat,
        lng,
        phone:        form.phone        || undefined,
        website:      form.website      || undefined,
        accepts_card: form.accepts_card,
        owner_id:     form.owner_id,
        schedule:     Object.keys(schedulePayload).length > 0 ? schedulePayload : undefined,
      });

      showToast('Negocio creado con éxito', 'success');
      setTimeout(() => navigate('/admin'), 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? 'Error al crear negocio.';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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
                        px-6 py-3 rounded-2xl shadow-2xl font-black uppercase
                        text-[10px] tracking-widest border border-white/10
                        ${toast.type === 'success' ? 'bg-[#2D6A4F] text-white' : 'bg-[#C1121F] text-white'}`}
          >
            {toast.type === 'success' ? '✅ ' : '❌ '}{toast.msg}
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
              Crear Nuevo Negocio
            </h1>
          </div>
          <div className="w-6 h-6" />
        </div>
      </header>

      <main className="app-shell-form w-full px-4 pt-6 space-y-5 sm:px-5 lg:px-6">

        {/* ══ PROPIETARIO ══ */}
        <SectionHeader icon={<Search size={14} />} title="Propietario" />

        <div className="relative" ref={dropdownRef}>
          <label className="text-[8px] font-black uppercase tracking-tighter text-crema/30 block mb-1">
            Buscar por nombre *
          </label>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border transition-colors
                          ${selectedOwner ? 'border-[#2D6A4F]' : 'border-white/10 focus-within:border-[#F4A300]/40'}`}>
            {ownerLoading
              ? <div className="w-3.5 h-3.5 border-2 border-crema/20 border-t-crema/60 rounded-full animate-spin flex-shrink-0" />
              : selectedOwner
                ? <Check size={14} className="text-[#2D6A4F] flex-shrink-0" />
                : <Search size={14} className="text-crema/30 flex-shrink-0" />
            }
            <input
              type="text"
              value={ownerQuery}
              onChange={handleOwnerQueryChange}
              onFocus={() => ownerResults.length > 0 && setShowDropdown(true)}
              placeholder="Escribe el nombre del propietario..."
              readOnly={!!selectedOwner}
              className="flex-1 bg-transparent text-crema text-sm focus:outline-none placeholder:text-crema/20"
            />
            {(ownerQuery || selectedOwner) && (
              <button onClick={handleClearOwner} className="text-crema/30 hover:text-crema/70 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>

          <AnimatePresence>
            {showDropdown && ownerResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 right-0 mt-2 z-50 bg-[#1a0e00] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
              >
                {ownerResults.map((owner) => (
                  <button
                    key={owner.id}
                    onClick={() => handleSelectOwner(owner)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-xl bg-[#F4A300]/10 border border-[#F4A300]/20
                                    flex items-center justify-center font-black text-[#F4A300] text-sm flex-shrink-0">
                      {owner.display_name[0].toUpperCase()}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-xs font-bold text-white truncate">{owner.display_name}</p>
                      <p className="text-[9px] text-crema/30 font-mono truncate">{owner.id.slice(0, 16)}…</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
            {showDropdown && ownerResults.length === 0 && !ownerLoading && ownerQuery.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute left-0 right-0 mt-2 z-50 bg-[#1a0e00] border border-white/10 rounded-2xl px-4 py-5 text-center"
              >
                <p className="text-[10px] font-bold text-crema/30 uppercase tracking-widest">
                  Sin resultados para "{ownerQuery}"
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {selectedOwner && (
            <div className="mt-2 flex items-center gap-2 px-3 py-1.5 bg-[#2D6A4F]/10 border border-[#2D6A4F]/30 rounded-xl w-fit">
              <Check size={11} className="text-[#2D6A4F]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[#2D6A4F]">
                {selectedOwner.display_name}
              </span>
            </div>
          )}
        </div>

        {/* ══ INFORMACIÓN BÁSICA ══ */}
        <SectionHeader icon={<Info size={14} />} title="Información básica" />

        <FormInput
          label="Nombre del negocio" name="name" value={form.name}
          onChange={handleChange} required placeholder="Tacos El Güero"
        />
        <FormTextArea
          label="Descripción" name="description" value={form.description}
          onChange={handleChange} placeholder="Los mejores tacos de canasta desde 1987..."
        />

        <div className="flex flex-col">
          <label className="text-[8px] font-black uppercase tracking-tighter text-crema/30 mb-1">
            Categoría *
          </label>
          <select
            name="category_id" value={form.category_id} onChange={handleChange}
            className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10
                       text-crema focus:outline-none focus:border-[#F4A300]/40 transition-colors"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon}  {cat.slug.charAt(0).toUpperCase() + cat.slug.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* ══ UBICACIÓN ══ */}
        <SectionHeader icon={<MapPin size={14} />} title="Ubicación" />

        <FormInput
          label="Dirección" name="address" value={form.address}
          onChange={handleChange} required placeholder="Av. Insurgentes Sur 1234, Col. del Valle"
        />

        <div className="flex flex-col">
          <label className="text-[8px] font-black uppercase tracking-tighter text-crema/30 mb-1">
            Ciudad *
          </label>
          <select
            name="city" value={form.city} onChange={handleChange}
            className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10
                       text-crema focus:outline-none focus:border-[#F4A300]/40 transition-colors"
          >
            <option value="cdmx">🏙️  CDMX</option>
            <option value="guadalajara">🌵  Guadalajara</option>
            <option value="monterrey">⛰️  Monterrey</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormInput label="Latitud"  name="lat" value={form.lat} onChange={handleChange} required placeholder="19.4326" />
          <FormInput label="Longitud" name="lng" value={form.lng} onChange={handleChange} required placeholder="-99.1332" />
        </div>

        {/* ══ HORARIO ══ */}
        <SectionHeader icon={<Clock size={14} />} title="Horario de operación" />

        <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden">
          {DAY_KEYS.map((key, i) => {
            const dayData = schedule[key];
            const isOpen  = dayData !== null && dayData !== undefined;

            return (
              <div
                key={key}
                className={`px-5 py-4 flex items-center gap-4
                            ${i < DAY_KEYS.length - 1 ? 'border-b border-white/5' : ''}`}
              >
                {/* Toggle del día */}
                <button
                  type="button"
                  onClick={() => toggleDay(key)}
                  className={`w-12 flex-shrink-0 flex flex-col items-center gap-1
                              py-2 rounded-xl transition-all
                              ${isOpen
                                ? 'bg-[#F4A300]/10 border border-[#F4A300]/30'
                                : 'bg-white/5 border border-white/10 opacity-40'}`}
                >
                  <span className={`text-[9px] font-black uppercase tracking-widest
                                    ${isOpen ? 'text-[#F4A300]' : 'text-crema/40'}`}>
                    {DAY_LABELS[key]}
                  </span>
                  <div className={`w-1.5 h-1.5 rounded-full transition-colors
                                   ${isOpen ? 'bg-[#F4A300]' : 'bg-crema/20'}`} />
                </button>

                {/* Inputs de hora / etiqueta cerrado */}
                {isOpen && dayData ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={dayData[0]}
                      onChange={(e) => updateHour(key, 0, e.target.value)}
                      className="flex-1 bg-[#1a0e00] border border-white/10 rounded-xl
                                 px-3 py-2 text-xs text-white focus:outline-none
                                 focus:border-[#F4A300]/40 transition-colors"
                    />
                    <span className="text-crema/20 text-xs font-bold">—</span>
                    <input
                      type="time"
                      value={dayData[1]}
                      onChange={(e) => updateHour(key, 1, e.target.value)}
                      className="flex-1 bg-[#1a0e00] border border-white/10 rounded-xl
                                 px-3 py-2 text-xs text-white focus:outline-none
                                 focus:border-[#F4A300]/40 transition-colors"
                    />
                  </div>
                ) : (
                  <span className="text-crema/20 text-[11px] italic font-bold flex-1">
                    Cerrado
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Nota de uso */}
        <p className="text-[9px] text-crema/20 font-bold px-1">
          Toca el día para activarlo o desactivarlo. Puedes dejarlo vacío si el negocio no tiene horario fijo.
        </p>

        {/* ══ CONTACTO ══ */}
        <SectionHeader icon={<Phone size={14} />} title="Contacto" />

        <FormInput label="Teléfono" name="phone" value={form.phone} onChange={handleChange} placeholder="+52 55 0000 0000" />
        <FormInput label="Website"  name="website" value={form.website} onChange={handleChange} placeholder="https://..." />

        <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl">
          <input
            type="checkbox" name="accepts_card" id="accepts_card"
            checked={form.accepts_card} onChange={handleChange}
            className="accent-[#F4A300] w-4 h-4"
          />
          <label htmlFor="accepts_card" className="text-xs font-bold uppercase text-crema/50 cursor-pointer">
            Acepta pago con tarjeta
          </label>
        </div>

        {/* Submit */}
        <button
          disabled={loading}
          onClick={handleSubmit}
          className="w-full py-4 bg-[#2D6A4F] text-white font-black uppercase tracking-widest
                     rounded-2xl shadow-lg shadow-[#2D6A4F]/20 active:scale-95
                     transition-all disabled:opacity-30 flex items-center justify-center gap-2"
        >
          {loading
            ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Creando...</>
            : 'Crear Negocio'
          }
        </button>

      </main>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[#F4A300]">{icon}</span>
      <h2 className="text-[10px] font-black uppercase tracking-widest text-crema/40">{title}</h2>
    </div>
  );
}

function FormInput({
  label, name, value, onChange, required = false, placeholder,
}: {
  label: string; name: string; value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean; placeholder?: string;
}) {
  return (
    <div className="flex flex-col">
      <label className="text-[8px] font-black uppercase tracking-tighter text-crema/30 mb-1">
        {label}{required && ' *'}
      </label>
      <input
        type="text" name={name} value={value} onChange={onChange} placeholder={placeholder}
        className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10
                   text-crema focus:outline-none focus:border-[#F4A300]/40
                   placeholder:text-crema/20 transition-colors"
      />
    </div>
  );
}

function FormTextArea({
  label, name, value, onChange, placeholder,
}: {
  label: string; name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col">
      <label className="text-[8px] font-black uppercase tracking-tighter text-crema/30 mb-1">
        {label}
      </label>
      <textarea
        name={name} value={value} onChange={onChange} rows={3} placeholder={placeholder}
        className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10
                   text-crema focus:outline-none focus:border-[#F4A300]/40
                   placeholder:text-crema/20 resize-none transition-colors"
      />
    </div>
  );
}
