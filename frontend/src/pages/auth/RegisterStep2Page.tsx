/**
 * src/pages/auth/RegisterStep2Page.tsx
 * D-2 — Datos finales del negocio (Paso 3 de 3)
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, MapPin, Phone, CreditCard,
  ChevronRight, Loader2, X, AlertCircle, Sparkles, Video,
} from 'lucide-react';
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from 'use-places-autocomplete';
import { useTranslation } from 'react-i18next'; // 🌍 Importación de i18n
import { api } from '../../services/api';

import { useOnboardingStore } from '../../store/onboardingStore';
import { useAuthStore }       from '../../store/authStore';
import ProgressBar            from '../../components/ui/RegisterProgressBar';

type City = 'cdmx' | 'guadalajara' | 'monterrey';

function detectCity(addressComponents: google.maps.GeocoderAddressComponent[]): City {
  const text = addressComponents.map(c => c.long_name.toLowerCase()).join(' ');
  if (text.includes('guadalajara')) return 'guadalajara';
  if (text.includes('monterrey'))   return 'monterrey';
  return 'cdmx';
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function RegisterStep2Page() {
  const navigate = useNavigate();
  const { t } = useTranslation(); // 🌍 Hook de traducción
  const { setSensitiveData, submitBusiness, isLoading: storeLoading } = useOnboardingStore();

  // ── Estado Maps ───────────────────────────────────────────────────────────
  const [mapsReady, setMapsReady] = useState(false);

  // ── use-places-autocomplete ───────────────────────────────────────────────
  const {
    ready,
    value:      addressInput,
    suggestions: { status, data },
    setValue:    setAddressInput,
    clearSuggestions,
    init,
  } = usePlacesAutocomplete({
    requestOptions: { componentRestrictions: { country: 'mx' } },
    debounce:    300,
    initOnMount: false,
  });

  // ── Carga de Google Maps API ───────────────────────────
  useEffect(() => {
    if (window.google?.maps?.places) {
      setMapsReady(true);
      init();
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    }&v=beta&libraries=places&language=es&region=MX`;
    script.async = true;
    script.onload = () => { setMapsReady(true); init(); };
    document.head.appendChild(script);
  }, [init]);

  const [showSuggestions, setShowSuggestions] = useState(false);

  // ── Formulario ────────────────────────────────────────────────────────────
  const [coords,      setCoords]      = useState<{ lat: number; lng: number } | null>(null);
  const [addressText, setAddressText] = useState('');
  const [city,        setCity]        = useState<City>('cdmx');
  const [phone,       setPhone]       = useState('');
  const [folio]       = useState<number | undefined>(() => {
    const saved = sessionStorage.getItem('ownerRegistrationFolio');
    return saved && /^\d+$/.test(saved) ? Number(saved) : undefined;
  });
  const [acceptsCard, setAcceptsCard] = useState<boolean | null>(null);
  const [images,      setImages]      = useState<File[]>([]);
  const [previews,    setPreviews]    = useState<string[]>([]);
  const [preWorldcupVideo, setPreWorldcupVideo] = useState<File | null>(null);

  // ── UI ────────────────────────────────────────────────────────────────────
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [step,     setStep]     = useState<'form' | 'uploading' | 'saving'>('form');
  const [progress, setProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // ── Selección de dirección ────────────────────────────────────────────────
  const handleSelect = async (description: string) => {
    setAddressInput(description, false);
    clearSuggestions();
    setShowSuggestions(false);
    try {
      const results      = await getGeocode({ address: description });
      const { lat, lng } = await getLatLng(results[0]);
      setCoords({ lat, lng });
      setAddressText(description);
      setCity(detectCity(results[0].address_components));
      setError(null);
    } catch (err) {
      console.error('[Step2] Error geocoding:', err);
      setError(t('auth.step2.error_geocoding', 'No pudimos obtener las coordenadas. Intenta con otra dirección.'));
    }
  };

  // ── Imágenes ──────────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (images.length + files.length > 5) { setError(t('auth.step2.error_max_photos', 'Máximo 5 fotos.')); return; }
    setImages(prev  => [...prev, ...files]);
    setPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
    setError(null);
  };

  const removeImage = (i: number) => {
    URL.revokeObjectURL(previews[i]);
    setImages(prev  => prev.filter((_, idx) => idx !== i));
    setPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('El archivo premundial debe ser un video.');
      return;
    }
    setPreWorldcupVideo(file);
    setError(null);
  };

  // ── Validación ────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!coords)              return t('auth.step2.error_address', 'Selecciona una dirección válida del autocompletado.');
    if (acceptsCard === null) return t('auth.step2.error_card', 'Indica si tu negocio acepta tarjeta.');
    if (images.length === 0)  return t('auth.step2.error_photo', 'Sube al menos una foto de tu local.');
    if (!preWorldcupVideo)    return 'Sube el video premundial de tu local antes de finalizar.';
    return null;
  };

const handleFinalize = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError(null);

    try {
      setSensitiveData({
        address:      addressText,
        city,
        lat:          coords!.lat,
        lng:          coords!.lng,
        phone:        phone.trim() || undefined,
        folio,
        accepts_card: acceptsCard!,
      });

      setProgress(30);
      const businessId = await submitBusiness();

      setStep('uploading');
      const storagePaths: string[] = [];

      for (let i = 0; i < images.length; i++) {
        const formData = new FormData();
        formData.append('file', images[i]);
        formData.append('index', String(i));

        const token = useAuthStore.getState().accessToken;

        const res = await api.post<{ data: { path: string }; error: string | null }>(
          '/api/v1/businesses/upload-image',
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (res.data.error) throw new Error(`${t('auth.step2.error_upload', 'Error subiendo imagen')} ${i + 1}: ${res.data.error}`);
        storagePaths.push(res.data.data.path);
        setProgress(30 + Math.round(((i + 1) / images.length) * 40)); 
      }

      setStep('saving');
      setProgress(85);
      
      const res = await api.post<{ data: null; error: string | null }>(
        '/api/v1/businesses/save-images',
        { business_id: businessId, storage_paths: storagePaths }
      );

      if (res.data.error) {
        throw new Error(res.data.error);
      }

      if (preWorldcupVideo) {
        const videoFormData = new FormData();
        videoFormData.append('file', preWorldcupVideo);
        videoFormData.append('video_type', 'pre_worldcup');

        const token = useAuthStore.getState().accessToken;
        const uploadVideoRes = await api.post<{ data: { path: string; video_type: string }; error: string | null }>(
          '/api/v1/businesses/upload-video',
          videoFormData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (uploadVideoRes.data.error) {
          throw new Error(uploadVideoRes.data.error);
        }

        const saveVideoRes = await api.post<{ data: null; error: string | null }>(
          '/api/v1/businesses/save-video',
          {
            business_id: businessId,
            storage_path: uploadVideoRes.data.data.path,
            video_type: 'pre_worldcup',
          }
        );

        if (saveVideoRes.data.error) {
          throw new Error(saveVideoRes.data.error);
        }
      }

      setProgress(100);
    sessionStorage.removeItem('ownerRegistrationFolio');
    useOnboardingStore.getState().resetOnboarding();
      navigate('/owner/dashboard', { replace: true });

    } catch (err: any) {
  console.error('[Step2] Error en registro final:', err);

  if (
    err.message?.includes('duplicate key') ||
    err.message?.includes('unique') ||
    err.message?.includes('Ya tienes un negocio')
  ) {
    useOnboardingStore.getState().resetOnboarding();
    sessionStorage.removeItem('ownerRegistrationFolio');
    navigate('/owner/dashboard', { replace: true });
    return;
  }

  setError(err.message ?? t('auth.step2.error_generic', 'Ocurrió un error al guardar el negocio.'));
}
  };

  const isSubmitting = loading || storeLoading;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-[#110800] flex flex-col overflow-hidden">

      {/* ── Banderita Tricolor ── */}
      <div className="h-[3px] w-full flex sticky top-0 z-[60]">
        <div className="flex-1 bg-[#006847]" />
        <div className="flex-1 bg-white"     />
        <div className="flex-1 bg-[#C1121F]" />
      </div>

      {/* ── Header ── */}
      <header className="bg-[#110800]/80 backdrop-blur-xl border-b border-white/5 sticky top-[3px] z-50 flex-shrink-0">
        <div className="app-shell-form px-4 pt-4 pb-2 sm:px-5 lg:px-6">
          <ProgressBar currentStep={3} totalSteps={3} />
        </div>
        <div className="app-shell-form flex items-center justify-between px-4 pb-4 sm:px-5 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#E85D04]/10 rounded-xl">
              <MapPin size={20} className="text-[#E85D04]" />
            </div>
            <div>
              <h1 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#E85D04]">
                {t('auth.step2.subtitle', 'Último paso')}
              </h1>
              <p className="text-sm font-black italic text-white uppercase tracking-tighter leading-none mt-0.5">
                {t('auth.step2.title', 'Datos del Local')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E85D04] animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
              {t('auth.step2.step_count', 'Paso 3 / 3')}
            </span>
          </div>
        </div>
      </header>

      {/* ── Área principal scrolleable ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="app-shell-form px-4 py-6 pb-10 flex flex-col gap-6 sm:px-5 lg:px-6">

          {/* ── Dirección ── */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">
              <MapPin size={11} className="text-[#C1121F]" />
              {t('auth.step2.location', 'Ubicación exacta')}
            </label>

            <div className="relative">
              <div
                className="flex items-center rounded-2xl px-4 py-3.5 gap-3 transition-all duration-200"
                style={{
                  background: '#1e1006',
                  border: `1px solid ${coords ? 'rgba(82,183,136,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: coords ? '0 0 0 3px rgba(82,183,136,0.1)' : 'none',
                }}
              >
                <MapPin
                  size={14}
                  className="flex-shrink-0 transition-colors"
                  style={{ color: coords ? '#52B788' : 'rgba(255,255,255,0.2)' }}
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={addressInput}
                  disabled={!ready}
                  placeholder={ready ? t('auth.step2.location_placeholder', 'Busca la dirección de tu local...') : t('auth.step2.loading_maps', 'Cargando Google Maps...')}
                  onChange={e => {
                    setAddressInput(e.target.value);
                    setCoords(null);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 300)}
                  className="flex-1 bg-transparent outline-none text-sm font-semibold placeholder:text-white/25 disabled:opacity-40"
                  style={{ color: '#FFF3DC' }}
                />
                {!mapsReady && (
                  <Loader2 size={13} className="animate-spin text-white/20 flex-shrink-0" />
                )}
                {addressInput && (
                  <button
                    type="button"
                    onClick={() => { setAddressInput(''); setCoords(null); clearSuggestions(); inputRef.current?.focus(); }}
                    className="flex-shrink-0 text-white/20 hover:text-white/60 transition-colors"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <AnimatePresence>
                {showSuggestions && status === 'OK' && (
                  <motion.ul
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1,  y: 0,  scale: 1    }}
                    exit={{    opacity: 0,  y: -6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 right-0 mt-2 rounded-2xl shadow-2xl scrollbar-hide text-left"
      style={{
    background: '#1e1006',
    border:     '1px solid rgba(255,255,255,0.08)',
    zIndex:     100,
    maxHeight:  '180px',
    overflowY:  'auto',
    scrollbarWidth: 'none',
                    }}
                  >
                    {data.map(({ place_id, description, structured_formatting }) => (
  <li
    key={place_id}
    onMouseDown={() => handleSelect(description)}
    className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-[#C1121F]/15 active:bg-[#C1121F]/25 text-left"
  >
    <MapPin size={13} className="mt-0.5 flex-shrink-0 text-[#C1121F]/60" />
    <div className="min-w-0 text-left">
      <p className="text-[13px] font-bold text-[#FFF3DC] truncate text-left">
        {structured_formatting.main_text}
      </p>
      <p className="text-[11px] text-white/35 truncate text-left">
        {structured_formatting.secondary_text}
      </p>
    </div>
  </li>
))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {coords && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1,  y: 0  }}
                  exit={{    opacity: 0          }}
                  className="flex items-center gap-2 ml-1"
                >
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#52B788]">
                    {t('auth.step2.city_detected', '✓ Ciudad detectada:')}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#FFF3DC]/50">
                    {city === 'cdmx' ? t('auth.step2.cities.cdmx', 'Ciudad de México') : city === 'guadalajara' ? t('auth.step2.cities.gdl', 'Guadalajara') : t('auth.step2.cities.mty', 'Monterrey')}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Teléfono + Tarjeta ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            {/* Teléfono */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">
                <Phone size={11} />
                {t('auth.step2.phone', 'Teléfono')}
                <span className="text-white/20 normal-case font-medium">{t('auth.step2.optional', '(opcional)')}</span>
              </label>
              <div className="relative group">
                <Phone
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#C1121F] transition-colors"
                />
                <input
                  type="tel"
                  placeholder="+52 55..."
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full rounded-2xl pl-9 pr-4 py-3.5 text-sm font-bold outline-none transition-all placeholder:text-white/20"
                  style={{
                    background: '#1e1006',
                    border:     '1px solid rgba(255,255,255,0.08)',
                    color:      '#FFF3DC',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(193,18,31,0.5)'}
                  onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
              </div>
            </div>

            {/* Acepta tarjeta */}
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">
                <CreditCard size={11} />
                {t('auth.step2.accepts_card', 'Acepta tarjeta')}
              </label>
              <div
                className="flex rounded-2xl p-1 border border-white/8"
                style={{ background: '#1e1006', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <button
                  type="button"
                  onClick={() => setAcceptsCard(true)}
                  className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${
                    acceptsCard === true ? 'bg-[#2D6A4F] text-white shadow-lg' : 'text-white/25 hover:text-white/50'
                  }`}
                >
                  {t('common.yes', 'Sí')}
                </button>
                <button
                  type="button"
                  onClick={() => setAcceptsCard(false)}
                  className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${
                    acceptsCard === false ? 'bg-[#C1121F] text-white shadow-lg' : 'text-white/25 hover:text-white/50'
                  }`}
                >
                  {t('common.no', 'No')}
                </button>
              </div>
            </div>
          </div>

          {/* ── Fotos ── */}
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">
              <Camera size={11} className="text-[#C1121F]" />
              {t('auth.step2.photos', 'Fotos del local')}
              <span className="text-white/20 normal-case font-medium">({images.length}/5)</span>
            </label>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <AnimatePresence>
                {previews.map((src, i) => (
                  <motion.div
                    key={src}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1,   opacity: 1 }}
                    exit={{    scale: 0.8, opacity: 0 }}
                    className="relative aspect-square rounded-2xl overflow-hidden"
                    style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <img src={src} className="w-full h-full object-cover" alt={`Foto ${i + 1}`} />
                    {i === 0 && (
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-[#E85D04] rounded-full">
                        <span className="text-[7px] font-black uppercase text-white">{t('auth.step2.cover', 'portada')}</span>
                      </div>
                    )}
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-black/70 rounded-full text-white hover:bg-[#C1121F] transition-colors"
                    >
                      <X size={10} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {images.length < 5 && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all"
                  style={{
                    borderColor: 'rgba(255,255,255,0.1)',
                    background:  'rgba(255,255,255,0.02)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(193,18,31,0.4)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
                >
                  <Camera size={18} className="text-[#E85D04]" />
                  <span className="text-[8px] font-black uppercase text-white/30">{t('auth.step2.upload', 'Subir')}</span>
                </motion.button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              accept="image/*"
              onChange={handleFileChange}
            />

            <p className="text-[9px] text-white/20 font-medium ml-1">
              {t('auth.step2.photo_hint', 'La primera foto será la portada de tu negocio.')}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">
              <Video size={11} className="text-[#F4A300]" />
              Video premundial
            </label>

            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="flex min-h-[5.5rem] w-full items-center justify-between rounded-2xl border border-dashed border-white/10 bg-[rgba(255,255,255,0.02)] px-4 py-4 text-left transition-all hover:border-[#F4A300]/40"
            >
              <div className="min-w-0">
                <p className="text-sm font-black text-white">
                  {preWorldcupVideo ? preWorldcupVideo.name : 'Sube un video de tu local antes del mundial'}
                </p>
                <p className="mt-1 text-[11px] text-white/35">
                  Este video se guardará como contenido premundial del negocio y será obligatorio para terminar el registro.
                </p>
              </div>
              <Video size={18} className="ml-4 flex-shrink-0 text-[#F4A300]" />
            </button>

            <input
              ref={videoInputRef}
              type="file"
              hidden
              accept="video/*"
              onChange={handleVideoChange}
            />
          </div>

          {/* ── Barra de progreso de subida ── */}
          <AnimatePresence>
            {isSubmitting && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-2 p-4 rounded-2xl"
                style={{ background: '#1e1006', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
                    {step === 'uploading' ? t('auth.step2.uploading', 'Subiendo fotos...') : t('auth.step2.saving', 'Guardando negocio...')}
                  </span>
                  <span className="text-[9px] font-black text-[#52B788]">{progress}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #C1121F, #E85D04)' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Error ── */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-3 p-4 rounded-2xl text-[#ff6b6b] text-xs font-bold"
                style={{ background: 'rgba(193,18,31,0.12)', border: '1px solid rgba(193,18,31,0.3)' }}
              >
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── CTA ── */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleFinalize}
              disabled={isSubmitting}
              className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: isSubmitting ? '#7a0a0f' : '#C1121F',
                color:      '#FFF3DC',
                boxShadow:  '0 8px 25px rgba(193,18,31,0.3)',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {step === 'uploading' ? t('auth.step2.uploading', 'Subiendo fotos...') : t('common.saving', 'Guardando...')}
                </>
              ) : (
                <>
                  {t('auth.step2.finalize', 'Finalizar Registro')}
                  <ChevronRight size={18} />
                </>
              )}
            </button>

            <p
              className="text-center text-[9px] leading-relaxed"
              style={{ color: 'rgba(255,243,220,0.25)', whiteSpace: 'pre-line' }}
            >
              {t('auth.step2.review_notice', 'Tu negocio quedará en revisión hasta que un administrador lo apruebe.\nTe notificaremos cuando esté activo en el mapa.')}
            </p>
          </div>

        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="py-4 border-t border-white/5 flex-shrink-0">
        <div className="flex items-center justify-center gap-2 opacity-20">
          <Sparkles size={11} className="text-[#FFF3DC]" />
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-[#FFF3DC]">
            Powered by OLA MX Intelligence
          </p>
        </div>
      </footer>

    </div>
  );
}
