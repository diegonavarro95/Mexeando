/**
 * src/pages/tourist/ProfilePage.tsx
 * T-4 — Perfil del Turista
 * UX/UI Premium: PWA Support, Guardados, Historial, Sincronización Global
 */

import { useEffect, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Bookmark, History, LogOut, QrCode,
  BookOpen, Trophy, Clock, Trash2,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { usePassportStore } from '../../store/passportStore'
import { useMapStore, type BusinessMapResult } from '../../store/MapStore'
import { api } from '../../services/api'
import PointsCounter from '../../components/PointsCounter'
import BottomNav from '../../components/ui/BottomNav'
import BusinessCard from '../../components/map/BusinessCard'
import {
  getStoredTouristPersona,
  getTouristPersonaProgressLabel,
} from '../../lib/touristPersona'

interface UserStats {
  checkIns: number
  reviews: number
  stampsObtained: number
  level: number
  levelName: string
  nextLevelPoints: number
  currentLevelPoints: number
}

interface StatsResponse {
  data?: {
    stats?: UserStats | null
  } | null
}

interface FavoriteItemResponse {
  id: string
  name: string
  slug?: string | null
  category_slug?: string | null
  category_icon?: string | null
  avg_rating?: number | null
  review_count?: number | null
  checkin_count?: number | null
  accepts_card?: boolean | null
  ola_verified?: boolean | null
  distance_m?: number | null
  indice_ola?: number | null
  is_open_now?: boolean | null
  primary_image?: string | null
  lat?: number | string | null
  lng?: number | string | null
}

interface FavoritesResponse {
  data?: {
    favorites?: FavoriteItemResponse[]
  } | null
}

interface CheckinHistoryItem {
  id: string
  business_id: string
  business_name: string
  business_category_icon: string
  checkin_date: string
  points_earned: number
}

interface CheckinHistoryResponse {
  data?: {
    history?: CheckinHistoryItem[]
  } | null
}

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusMeters = 6371e3
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusMeters * c
}

