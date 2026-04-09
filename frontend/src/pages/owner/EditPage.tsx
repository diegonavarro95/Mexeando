/**
 * src/pages/owner/EditPage.tsx
 * D-2 & D-3 — Gestión de Perfil y Menú (Merge: Diseño v1 + Funcionalidad v2)
 *
 * DISEÑO  → versión 1: dark theme #110800, banderita tricolor, framer-motion, tipografía OLA MX
 * FUNCIONES → versión 2: horario semanal, estados separados, addingItem, badge disponibilidad,
 *                         manejo de errores tipado, toggleDay / updateHour
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Save, Plus, Trash2,
  MapPin, CreditCard, Utensils,
  Store, Info, CheckCircle2, AlertCircle, Clock,
} from 'lucide-react';

import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';

// ─── Configuración ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 1, label: 'Comida',     icon: '🌮' },
  { id: 2, label: 'Artesanías', icon: '🎨' },
  { id: 3, label: 'Turismo',    icon: '🏛️' },
  { id: 4, label: 'Entrete.',   icon: '🎭' },
  { id: 5, label: 'Bienestar',  icon: '🧘' },
  { id: 6, label: 'Comercio',   icon: '🛍️' },
];

const CITIES = [
  { value: 'cdmx',        label: 'CDMX (Ciudad de México)' },
  { value: 'guadalajara', label: 'Guadalajara' },
  { value: 'monterrey',   label: 'Monterrey' },
];

const DAY_LABELS: Record<string, string> = {
  mon: 'Lun', tue: 'Mar', wed: 'Mié',
  thu: 'Jue', fri: 'Vie', sat: 'Sáb', sun: 'Dom',
};
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayKey = typeof DAY_KEYS[number];
type Schedule = Partial<Record<DayKey, [string, string] | null>>;

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface MenuItem {
  id?: number;
  name: string;
  price: number | null;
  icon: string;
  is_available: boolean;
}

interface BusinessData {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  phone: string;
  website: string;
  category_id: number;
  accepts_card: boolean;
  schedule: Schedule;
  menu_items: MenuItem[];
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function EditPage() {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'menu'>('profile');
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [feedback, setFeedback]   = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // ── Estado de perfil (campos individuales como en v2) ──
  const [businessId,  setBusinessId]  = useState('');
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [address,     setAddress]     = useState('');
  const [city,        setCity]        = useState('cdmx');
  const [phone,       setPhone]       = useState('');
  const [website,     setWebsite]     = useState('');
  const [categoryId,  setCategoryId]  = useState(1);
  const [acceptsCard, setAcceptsCard] = useState(false);
  const [schedule,    setSchedule]    = useState<Schedule>({});

  // ── Estado de menú ──
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [newItem, setNewItem]     = useState({ name: '', price: '', icon: '🌮' });

  // ── Guard & carga ──
  useEffect(() => {
    if (!accessToken) { navigate('/login', { replace: true }); return; }
    loadBusiness();
  }, [accessToken]);

  async function loadBusiness() {
    setLoading(true);
    try {
      const res = await api.get<{ data: BusinessData }>('/api/v1/businesses/owner/mine');
      const b = res.data.data;
      setBusinessId(b.id);
      setName(b.name ?? '');
      setDescription(b.description ?? '');
      setAddress(b.address ?? '');
      setCity(b.city ?? 'cdmx');
      setPhone(b.phone ?? '');
      setWebsite(b.website ?? '');
      setCategoryId(b.category_id ?? 1);
      setAcceptsCard(b.accepts_card ?? false);
      setSchedule(b.schedule ?? {});
      setMenuItems(b.menu_items ?? []);
    } catch {
      showFeedback('No se pudo cargar el negocio.', 'error');
    } finally {
      setLoading(false);
    }
  }

  const showFeedback = (msg: string, type: 'success' | 'error') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  // ── Horario (lógica de v2) ──
  function toggleDay(key: DayKey) {
    setSchedule((prev) =>
      prev[key] ? { ...prev, [key]: null } : { ...prev, [key]: ['09:00', '21:00'] }
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

  // ── Guardar perfil (manejo de error tipado de v2) ──
  async function handleSaveProfile() {
    if (!businessId) return;
    setSaving(true);
    try {
      await api.patch(`/api/v1/businesses/${businessId}`, {
        name, description, address, city,
        phone: phone || undefined,
        website: website || undefined,
        category_id: categoryId,
        accepts_card: acceptsCard,
        schedule,
      });
      showFeedback('Cambios sincronizados correctamente', 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showFeedback(msg ?? 'Error al actualizar el perfil.', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Agregar ítem al menú ──
  async function handleAddMenuItem() {
    if (!newItem.name.trim() || !businessId) return;
    setAddingItem(true);
    try {
      const res = await api.post<{ data: MenuItem }>(`/api/v1/businesses/${businessId}/menu`, {
        name: newItem.name,
        price: newItem.price ? parseFloat(newItem.price) : undefined,
        icon: newItem.icon,
      });
      setMenuItems((prev) => [...prev, res.data.data]);
      setNewItem({ name: '', price: '', icon: '🌮' });
      showFeedback('Platillo añadido al menú', 'success');
    } catch {
      showFeedback('No se pudo agregar el ítem.', 'error');
    } finally {
      setAddingItem(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-[100dvh] bg-[#110800] text-[#FFF3DC] flex flex-col pb-32">

      {/* ── Banderita Tricolor ── */}
      <div className="h-[3px] w-full flex sticky top-0 z-[60]">
        <div className="flex-1 bg-[#006847]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#C1121F]" />
      </div>

      {/* ── Header ── */}
      <header className="bg-[#110800]/80 backdrop-blur-xl border-b border-white/5 p-4 sticky top-[3px] z-50">
        <div className="app-shell-form flex items-center justify-between">
          <button
            onClick={() => navigate('/owner/dashboard')}
            className="p-2 -ml-2 text-white/20 hover:text-white transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col items-center">
            <h1 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#C1121F]">Edición</h1>
            <p className="text-sm font-black italic text-white uppercase tracking-tighter">Estudio de Negocio</p>
          </div>
          <div className="w-10" />
        </div>
      </header>

      {/* ── Tabs ── */}
      <nav className="app-shell-form flex bg-white/5 border-b border-white/5">
        <TabButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} label="Información" icon={<Store size={16} />} />
        <TabButton active={activeTab === 'menu'}    onClick={() => setActiveTab('menu')}    label="Menú Digital" icon={<Utensils size={16} />} />
      </nav>

      {/* ── Toast de Feedback ── */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className={`mx-4 mt-4 p-4 rounded-2xl flex items-center gap-3 border shadow-2xl z-40 app-shell-form w-auto ${
              feedback.type === 'success'
                ? 'bg-[#2D6A4F]/20 border-[#2D6A4F]/40 text-[#52B788]'
                : 'bg-[#C1121F]/20 border-[#C1121F]/40 text-[#ff6b6b]'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span className="text-[11px] font-black uppercase tracking-widest">{feedback.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="app-shell-form flex-1 w-full p-4 sm:p-5 lg:p-6">

        {/* ════════════════ TAB: PERFIL ════════════════ */}
        {activeTab === 'profile' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Identidad */}
            <section className="space-y-4">
              <FormLabel icon={<Info size={14} />} title="Identidad del Local" />
              <div className="space-y-5 bg-white/5 p-6 rounded-[2rem] border border-white/5 shadow-inner">
                <InputGroup
                  label="Nombre Comercial"
                  value={name}
                  onChange={setName}
                  placeholder="Ej. El Templo de la Birria"
                />
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase text-white/20 tracking-[0.2em] ml-1">Historia / Descripción</p>
                  <textarea
                    className="w-full bg-[#110800] border border-white/10 rounded-2xl p-4 text-sm focus:border-[#C1121F]/50 outline-none min-h-[110px] resize-none transition-all placeholder:text-white/10 text-white"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Escribe algo que atraiga a los turistas..."
                  />
                </div>
              </div>
            </section>

            {/* Categoría */}
            <section className="space-y-4">
              <FormLabel icon={<Utensils size={14} />} title="Categorización" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all ${
                      categoryId === cat.id
                        ? 'bg-[#C1121F]/10 border-[#C1121F] text-white shadow-lg shadow-[#C1121F]/10'
                        : 'bg-white/5 border-transparent text-white/20 grayscale'
                    }`}
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="text-center text-[9px] font-black uppercase tracking-tighter leading-4">{cat.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Ubicación */}
            <section className="space-y-4">
              <FormLabel icon={<MapPin size={14} />} title="Ubicación y Enlaces" />
              <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 space-y-5">
                <div className="space-y-2">
                  <p className="text-[9px] font-black uppercase text-white/20 tracking-[0.2em] ml-1">Sede Oficial</p>
                  <select
                    className="w-full bg-[#110800] border border-white/10 rounded-2xl p-4 text-sm outline-none focus:border-[#C1121F]/50 appearance-none text-white"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  >
                    {CITIES.map((c) => (
                      <option key={c.value} value={c.value} className="bg-[#110800]">{c.label}</option>
                    ))}
                  </select>
                </div>
                <InputGroup label="Dirección Completa"        value={address} onChange={setAddress} placeholder="Calle, Número, Colonia..." />
                <InputGroup label="Teléfono / WhatsApp"       value={phone}   onChange={setPhone}   placeholder="+52 55 1234 5678" type="tel" />
                <InputGroup label="Sitio Web / Menú PDF"      value={website} onChange={setWebsite} placeholder="https://..." type="url" />
              </div>
            </section>

            {/* Pagos */}
            <section className="space-y-4">
              <FormLabel icon={<CreditCard size={14} />} title="Operaciones" />
              <button
                onClick={() => setAcceptsCard(!acceptsCard)}
                className={`w-full flex items-center justify-between p-5 rounded-3xl border-2 transition-all ${
                  acceptsCard
                    ? 'bg-[#2D6A4F]/10 border-[#2D6A4F] text-[#52B788]'
                    : 'bg-white/5 border-white/5 text-white/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard size={20} />
                  <span className="text-xs font-black uppercase tracking-widest">Aceptamos Tarjeta</span>
                </div>
                <div className={`w-10 h-6 rounded-full relative transition-colors ${acceptsCard ? 'bg-[#2D6A4F]' : 'bg-white/10'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${acceptsCard ? 'left-5' : 'left-1'}`} />
                </div>
              </button>
            </section>

            {/* ── Horario Semanal (de v2) ── */}
            <section className="space-y-4">
              <FormLabel icon={<Clock size={14} />} title="Horario Semanal" />
              <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 space-y-3">
                {DAY_KEYS.map((key) => {
                  const dayData = schedule[key];
                  const isOpen  = dayData !== null && dayData !== undefined;
                  return (
                    <div
                      key={key}
                      className="flex flex-col gap-3 bg-[#110800] rounded-2xl px-4 py-3 border border-white/5 sm:flex-row sm:items-center"
                    >
                      <div className="flex items-center gap-3">
                      {/* Toggle */}
                      <button
                        onClick={() => toggleDay(key)}
                        className={`w-9 h-5 rounded-full relative flex-shrink-0 transition-colors ${isOpen ? 'bg-[#C1121F]' : 'bg-white/10'}`}
                      >
                        <div
                          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${isOpen ? 'left-[18px]' : 'left-0.5'}`}
                        />
                      </button>

                      {/* Día */}
                      <span className={`text-[11px] font-black uppercase w-7 tracking-wider ${isOpen ? 'text-white' : 'text-white/20'}`}>
                        {DAY_LABELS[key]}
                      </span>
                      </div>

                      {/* Horas */}
                      {isOpen && Array.isArray(dayData) ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="time"
                            value={dayData[0]}
                            onChange={(e) => updateHour(key, 0, e.target.value)}
                            className="flex-1 bg-[#1a1000] border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white outline-none focus:border-[#C1121F]/50"
                          />
                          <span className="text-white/20 text-xs">—</span>
                          <input
                            type="time"
                            value={dayData[1]}
                            onChange={(e) => updateHour(key, 1, e.target.value)}
                            className="flex-1 bg-[#1a1000] border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white outline-none focus:border-[#C1121F]/50"
                          />
                        </div>
                      ) : (
                        <span className="text-white/20 text-[11px] italic sm:ml-auto">Cerrado</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Guardar */}
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full bg-[#C1121F] text-white py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.3em] shadow-xl shadow-[#C1121F]/20 active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-60"
            >
              {saving
                ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                : <><Save size={16} /> Guardar Perfil</>
              }
            </button>
          </div>
        )}

        {/* ════════════════ TAB: MENÚ ════════════════ */}
        {activeTab === 'menu' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Formulario nuevo ítem */}
            <section className="bg-white/5 border border-white/5 p-5 sm:p-7 rounded-[2.5rem] space-y-5">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-[#F4A300] flex items-center gap-2">
                <Plus size={16} /> Nuevo Ítem
              </h3>

              {/* Emoji + Nombre */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <input
                  className="bg-[#110800] border border-white/10 rounded-2xl text-center text-2xl p-3 outline-none focus:border-[#C1121F] sm:col-span-1"
                  value={newItem.icon}
                  onChange={(e) => setNewItem({ ...newItem, icon: e.target.value })}
                  maxLength={2}
                  title="Emoji del ítem"
                />
                <input
                  className="bg-[#110800] border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#C1121F] placeholder:text-white/10 text-white sm:col-span-3 sm:py-0"
                  placeholder="Nombre del platillo..."
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                />
              </div>

              {/* Precio + Botón agregar */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  className="flex-1 bg-[#110800] border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#C1121F] placeholder:text-white/10 text-white"
                  placeholder="Precio MXN (opcional)"
                  type="number"
                  value={newItem.price}
                  onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                />
                <button
                  onClick={handleAddMenuItem}
                  disabled={addingItem || !newItem.name.trim()}
                  className="bg-[#C1121F] text-white px-8 h-14 sm:h-auto rounded-2xl active:scale-95 transition-all shadow-lg shadow-[#C1121F]/20 disabled:opacity-40"
                >
                  {addingItem
                    ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    : <Plus size={22} />
                  }
                </button>
              </div>
            </section>

            {/* Lista de ítems */}
            <section className="space-y-4">
              <FormLabel icon={<Utensils size={14} />} title="Carta Actual" />
              <div className="space-y-3">
                {menuItems.length > 0 ? (
                  menuItems.map((item, i) => (
                    <motion.div
                      key={item.id ?? i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-5 bg-white/5 border border-white/5 rounded-[1.8rem] group hover:border-white/20 transition-all"
                    >
                      <div className="flex items-center gap-5 flex-1 min-w-0">
                        <span className="text-4xl drop-shadow-lg flex-shrink-0">{item.icon || '🍽️'}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-white uppercase tracking-tight truncate">{item.name}</p>
                          {item.price != null && (
                            <p className="text-xs font-black text-[#F4A300] tracking-[0.1em] mt-0.5">${item.price} MXN</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* Badge disponibilidad (de v2) */}
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            item.is_available
                              ? 'bg-[#2D6A4F]/20 text-[#52B788] border-[#2D6A4F]/40'
                              : 'bg-[#C1121F]/20 text-[#ff6b6b] border-[#C1121F]/40'
                          }`}
                        >
                          {item.is_available ? 'Disponible' : 'No disp.'}
                        </span>

                        <button className="p-3 text-white/10 hover:text-[#C1121F] transition-colors rounded-xl hover:bg-[#C1121F]/10">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="py-20 text-center space-y-3 opacity-20">
                    <Utensils size={40} className="mx-auto" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Menú vacío</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function TabButton({ active, onClick, label, icon }: {
  active: boolean; onClick: () => void; label: string; icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center py-5 gap-2 transition-all relative ${
        active ? 'text-[#C1121F]' : 'text-white/20 opacity-60'
      }`}
    >
      {icon}
      <span className="text-[9px] font-black uppercase tracking-[0.2em]">{label}</span>
      {active && (
        <motion.div
          layoutId="tabLine"
          className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#C1121F]"
        />
      )}
    </button>
  );
}

function FormLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 px-2">
      <span className="text-[#F4A300]">{icon}</span>
      <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">{title}</h2>
    </div>
  );
}

function InputGroup({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[9px] font-black uppercase text-white/20 tracking-[0.2em] ml-1">{label}</p>
      <input
        type={type}
        className="w-full bg-[#110800] border border-white/10 rounded-2xl p-4 text-sm focus:border-[#C1121F]/50 outline-none transition-all text-white placeholder:text-white/10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-[#110800] flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-white/5 border-t-[#C1121F] rounded-full animate-spin" />
      <p className="text-white/20 text-[10px] font-black uppercase tracking-[0.3em]">Cargando Estudio...</p>
    </div>
  );
}
