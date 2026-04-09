/**
 * src/components/map/BusinessCard.tsx
 * Spec §05 — Tarjeta de Negocio (Explorar y Favoritos)
 * Estándar OLA MX 2026 — Senior Edition.
 */
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, MapPin, Clock } from 'lucide-react';
import type { BusinessMapResult } from '../../store/MapStore';
import StarRating from '../ui/StarRating';
import OlaBadge  from '../ui/OlaBadge';

// Extendemos ligeramente la interfaz para asegurar que TypeScript acepte lat/lng si vienen
interface Props {
  business: BusinessMapResult & { lat?: number; lng?: number };
  onPress?: () => void;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export default function BusinessCard({ business, onPress }: Props) {
  const navigate = useNavigate();

  const handleClick = () => {
    onPress?.();
    // 🔥 FIX: Enviamos las coordenadas a la página de detalles
    navigate(`/business/${business.id}`, { 
      state: { targetLat: business.lat, targetLng: business.lng } 
    });
  };

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className="w-full flex items-start gap-3 px-4 py-4 sm:items-center sm:gap-4
                 bg-crema/5 border border-crema/10 rounded-[1.5rem]
                 hover:bg-crema/10 hover:border-crema/20
                 transition-all duration-200 text-left backdrop-blur-md shadow-lg"
    >
      {/* ── Ícono de Categoría ── */}
      <div className="w-14 h-14 rounded-2xl bg-bgDark border border-crema/10
                      flex items-center justify-center text-3xl flex-shrink-0 shadow-inner">
        <span className="drop-shadow-md">{business.category_icon}</span>
      </div>

      {/* ── Bloque de Info ── */}
      <div className="flex-1 min-w-0 space-y-1">

        {/* Nombre + Badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-crema font-black text-sm uppercase tracking-tight truncate">
            {business.name}
          </h3>
          {business.ola_verified && <OlaBadge />}
        </div>

        {/* Categoría + Distancia */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="max-w-full px-2 py-0.5 bg-amarillo/10 rounded-md border border-amarillo/20">
            <p className="truncate text-amarillo text-[9px] font-black uppercase tracking-widest">
              {business.category_slug}
            </p>
          </div>
          <span className="text-crema/40 text-[10px] font-bold flex items-center gap-1">
            <MapPin size={10} />
            {formatDistance(business.distance_m)}
          </span>
        </div>

        {/* Rating + Abierto/Cerrado */}
        <div className="flex flex-wrap items-center gap-2 pt-1 sm:gap-3">
          <StarRating rating={business.avg_rating} size="sm" showNumber={true} />
          <span className="w-1 h-1 rounded-full bg-crema/20" />
          <div className="flex items-center gap-1">
            <Clock size={10} className={business.is_open_now ? 'text-verde' : 'text-rojo'} />
            <span className={`text-[10px] font-black uppercase tracking-wider ${
              business.is_open_now ? 'text-verde' : 'text-rojo'
            }`}>
              {business.is_open_now ? 'Abierto' : 'Cerrado'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Indicador de Acción ── */}
      <div className="p-2 bg-crema/5 rounded-xl border border-crema/10 text-crema/30 flex-shrink-0">
        <ChevronRight size={16} strokeWidth={3} />
      </div>
    </motion.button>
  );
}
