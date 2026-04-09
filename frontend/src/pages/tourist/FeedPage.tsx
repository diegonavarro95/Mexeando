/**
 * src/pages/tourist/FeedPage.tsx
 *
 * Fixes aplicados:
 *  1. handleLike ahora es toggle (like/unlike) y actualiza el estado local
 *     de forma optimista — el corazón responde inmediatamente sin esperar la API
 *  2. Tipo Review expandido con liked_by_me, like_count y campos correctos
 *     (author / business en vez de users / businesses planos)
 *  3. Pestaña "Debug" visible solo en desarrollo (import.meta.env.DEV)
 *     que muestra las reseñas en JSON crudo para verificar que el backend
 *     está respondiendo bien antes de tener el ReviewCard final
 *  4. El filtro 'friends' ahora tiene texto explicativo cuando el feed
 *     cae en fallback (sin historial)
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Flame, Star, Clock, Heart, ChevronDown, Bug, Video } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import BottomNav from '../../components/ui/BottomNav'
import { useAuthStore } from '../../store/authStore'
import { api } from '../../services/api'

// ─── Tipos ─────────────────────────────────────────────────────────────────────
// Alineados con lo que devuelve r-feed.ts corregido

export interface Review {
  id:           string
  rating:       number
  body:         string | null
  image_path:   string | null
  language:     string
  created_at:   string
  like_count:   number
  liked_by_me:  boolean          // necesario para el estado inicial del corazón
  author: {
    id:           string | null
    display_name: string
    avatar_url:   string | null
  }
  business: {
    id:        string | null
    name:      string
    slug:      string
    city:      string
    image_url: string | null
  }
}

type FeedFilter = 'recent' | 'popular' | 'videos'

interface FeedResponse {
  reviews:     Review[]
  nextCursor?: string
  hasMore:     boolean
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={11}
          className={s <= rating ? 'text-[#F4A300] fill-[#F4A300]' : 'text-white/10'}
        />
      ))}
    </div>
  )
}

// ─── ReviewCard inline ─────────────────────────────────────────────────────────
// Usamos uno inline para no depender de que el componente externo esté actualizado

function ReviewCard({
  review,
  onLike,
}: {
  review:  Review
  onLike:  (id: string) => void
}) {
  const timeAgo = (() => {
    const diff = Date.now() - new Date(review.created_at).getTime()
    const mins  = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days  = Math.floor(diff / 86400000)
    if (days  > 0) return `hace ${days}d`
    if (hours > 0) return `hace ${hours}h`
    return `hace ${mins}m`
  })()

  return (
    <motion.div
      layout
      className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden"
    >
      {/* Imagen del negocio */}
      {review.business.image_url && (
        <div className="h-32 overflow-hidden relative">
          <img
            src={review.business.image_url}
            alt={review.business.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#110800]/80 to-transparent" />
          <div className="absolute bottom-3 left-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#F4A300]">
              {review.business.name}
            </p>
            <p className="text-[9px] text-crema/40 font-bold uppercase">
              {review.business.city}
            </p>
          </div>
        </div>
      )}

      <div className="p-5 space-y-4">

        {/* Autor + tiempo */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#C1121F]/20 flex items-center justify-center
                            font-black text-[#C1121F] uppercase text-sm flex-shrink-0">
              {review.author.display_name[0] ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">
                {review.author.display_name}
              </p>
              {!review.business.image_url && (
                <p className="text-[9px] text-crema/30 font-bold uppercase tracking-tight truncate">
                  {review.business.name}
                </p>
              )}
            </div>
          </div>
          <span className="text-[9px] text-crema/25 font-bold flex-shrink-0">{timeAgo}</span>
        </div>

        {/* Rating */}
        <StarRating rating={review.rating} />

        {/* Cuerpo */}
        {review.body && (
          <p className="text-sm text-crema/60 leading-relaxed italic">
            "{review.body}"
          </p>
        )}

        {/* Footer: like */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <button
            onClick={() => onLike(review.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all active:scale-90
                        ${review.liked_by_me
                          ? 'bg-[#C1121F]/15 text-[#C1121F]'
                          : 'bg-white/5 text-crema/30 hover:text-crema/60'}`}
          >
            <Heart
              size={15}
              className={review.liked_by_me ? 'fill-[#C1121F]' : ''}
            />
            <span className="text-[11px] font-black">{review.like_count}</span>
          </button>

          <span className="text-[9px] text-crema/20 font-bold uppercase tracking-widest">
            {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Pestaña de Debug ──────────────────────────────────────────────────────────

function DebugPanel({ reviews }: { reviews: Review[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mb-4 rounded-2xl border border-[#F4A300]/30 overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3
                   bg-[#F4A300]/10 text-[#F4A300] font-black uppercase text-[10px] tracking-widest"
      >
        <span className="flex items-center gap-2">
          <Bug size={13} /> Debug — {reviews.length} reseña{reviews.length !== 1 ? 's' : ''} recibida{reviews.length !== 1 ? 's' : ''}
        </span>
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="bg-black/40 p-4 overflow-x-auto max-h-80 overflow-y-auto">
          {reviews.length === 0 ? (
            <p className="text-[11px] text-crema/40 font-mono">
              ⚠️ El backend devolvió 0 reseñas.{'\n'}
              Verifica:{'\n'}
              • Que existan filas en la tabla `reviews` con deleted_at IS NULL{'\n'}
              • Que el endpoint `/api/v1/feed` esté registrado en tu router principal{'\n'}
              • Que el token del usuario sea válido (abre Network → /feed → status)
            </p>
          ) : (
            reviews.map((r) => (
              <details key={r.id} className="mb-3 border-b border-white/10 pb-3 last:border-0">
                <summary className="text-[10px] font-mono text-[#F4A300] cursor-pointer">
                  [{r.rating}★] {r.author.display_name} → {r.business.name}
                </summary>
                <pre className="text-[9px] text-crema/50 mt-2 whitespace-pre-wrap break-all">
                  {JSON.stringify(r, null, 2)}
                </pre>
              </details>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FeedPage() {
  const navigate    = useNavigate()
  const displayName = useAuthStore((s) => s.displayName)

  const [reviews, setReviews]         = useState<Review[]>([])
  const [loading, setLoading]         = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter, setFilter]           = useState<FeedFilter>('recent')
  const [cursor, setCursor]           = useState<string | undefined>()
  const [hasMore, setHasMore]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [showDebug, setShowDebug]     = useState(false)
  const loaderRef = useRef<HTMLDivElement | null>(null)
  // Ref para evitar llamadas duplicadas durante la carga inicial
  const fetchingRef = useRef(false)

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchFeed = useCallback(async (reset = false) => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    if (reset) {
      setLoading(true)
      setCursor(undefined)
    } else {
      setLoadingMore(true)
    }

    try {
      const params: Record<string, string> = { filter }
      if (!reset && cursor) params.cursor = cursor

      const res = await api.get<{ data: FeedResponse }>('/api/v1/feed', { params })

      const fetched  = res.data?.data?.reviews  ?? []
      const next     = res.data?.data?.nextCursor
      const more     = res.data?.data?.hasMore   ?? false

      setReviews((prev) => (reset ? fetched : [...prev, ...fetched]))
      setCursor(next)
      setHasMore(more)

    } catch (err) {
      console.error('[FeedPage] fetch error:', err)
      if (reset) setReviews([])
    } finally {
      setLoading(false)
      setLoadingMore(false)
      fetchingRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, cursor])

  // Reset al cambiar filtro
  useEffect(() => {
    fetchFeed(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  // Infinite scroll
  useEffect(() => {
    if (!loaderRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchFeed(false)
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(loaderRef.current)
    return () => observer.disconnect()
  }, [fetchFeed, hasMore, loadingMore, loading])

  // ── Like optimista ────────────────────────────────────────────────────────────
  // Actualiza el estado local ANTES de esperar la respuesta del servidor.
  // Si la API falla, revierte el cambio.
  async function handleLike(id: string) {
    // 1. Snapshot del estado previo para poder revertir
    const prev = reviews.find((r) => r.id === id)
    if (!prev) return

    const wasLiked = prev.liked_by_me

    // 2. Actualización optimista inmediata
    setReviews((all) =>
      all.map((r) =>
        r.id === id
          ? {
              ...r,
              liked_by_me: !wasLiked,
              like_count:  wasLiked ? r.like_count - 1 : r.like_count + 1,
            }
          : r
      )
    )

    try {
      // 3. Llamada a la API (toggle en el backend)
      const res = await api.post<{ data: { liked: boolean; like_count: number } }>(
        `/api/v1/reviews/${id}/like`
      )

      // 4. Sincronizar con el valor real del servidor (por si hubo race condition)
      const serverData = res.data?.data
      if (serverData) {
        setReviews((all) =>
          all.map((r) =>
            r.id === id
              ? { ...r, liked_by_me: serverData.liked, like_count: serverData.like_count }
              : r
          )
        )
      }
    } catch (err) {
      // 5. Revertir si la API falló
      console.error('[FeedPage] like error:', err)
      setReviews((all) =>
        all.map((r) =>
          r.id === id
            ? { ...r, liked_by_me: wasLiked, like_count: prev.like_count }
            : r
        )
      )
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await fetchFeed(true)
    setRefreshing(false)
  }

  const filterConfig = [
    { id: 'recent',  label: 'Recientes', icon: <Clock size={14} /> },
    { id: 'popular', label: 'Populares', icon: <Flame size={14} /> },
    { id: 'videos', label: 'Videos',    icon: <Video  size={14} /> },
  ] as const

  const isDev = import.meta.env.DEV

  return (
    <div className="min-h-[100dvh] bg-[#110800] text-[#FFF3DC] flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[#110800]/80 backdrop-blur-xl border-b border-[#FFF3DC]/5">
        <div className="h-[3px] w-full flex">
          <div className="flex-1 bg-[#006847]" />
          <div className="flex-1 bg-white" />
          <div className="flex-1 bg-[#C1121F]" />
        </div>

        <div className="px-4 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-black tracking-[0.2em] text-[#C1121F] uppercase">
                Comunidad
              </span>
              <h1 className="text-2xl font-black italic tracking-tighter text-white">
                Feed de actividad
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Botón debug solo en desarrollo */}
              {isDev && (
                <button
                  onClick={() => setShowDebug((p) => !p)}
                  title="Panel de debug"
                  className={`p-2 rounded-full transition-all active:scale-90
                              ${showDebug
                                ? 'bg-[#F4A300]/20 text-[#F4A300]'
                                : 'bg-white/5 text-crema/30'}`}
                >
                  <Bug size={18} />
                </button>
              )}

              <button
                onClick={handleRefresh}
                className={`p-2 rounded-full bg-white/5 text-[#FFF3DC]/60 active:scale-90 transition-all ${
                  refreshing ? 'animate-spin text-[#C1121F]' : ''
                }`}
              >
                <RefreshCw size={20} />
              </button>

              <button onClick={() => navigate('/profile')} className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C1121F] to-[#780a11]
                                flex items-center justify-center text-white font-black
                                border-2 border-white/10 shadow-lg active:scale-90 transition-all">
                  {displayName ? displayName[0].toUpperCase() : '?'}
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#2D6A4F] border-2 border-[#110800] rounded-full" />
              </button>
            </div>
          </div>

          {/* Chips de filtro */}
          <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] pb-1">
            {filterConfig.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black
                            transition-all duration-300 border flex-shrink-0 ${
                  filter === id
                    ? 'bg-[#C1121F] border-[#C1121F] text-white shadow-lg'
                    : 'bg-[#FFF3DC]/5 border-[#FFF3DC]/10 text-[#FFF3DC]/40 hover:bg-[#FFF3DC]/10'
                }`}
              >
                {icon} {label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Feed ── */}
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-32">

        {/* Panel de debug — solo en DEV y cuando está activado */}
        {isDev && showDebug && (
          <DebugPanel reviews={reviews} />
        )}

        <AnimatePresence mode="wait">

          {/* Skeletons */}
          {loading && (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="bg-[#FFF3DC]/[0.03] border border-[#FFF3DC]/5 rounded-3xl h-48 animate-pulse relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FFF3DC]/[0.05] to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                </div>
              ))}
            </motion.div>
          )}

          {/* Empty state */}
          {!loading && reviews.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="py-20 flex flex-col items-center text-center gap-3"
            >
              <div className="w-20 h-20 rounded-full bg-[#FFF3DC]/5 flex items-center justify-center text-4xl">
                🌮
              </div>
              <p className="font-bold text-[#FFF3DC]/60 uppercase tracking-widest text-sm">
                {filter === 'videos' ? 'Próximamente' : 'Silencio en la cocina'}
              </p>
              <p className="text-xs text-[#FFF3DC]/30 max-w-[220px] leading-relaxed">
                {filter === 'videos'
                  ? 'La sección de videos aún está en construcción. ¡Vuelve pronto!'
                  : 'Nadie ha reseñado nada por aquí aún.'}
              </p>
              {/* En dev, indicación adicional */}
              {isDev && filter !== 'videos' && (
                <p className="text-[10px] text-[#F4A300]/60 font-mono mt-2">
                  DEV: Abre el panel 🐛 para más detalles
                </p>
              )}
            </motion.div>
          )}

          {/* Lista */}
          {!loading && reviews.length > 0 && (
            <motion.div
              key="list"
              className="space-y-4"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.07 } } }}
            >
              {reviews.map((review) => (
                <motion.div
                  key={review.id}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    show:   { opacity: 1, y: 0 },
                  }}
                >
                  <ReviewCard review={review} onLike={handleLike} />
                </motion.div>
              ))}

              {/* Trigger de scroll infinito */}
              <div ref={loaderRef} className="py-8 flex flex-col items-center gap-2">
                {loadingMore ? (
                  <RefreshCw size={24} className="animate-spin text-[#C1121F] opacity-50" />
                ) : !hasMore ? (
                  <p className="text-[10px] font-black text-[#FFF3DC]/20 uppercase tracking-[0.3em]">
                    Has llegado al fin del mundo 🌮
                  </p>
                ) : null}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <BottomNav activeTab="explore" />
    </div>
  )
}