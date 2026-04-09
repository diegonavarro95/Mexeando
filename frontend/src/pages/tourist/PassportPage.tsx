import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Package, ArrowLeft, RefreshCw, Trophy } from 'lucide-react'
import { usePassportStore, type StampCollection } from '../../store/passportStore'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../services/api'
import StampGrid, { type Stamp } from '../../components/StampGrid'
import PointsCounter from '../../components/PointsCounter'
import BottomNav from '../../components/ui/BottomNav'
import {
  buildFallbackPassportAlbum,
  buildPassportAlbum,
  isStampImageSource,
} from '../../lib/passportCatalog'

// ─── Tipos (Doc 6) ────────────────────────────────────────────────────────────
interface OpenPackResponse {
  new_stamp_ids: number[]
  point_balance: number
  message:       string
}

// ─── Helper: aplana colecciones para StampGrid (Doc 6) ───────────────────────
function flattenStamps(album: StampCollection[]): Stamp[] {
  return (album || []).flatMap((col) =>
    (col.stamps || []).map((s) => ({
      ...s,
    }))
  )
}

const PACK_COST = 200

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PassportPage() {
  const navigate        = useNavigate()
  const { displayName } = useAuthStore()

  const {
    album, pointBalance, isLoading, isOpeningPack, newlyRevealedStampIds,
    setAlbum, setPointBalance, addStamps, setOpeningPack,
    clearNewlyRevealed, setLoading, setError,
  } = usePassportStore()

  const [showResult, setShowResult]       = useState(false)
  const [activeTab, setActiveTab]         = useState<'album' | 'progress'>('album')
  const [selectedStamp, setSelectedStamp] = useState<Stamp | null>(null)

  const canOpenPack = pointBalance >= PACK_COST

  useEffect(() => { loadData() }, [])

  async function loadData() {
  setLoading(true);
  try {
    const [albumRes, pointsRes] = await Promise.all([
      api.get('/api/v1/passport/album'),
      api.get('/api/v1/passport/points'),
    ]);

    // 🎯 AQUÍ ESTÁ EL FIX: La ruta exacta al tesoro de Diego
    const rawAlbum = albumRes.data?.data?.album || [];
    const mappedAlbum = buildPassportAlbum(rawAlbum);
    const resolvedAlbum = mappedAlbum.length > 0 ? mappedAlbum : buildFallbackPassportAlbum();
    setAlbum(resolvedAlbum);
    
    // Blindamos los puntos por si Diego también los metió en .data.data
    const balance = pointsRes.data?.data?.point_balance ?? pointsRes.data?.point_balance ?? 0;
    setPointBalance(balance);

  } catch (err) {
    console.error("Error cargando datos:", err);
    setPointBalance(0);
  } finally {
    setLoading(false);
  }
}

  async function handleOpenPack() {
    if (!canOpenPack || isOpeningPack) return
    setOpeningPack(true)
    try {
      const res = await api.post<OpenPackResponse>('/api/v1/passport/open-pack')
      addStamps(res.data.new_stamp_ids)
      setPointBalance(res.data.point_balance)
      setShowResult(true)
    } catch (err) {
      setError('No se pudo abrir el sobre.')
      console.error(err)
    } finally {
      setOpeningPack(false)
    }
  }

  // Cierra modal de resultado y limpia IDs revelados (Doc 6)
  function handleCloseResult() {
    setShowResult(false)
    clearNewlyRevealed()
  }

 // Protegemos la entrada de datos
  const flatStamps   = flattenStamps(album || [])
  const newStamps    = flatStamps.filter((s) => (newlyRevealedStampIds || []).includes(s.id))

  // Stats totales protegidas con "|| []"
  const totalObtained = (album || []).reduce((acc, col) => acc + (col.obtained_stamps || 0), 0)
  const totalStamps   = (album || []).reduce((acc, col) => acc + (col.total_stamps || 0), 0)
  const completionPct = totalStamps > 0 ? Math.round((totalObtained / totalStamps) * 100) : 0

  return (
    <div className="min-h-[100dvh] bg-[#110800] text-[#FFF3DC] flex flex-col">

      {/* ─── HEADER con tricolor Spec §01 (Doc 5) ────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#110800]/95 backdrop-blur-md border-b border-[#2a1800]">
        <div className="h-1 w-full flex">
          <div className="flex-1 bg-[#006847]" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-[#C1121F]" />
        </div>
        <div
          className="px-4 pb-3 flex items-center justify-between"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
        >
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-[#FFF3DC]/40 active:scale-90 transition-all"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="text-center">
            <h1 className="text-sm font-black uppercase tracking-tighter italic">Pasaporte del Barrio</h1>
            <p className="text-[10px] text-[#FFF3DC]/30 font-bold">{displayName || 'Coleccionista'}</p>
          </div>
          <PointsCounter points={pointBalance} size="sm" />
        </div>
      </header>

      <main className="pb-24">
        {/* Pack Banner */}
        <div className="app-shell-form px-4 py-4 sm:px-5 lg:px-6">
          <div
            className={`relative overflow-hidden rounded-2xl p-4 border transition-all duration-500 ${
              canOpenPack
                ? 'bg-[#F4A300]/10 border-[#F4A300]/50 shadow-[0_0_20px_rgba(244,163,0,0.15)]'
                : 'bg-[#1a0d00] border-[#2a1800]'
            }`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
       <div className="min-w-0 flex-1">
            <p className="text-xs text-[#FFF3DC]/50 mb-0.5">Pasaporte del Barrio</p>
            <p className="text-lg font-black text-[#FFF3DC]">Sobre sorpresa</p>
            <p className="text-sm text-[#FFF3DC]/60 mt-1">
            {canOpenPack ? (
            <span className="text-[#F4A300] font-semibold">¡Tienes suficientes puntos!</span>
            ) : (
        /* AQUÍ ES DONDE IBA LA RESTA, NO ABAJO */
        <>Necesitas <strong className="text-[#FFF3DC]">{PACK_COST - (pointBalance || 0)} pts</strong> más</>
      )}
    </p>
    <PointsCounter
      points={pointBalance} // Solo pasamos el valor de los puntos
      threshold={PACK_COST}  // El límite es 200 (PACK_COST)
      showProgress
      size="sm"
      className="mt-2"
    />
  </div>

              {/* Botón cuadrado grande (Doc 5) */}
              <button
                onClick={handleOpenPack}
                disabled={!canOpenPack || isOpeningPack}
                className={`flex h-20 w-full flex-col items-center justify-center gap-1 rounded-2xl transition-all active:scale-90 sm:w-20 ${
                  canOpenPack
                    ? 'bg-[#F4A300] text-[#110800] shadow-xl'
                    : 'bg-[#2a1800] text-[#FFF3DC]/20 opacity-50'
                }`}
              >
                {isOpeningPack
                  ? <RefreshCw className="animate-spin" />
                  : <Package size={32} strokeWidth={2.5} />
                }
                <span className="text-[10px] font-black uppercase">{PACK_COST}</span>
              </button>
            </div>
            {/* Decoración de fondo */}
            <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
              <Trophy size={120} />
            </div>
          </div>
        </div>

        {/* ─── MINI STATS (Doc 5 diseño, Doc 6 labels) ────────────────────────── */}
        <div className="app-shell-form mb-6 grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 sm:px-5 lg:px-6">
          <StatCard label="Pasaporte" value={totalObtained} emoji="✨" />
          <StatCard label="Disponibles" value={totalStamps} emoji="🎴" />
          <StatCard label="Progreso" value={`${completionPct}%`} emoji="📈" className="col-span-2 sm:col-span-1" />
        </div>

        {/* ─── TABS (Doc 5 estilo pill container) ──────────────────────────────── */}
        <div className="sticky top-[68px] z-30 bg-[#110800] pb-2 sm:top-[72px]">
          <div className="app-shell-form px-4 sm:px-5 lg:px-6">
            <div className="flex bg-[#1a0d00] p-1 rounded-xl border border-[#2a1800]">
            {(['album', 'progress'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-all ${
                  activeTab === tab ? 'bg-[#C1121F] text-white' : 'text-[#FFF3DC]/40'
                }`}
              >
                {tab === 'album' ? '📒 PASAPORTE' : '📊 LOGROS'}
              </button>
            ))}
            </div>
          </div>
        </div>

        {/* ─── CONTENIDO DINÁMICO ───────────────────────────────────────────────── */}
        <div className="app-shell-form px-4 mt-6 sm:px-5 lg:px-6">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <RefreshCw className="animate-spin text-[#C1121F]" />
            </div>
          ) : activeTab === 'album' ? (
            <div className="space-y-8">
              {album.length === 0 ? (
                // Empty state (Doc 6)
                <p className="text-center text-[#FFF3DC]/30 text-sm py-10">
                  Aún no tienes estampas. ¡Haz un check-in!
                </p>
              ) : (
                album.map((col) => (
                  <div key={col.collection_slug}>
                    <div className="flex items-end justify-between mb-4 px-1">
                      <h4 className="text-sm font-black text-white uppercase tracking-wider">
                        {col.collection_name}
                      </h4>
                      <span className="text-[10px] font-bold text-[#F4A300]">
                        {col.obtained_stamps}/{col.total_stamps}
                      </span>
                    </div>
                    <StampGrid
                      stamps={col.stamps.map((s) => ({ ...s }))}
                      cols={4}
                      showLocked
                      onStampClick={setSelectedStamp}
                    />
                  </div>
                ))
              )}
            </div>
          ) : (
            // Tab de progreso — verde en completas (Doc 5), mensaje celebratorio (Doc 6)
            <div className="space-y-4">
              {album.map((col) => (
                <div key={col.collection_slug} className="bg-[#1a0d00] border border-[#2a1800] rounded-2xl p-4">
                  <div className="flex justify-between mb-2 items-center">
                    <span className="text-xs font-black text-white uppercase">
                      {col.collection_name}
                    </span>
                    <span className="text-[10px] text-[#FFF3DC]/40">
                      {col.obtained_stamps} de {col.total_stamps}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-[#110800] rounded-full overflow-hidden border border-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${col.completion_pct}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                      className={`h-full rounded-full ${col.is_complete ? 'bg-[#2D6A4F]' : 'bg-[#C1121F]'}`}
                    />
                  </div>
                  {col.is_complete && (
                    <p className="text-[10px] text-[#F4A300] font-bold mt-1.5">
                      ¡Colección completa! 🎉
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ─── MODAL: Detalle de estampa (Doc 5 visual, Doc 6 datos extras) ──────── */}
      <AnimatePresence>
        {selectedStamp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
            onClick={() => setSelectedStamp(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-md max-h-[calc(100svh-2rem)] overflow-y-auto rounded-3xl border border-[#C1121F]/30 bg-[#1a0d00] p-6 text-center sm:max-h-[calc(100svh-3rem)] sm:p-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Ícono: URL o emoji (Doc 6) */}
              {isStampImageSource(selectedStamp.icon) ? (
                <img
                  src={selectedStamp.icon}
                  alt={selectedStamp.name}
                  // CAMBIO: h-[40vh] y w-auto para crecer al máximo sin romper el alto
                  className="h-[40vh] sm:h-[45vh] w-auto max-w-full mx-auto mb-6 rounded-2xl object-contain drop-shadow-[0_15px_35px_rgba(244,163,0,0.4)]"
                />
              ) : (
                <div className="text-7xl mb-4 drop-shadow-[0_0_15px_rgba(244,163,0,0.3)]">
                  {selectedStamp.icon}
                </div>
              )}

              <h3 className="text-2xl font-black text-white italic">{selectedStamp.name}</h3>
              <span className="inline-block text-xs font-bold text-[#F4A300] px-3 py-1 bg-[#F4A300]/10 rounded-full mt-1 mb-4">
                {selectedStamp.collection_slug}
              </span>

              {selectedStamp.description && (
                <p className="text-sm text-[#FFF3DC]/60 leading-relaxed mb-3">
                  {selectedStamp.description}
                </p>
              )}

              {/* Datos extra (Doc 6) */}
              {selectedStamp.exclusive_city && (
                <p className="text-xs text-[#C1121F] mb-1">
                  Exclusiva de {selectedStamp.exclusive_city}
                </p>
              )}
              {selectedStamp.obtained_at && (
                <p className="text-xs text-[#FFF3DC]/30 mb-4">
                  Obtenida el{' '}
                  {new Date(selectedStamp.obtained_at).toLocaleDateString('es-MX', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </p>
              )}

              <button
                onClick={() => setSelectedStamp(null)}
                className="w-full py-4 bg-[#C1121F] text-white rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all"
              >
                Cerrar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── MODAL: Resultado de abrir sobre (Doc 6) ─────────────────────────── */}
      <AnimatePresence>
        {showResult && newStamps.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 15 }}
              className="w-full max-w-md max-h-[calc(100svh-2rem)] overflow-y-auto rounded-3xl border border-[#F4A300]/40 bg-[#1a0d00] p-6 text-center sm:max-h-[calc(100svh-3rem)] sm:p-8"
            >
              <Trophy size={40} className="text-[#F4A300] mx-auto mb-3" />
              <h3 className="text-2xl font-black text-white italic mb-1">¡Sobre abierto!</h3>
              <p className="text-sm text-[#FFF3DC]/50 mb-5">Obtuviste estas estampas:</p>

              <div className="flex justify-center gap-4 mb-5 flex-wrap">
                {newStamps.map((s) => (
                  <div key={s.id} className="flex flex-col items-center gap-1">
                    {isStampImageSource(s.icon) ? (
                      <img src={s.icon} alt={s.name} className="w-12 h-12 object-contain" />
                    ) : (
                      <span className="text-4xl">{s.icon}</span>
                    )}
                    <span className="text-[10px] text-[#FFF3DC]/60">{s.name}</span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-[#FFF3DC]/40 mb-5">
                Puntos restantes:{' '}
                <strong className="text-[#F4A300]">{pointBalance}</strong>
              </p>

              <button
                onClick={handleCloseResult}
                className="w-full py-4 bg-[#C1121F] text-white rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all"
              >
                ¡Genial!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav activeTab="passport" />
    </div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, emoji, className = '' }: { label: string; value: string | number; emoji: string; className?: string }) {
  return (
    <div className={`bg-[#1a0d00] border border-[#2a1800] rounded-2xl p-3 flex flex-col items-center text-center gap-1 shadow-lg ${className}`}>
      <span className="text-lg leading-none">{emoji}</span>
      <span className="text-base font-black text-white tracking-tighter">{value}</span>
      <span className="text-[8px] font-black text-[#FFF3DC]/30 uppercase tracking-widest">{label}</span>
    </div>
  )
}
