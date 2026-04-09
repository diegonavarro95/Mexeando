/**
 * src/components/ReviewCard.tsx
 * Componente de reseña de usuario (Social Feed).
 * Merge: Diseño v1 + StarRating SVG, rollback funcional y sm:block de v2
 *
 * DISEÑO    → v1: motion.article, rounded-[1.8rem], galería h-32 con hover+rounded,
 *                 avatar rounded-xl, stampEarned con shadow, business tag con icono bg,
 *                 comentario entre comillas italic, Share2 en footer,
 *                 like con whileTap+drop-shadow glow
 * FUNCIONES → v2: StarRating con SVG polygon propio + prop `max`, rollback del like
 *                 con setLiked(prev=>!prev) (closure-safe), hidden sm:block en stamp name
 */

import { useState } from 'react'
import { Heart, MapPin, Clock, Share2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { motion } from 'framer-motion'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Review {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  businessId: string
  businessName: string
  businessCategory?: string
  rating: number
  comment: string
  photos?: string[]
  likes: number
  likedByMe: boolean
  createdAt: string
  stampEarned?: {
    icon: string
    name: string
  }
}

interface ReviewCardProps {
  review: Review
  onLike?: (id: string) => void
  compact?: boolean
  className?: string
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

// SVG polygon propio de v2: estrella más precisa que el icono de lucide
function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <svg
          key={i}
          width="11"
          height="11"
          viewBox="0 0 12 12"
          fill={i < Math.round(value) ? '#F4A300' : 'none'}
          stroke={i < Math.round(value) ? '#F4A300' : 'rgba(255,255,255,0.1)'}
          strokeWidth="1.5"
        >
          <polygon points="6,1 7.5,4.5 11,5 8.5,7.5 9.2,11 6,9.2 2.8,11 3.5,7.5 1,5 4.5,4.5" />
        </svg>
      ))}
    </div>
  )
}

function Avatar({ name, src, size = 36 }: { name: string; src?: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="rounded-xl object-cover border border-white/10 shadow-sm"
        style={{ width: size, height: size }}
      />
    )
  }

  const colors = [
    'bg-[#C1121F]/20 text-[#C1121F]',
    'bg-[#2D6A4F]/20 text-[#52B788]',
    'bg-[#F4A300]/20 text-[#F4A300]',
  ]
  const color = colors[name.charCodeAt(0) % colors.length]

  return (
    <div
      className={`rounded-xl flex items-center justify-center font-black border border-white/5 shadow-inner ${color}`}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function ReviewCard({
  review,
  onLike,
  compact = false,
  className = '',
}: ReviewCardProps) {
  const [liked,     setLiked]     = useState(review.likedByMe)
  const [likeCount, setLikeCount] = useState(review.likes)
  const [liking,    setLiking]    = useState(false)

  // Rollback closure-safe con setX(prev => ...) — de v2
  const handleLike = async () => {
    if (liking) return
    setLiking(true)
    setLiked((prev) => !prev)
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1))
    try {
      await onLike?.(review.id)
    } catch {
      setLiked((prev) => !prev)
      setLikeCount((prev) => (liked ? prev + 1 : prev - 1))
    } finally {
      setLiking(false)
    }
  }

  const timeAgo = formatDistanceToNow(new Date(review.createdAt), {
    addSuffix: true,
    locale: es,
  })

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white/5 border border-white/10 rounded-[1.8rem] overflow-hidden backdrop-blur-md ${className}`}
    >
      {/* ── Galería de Fotos ── */}
      {!compact && review.photos && review.photos.length > 0 && (
        <div className="flex gap-1 p-2 pb-0 h-32">
          {review.photos.slice(0, 3).map((photo, i) => (
            <div
              key={i}
              className="flex-1 overflow-hidden first:rounded-l-2xl last:rounded-r-2xl border border-white/5"
            >
              <img
                src={photo}
                alt=""
                className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
              />
            </div>
          ))}
        </div>
      )}

      <div className="p-5">
        {/* ── Header: Usuario ── */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-3">
            <Avatar name={review.userName} src={review.userAvatar} size={compact ? 32 : 42} />
            <div>
              <p className="text-white font-bold text-sm tracking-tight">{review.userName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <StarRating value={review.rating} />
                <span className="text-white/20 text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                  <Clock size={10} />
                  {timeAgo}
                </span>
              </div>
            </div>
          </div>

          {/* Badge de Estampa — nombre oculto en móvil (de v2) */}
          {review.stampEarned && (
            <div className="flex items-center gap-1.5 bg-[#F4A300]/10 border border-[#F4A300]/20 rounded-full pl-1.5 pr-2.5 py-1 shadow-lg shadow-[#F4A300]/5">
              <span className="text-xs">{review.stampEarned.icon}</span>
              <span className="text-[8px] font-black uppercase tracking-tighter text-[#F4A300] hidden sm:block">
                {review.stampEarned.name}
              </span>
            </div>
          )}
        </div>

        {/* ── Business Tag ── */}
        <div className="flex items-center gap-1.5 mb-3">
          <div className="p-1 bg-[#C1121F]/10 rounded-md">
            <MapPin size={10} className="text-[#C1121F]" />
          </div>
          <span className="text-[10px] text-[#C1121F] font-black italic uppercase tracking-tighter">
            {review.businessName}
          </span>
          {review.businessCategory && (
            <span className="text-[10px] text-white/20 font-medium">· {review.businessCategory}</span>
          )}
        </div>

        {/* ── Comentario ── */}
        <p className={`text-white/70 text-sm leading-relaxed italic ${compact ? 'line-clamp-2' : ''}`}>
          "{review.comment}"
        </p>

        {/* ── Footer: Acciones ── */}
        <div className="flex items-center justify-between mt-5 pt-3 border-t border-white/5">
          <button
            onClick={handleLike}
            className={`group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${
              liked ? 'text-[#C1121F]' : 'text-white/30 hover:text-white'
            }`}
          >
            <motion.div whileTap={{ scale: 1.4 }}>
              <Heart
                size={16}
                fill={liked ? '#C1121F' : 'transparent'}
                className={liked ? 'drop-shadow-[0_0_8px_#C1121F]' : ''}
              />
            </motion.div>
            {likeCount > 0 && <span className="tabular-nums">{likeCount}</span>}
          </button>

          <button className="text-white/20 hover:text-[#F4A300] transition-colors">
            <Share2 size={14} />
          </button>
        </div>
      </div>
    </motion.article>
  )
}