function normalizeFavorite(
  favorite: FavoriteItemResponse,
  globalBusinesses: BusinessMapResult[],
  userLat: number | null,
  userLng: number | null
): BusinessMapResult {
  const globalBiz = globalBusinesses.find((business) => business.id === favorite.id)

  if (globalBiz) {
    return globalBiz
  }

  const lat = Number(favorite.lat)
  const lng = Number(favorite.lng)
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng)

  return {
    id: favorite.id,
    name: favorite.name,
    slug: favorite.slug ?? '',
    category_slug: favorite.category_slug ?? 'general',
    category_icon: favorite.category_icon ?? '📍',
    lat: hasCoords ? lat : 0,
    lng: hasCoords ? lng : 0,
    primary_image: favorite.primary_image ?? null,
    avg_rating: favorite.avg_rating ?? 0,
    review_count: favorite.review_count ?? 0,
    checkin_count: favorite.checkin_count ?? 0,
    accepts_card: Boolean(favorite.accepts_card),
    ola_verified: Boolean(favorite.ola_verified),
    distance_m:
      favorite.distance_m ??
      (userLat !== null && userLng !== null && hasCoords
        ? getDistanceInMeters(userLat, userLng, lat, lng)
        : 0),
    indice_ola: favorite.indice_ola ?? 0,
    is_open_now: favorite.is_open_now ?? true,
  }
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { displayName, clearAuth } = useAuthStore()
  const { pointBalance, resetPassport } = usePassportStore()
  const { userLat, userLng, businesses: globalBusinesses } = useMapStore()

  const [savedPlaces, setSavedPlaces] = useState<BusinessMapResult[]>([])
  const [checkinHistory, setCheckinHistory] = useState<CheckinHistoryItem[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)

  const [loadingSaved, setLoadingSaved] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingStats, setLoadingStats] = useState(true)

  const [activeTab, setActiveTab] = useState<'saved' | 'history'>('saved')

  useEffect(() => {
    loadSavedPlaces()
    loadStats()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadSavedPlaces() {
    setLoadingSaved(true)
    try {
      const res = await api.get<FavoritesResponse>('/api/v1/favorites')
      const rawFavorites = res.data.data?.favorites ?? []
      const nextSavedPlaces = rawFavorites.map((favorite) =>
        normalizeFavorite(favorite, globalBusinesses, userLat, userLng)
      )

      setSavedPlaces(nextSavedPlaces)
    } catch (err) {
      console.error('Error cargando guardados:', err)
      setSavedPlaces([])
    } finally {
      setLoadingSaved(false)
    }
  }

  async function loadCheckinHistory() {
    setLoadingHistory(true)
    try {
      const res = await api.get<CheckinHistoryResponse>('/api/v1/checkins/history')
      setCheckinHistory(res.data.data?.history ?? [])
    } catch (err) {
      console.error('Error cargando historial de checkins:', err)
      setCheckinHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'history' && checkinHistory.length === 0) {
      loadCheckinHistory()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  async function loadStats() {
    setLoadingStats(true)
    try {
      const res = await api.get<StatsResponse>('/api/v1/users/me/stats')
      setStats(res.data.data?.stats ?? null)
    } catch (err) {
      console.error('Stats error:', err)
      setStats(null)
    } finally {
      setLoadingStats(false)
    }
  }

  function handleLogout() {
    resetPassport()
    clearAuth()
    navigate('/login')
  }

  async function handleRemoveSaved(event: MouseEvent, id: string) {
    event.stopPropagation()
    try {
      setSavedPlaces((prev) => prev.filter((business) => business.id !== id))
      await api.delete(`/api/v1/favorites/${id}`)
    } catch (err) {
      console.error('Error al quitar guardado:', err)
    }
  }

  const initials = displayName
    ? displayName
        .split(' ')
        .map((word: string) => word[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?'

  const levelPct = stats
    ? Math.round(
        ((pointBalance - stats.currentLevelPoints) /
          (stats.nextLevelPoints - stats.currentLevelPoints)) * 100
      )
    : 0

  const touristPersona = getStoredTouristPersona()
  const personaProgress = getTouristPersonaProgressLabel(pointBalance, stats?.checkIns ?? 0)

  return (
    <div className="min-h-[100dvh] bg-[#110800] text-[#FFF3DC] flex flex-col overflow-x-hidden">
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
            className="p-2 -ml-2 text-[#FFF3DC]/60 active:scale-90 transition-all"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-base font-bold italic tracking-tight uppercase sm:text-lg">Mi Perfil</h1>
          <button
            onClick={handleLogout}
            className="p-2 -mr-2 text-[#FFF3DC]/40 hover:text-[#C1121F] transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="app-shell-form px-4 py-8 flex flex-col items-center sm:px-5 lg:px-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#C1121F] to-[#780a11] flex items-center justify-center text-3xl font-black text-white shadow-[0_0_20px_rgba(193,18,31,0.3)] border-2 border-white/10">
              {initials}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-[#2D6A4F] p-1.5 rounded-full border-2 border-[#110800]">
              <Trophy size={14} className="text-white" />
            </div>
          </div>

          <h2 className="mt-4 text-2xl font-black text-white tracking-tight">
            {displayName || 'Turista'}
          </h2>

          <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
            {touristPersona && (
              <span className="text-[10px] bg-[#C1121F]/20 text-[#ffd7d9] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-[#C1121F]/30">
                {touristPersona.title}
              </span>
            )}
            <span className="text-[10px] bg-[#2D6A4F]/20 text-[#bdf5d5] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-[#2D6A4F]/30">
              {personaProgress}
            </span>
            {stats && (
              <span className="text-[10px] bg-[#F4A300]/20 text-[#ffd98e] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-[#F4A300]/30">
                Nv. {stats.level} · {stats.levelName}
              </span>
            )}
          </div>

          <div className="mt-6 w-full max-w-sm">
            <PointsCounter points={pointBalance} size="lg" />
          </div>

          {stats && (
            <div className="mt-4 w-full max-w-sm">
              <div className="flex items-center justify-between text-[10px] text-[#FFF3DC]/40 mb-1.5">
                <span>Nivel {stats.level}</span>
                <span>{pointBalance} / {stats.nextLevelPoints} pts</span>
              </div>
              <div className="w-full h-1.5 bg-[#1a0d00] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#2D6A4F] rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(levelPct, 100)}%` }}
                />
              </div>
            </div>
          )}

          {touristPersona && (
            <div className="mt-5 w-full max-w-sm rounded-[1.7rem] border border-[#C1121F]/22 bg-[linear-gradient(180deg,rgba(193,18,31,0.14),rgba(26,13,0,0.94))] p-4 text-left shadow-[0_18px_34px_rgba(0,0,0,0.24)]">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ffb8bd]">
                Qué tipo de mexicano eres
              </p>
              <h3 className="mt-2 text-lg font-black text-white">
                {touristPersona.title}
              </h3>
              <p className="mt-2 text-[13px] leading-6 text-[#FFF3DC]/74">
                {touristPersona.description}
              </p>
              <div className="mt-3 inline-flex rounded-full border border-[#2D6A4F]/30 bg-[#2D6A4F]/16 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#bdf5d5]">
                Etapa actual: {personaProgress}
              </div>
            </div>
          )}
        </div>

        <div className="app-shell-form mb-8 grid grid-cols-1 gap-3 px-4 sm:grid-cols-2 sm:px-5 lg:px-6">
          <button
            onClick={() => navigate('/checkin')}
            className="bg-[#1a0d00] border border-[#C1121F]/30 p-4 rounded-2xl flex flex-col gap-3 active:scale-95 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-[#C1121F]/10 flex items-center justify-center text-[#C1121F]">
              <QrCode size={24} />
            </div>
            <div className="text-left">
              <p className="text-sm font-black text-white">Check-in QR</p>
              <p className="text-[10px] text-[#FFF3DC]/40 uppercase font-bold">Escanear local</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/passport')}
            className="bg-[#1a0d00] border border-[#F4A300]/30 p-4 rounded-2xl flex flex-col gap-3 active:scale-95 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-[#F4A300]/10 flex items-center justify-center text-[#F4A300]">
              <BookOpen size={24} />
            </div>
            <div className="text-left">
              <p className="text-sm font-black text-white">Pasaporte</p>
              <p className="text-[10px] text-[#FFF3DC]/40 uppercase font-bold">Ver estampas</p>
            </div>
          </button>
        </div>

        {!loadingStats && stats && (
          <div className="app-shell-form mb-8 grid grid-cols-2 gap-3 px-4 sm:grid-cols-3 sm:px-5 lg:px-6">
            <StatCard label="Check-ins" value={stats.checkIns} emoji="📍" />
            <StatCard label="Reseñas" value={stats.reviews} emoji="⭐" />
            <StatCard label="Estampas" value={stats.stampsObtained} emoji="🎴" className="col-span-2 sm:col-span-1" />
          </div>
        )}

        <div
          className="sticky z-30 bg-[#110800] pb-2"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 61px)' }}
        >
          <div className="app-shell-form px-4 sm:px-5 lg:px-6">
            <div className="flex bg-[#1a0d00] p-1 rounded-xl border border-[#2a1800] relative">
              <motion.div
                layoutId="activeTabIndicator"
                className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#C1121F] rounded-lg shadow-lg"
                initial={false}
                animate={{ left: activeTab === 'saved' ? '4px' : 'calc(50% + 0px)' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />

              <button
                onClick={() => setActiveTab('saved')}
                className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-colors z-10 flex items-center justify-center gap-2 ${
                  activeTab === 'saved' ? 'text-white' : 'text-[#FFF3DC]/40 hover:text-white/60'
                }`}
              >
                <Bookmark size={14} /> GUARDADOS
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-colors z-10 flex items-center justify-center gap-2 ${
                  activeTab === 'history' ? 'text-white' : 'text-[#FFF3DC]/40 hover:text-white/60'
                }`}
              >
                <History size={14} /> HISTORIAL
              </button>
            </div>
          </div>
        </div>

        <div className="app-shell-form px-4 mt-4 sm:px-5 lg:px-6 relative min-h-[200px]">
          <AnimatePresence mode="wait">
            {activeTab === 'saved' && (
              <motion.div
                key="saved"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {loadingSaved ? (
                  [...Array(3)].map((_, index) => (
                    <div key={index} className="h-[104px] bg-[#150900] border border-[#2a1800] rounded-[1.5rem] animate-pulse" />
                  ))
                ) : savedPlaces.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-center">
                    <Bookmark size={40} strokeWidth={1} className="text-[#FFF3DC]/20 mb-3" />
                    <p className="text-sm font-bold uppercase tracking-widest text-[#FFF3DC]/30">
                      Sin lugares guardados
                    </p>
                    <button
                      onClick={() => navigate('/explore')}
                      className="mt-3 text-xs text-[#C1121F] font-black uppercase tracking-widest"
                    >
                      Explorar locales →
                    </button>
                  </div>
                ) : (
                  savedPlaces.map((business) => (
                    <div key={business.id} className="relative group">
                      <BusinessCard business={business} />
                      <button
                        onClick={(event) => handleRemoveSaved(event, business.id)}
                        className="absolute -top-2 -right-2 p-2.5 bg-[#110800] border border-white/10 rounded-full shadow-xl active:scale-90 transition-transform z-10 text-white/50 hover:text-[#C1121F]"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {loadingHistory ? (
                  [...Array(3)].map((_, index) => (
                    <div key={index} className="h-16 bg-[#150900] border border-[#2a1800] rounded-2xl animate-pulse" />
                  ))
                ) : checkinHistory.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-center">
                    <QrCode size={40} strokeWidth={1} className="text-[#FFF3DC]/20 mb-3" />
                    <p className="text-sm font-bold uppercase tracking-widest text-[#FFF3DC]/30">
                      Aún no hay visitas
                    </p>
                    <p className="text-[10px] text-[#FFF3DC]/20 mt-1 max-w-[200px]">
                      Haz check-in en los negocios para ganar puntos y estampas.
                    </p>
                  </div>
                ) : (
                  checkinHistory.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/business/${item.business_id}`)}
                      className="bg-[#150900] border border-[#2a1800] rounded-2xl p-3 flex gap-3 items-center active:scale-[0.98] transition-transform cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center text-2xl flex-shrink-0">
                        {item.business_category_icon || '📍'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-sm text-white truncate leading-tight mb-0.5">{item.business_name}</h4>
                        <div className="flex items-center gap-1 text-[10px] text-white/40 uppercase font-bold tracking-wider">
                          <Clock size={10} className="text-[#C1121F]" />
                          <span>{new Date(item.checkin_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-xs font-black text-[#52B788]">+{item.points_earned} pts</span>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <BottomNav activeTab="profile" />
    </div>
  )
}

function StatCard({
  label,
  value,
  emoji,
  className = '',
}: {
  label: string
  value: number
  emoji: string
  className?: string
}) {
  return (
    <div className={`bg-[#1a0d00] border border-[#2a1800] rounded-2xl p-4 flex flex-col items-center text-center gap-1 shadow-inner ${className}`}>
      <span className="text-xl leading-none drop-shadow-md">{emoji}</span>
      <span className="text-lg font-black text-white">{value}</span>
      <span className="text-[9px] font-bold text-[#FFF3DC]/40 uppercase tracking-tighter">{label}</span>
    </div>
  )
}
