/**
 * src/pages/tourist/BusinessDetailPage.tsx
 * T-2 — Detalle del negocio (Versión Premium)
 * UX/UI: PWA Support, Videos del Mundial, Rutas blindadas, Bookmarks
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft, Bookmark, MapPin, Navigation,
  MessageSquare, Star, CreditCard, Flame, Languages, X, Car, Footprints, Play
} from 'lucide-react';
import { GoogleMap, useJsApiLoader, DirectionsRenderer, MarkerF } from '@react-google-maps/api';

import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useMapStore } from '../../store/MapStore';
import StarRating from '../../components/ui/StarRating';
import OlaBadge from '../../components/ui/OlaBadge';
import BottomNav from '../../components/ui/BottomNav';

interface MenuItem {
  id: string; name: string; price: number | null; icon: string | null; sort_order: number;
}
interface Review {
  id: string; rating: number; body: string | null; language: string; created_at: string;
  profile: { display_name: string; avatar_url: string | null };
}
interface BusinessVideo {
  id: string; storage_path: string; video_type: 'pre_worldcup' | 'post_worldcup';
}
interface BusinessDetail {
  id: string; name: string; slug: string; description: string | null; translated_description: string | null;
  category_slug: string; category_icon: string; address: string; city: string; phone: string | null;
  website: string | null; accepts_card: boolean; ola_verified: boolean; avg_rating: number;
  review_count: number; checkin_count: number; schedule: Record<string, string[] | null> | null;
  lat?: number; lng?: number;
  folio?: number; worldcup_finished?: boolean;
  images: { id: string; storage_path: string; is_primary: boolean; sort_order: number }[];
  menu_items: MenuItem[]; recent_reviews: Review[];
  business_videos?: BusinessVideo[];
}

function getImageUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/business_images/${path}`;
}

function getVideoUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/business_videos/${path}`;
}

function formatDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

const modalMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#241500' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#F4A300' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#382200' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

export default function BusinessDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation(); 
  const preferredLang = useAuthStore((s) => s.preferredLang);
  
  const { userLat, userLng, setUserLocation, businesses: globalBusinesses } = useMapStore(); 

  const passedLat = location.state?.targetLat;
  const passedLng = location.state?.targetLng;

  const [imgIndex, setImgIndex] = useState(0);
  const [isSaved, setIsSaved] = useState(false); 
  
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  const [travelMode, setTravelMode] = useState<google.maps.TravelMode>('DRIVING' as any);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);

  const { isLoaded: isMapLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places'], 
  });

  useEffect(() => {
    if (!userLat && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => setUserLocation(coords.latitude, coords.longitude),
        null,
        { enableHighAccuracy: true }
      );
    }
  }, [userLat, setUserLocation]);

  useEffect(() => {
    if (!id) return;
    api.get('/api/v1/favorites')
      .then(res => {
        const favs = res.data.data?.favorites || [];
        setIsSaved(favs.some((fav: any) => fav.id === id));
      })
      .catch(err => console.error("Error al cargar favoritos", err));
  }, [id]);

  const { data: business, isLoading, error } = useQuery({
    queryKey: ['businessDetail', id, preferredLang],
    queryFn: async () => {
      const { data } = await api.get<{ data: BusinessDetail }>(`/api/v1/businesses/${id}`, {
        params: { lang: preferredLang },
      });
      const biz = data.data;
      biz.images = [...biz.images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
      return biz;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 10,
  });

  useEffect(() => {
    if (!showRouteModal || !isMapLoaded || !userLat || !userLng || !business || !window.google) return;

    const directionsService = new window.google.maps.DirectionsService();
    const globalBiz = globalBusinesses.find(b => b.id === id);

    const destLat = Number(passedLat || globalBiz?.lat || business?.lat);
    const destLng = Number(passedLng || globalBiz?.lng || business?.lng);

    const destination = (!isNaN(destLat) && !isNaN(destLng) && destLat !== 0) 
      ? { lat: destLat, lng: destLng }
      : `${business.address}, ${business.city}, Mexico`;

    directionsService.route({
      origin: { lat: userLat, lng: userLng },
      destination: destination,
      travelMode: travelMode,
    })
    .then(results => setDirectionsResponse(results))
    .catch(err => console.error("Error al calcular ruta:", err));

  }, [showRouteModal, travelMode, isMapLoaded, business, userLat, userLng, passedLat, passedLng, globalBusinesses, id]);

  const toggleSave = async () => {
    if (!id) return;
    try {
      const currentSavedState = isSaved;
      setIsSaved(!currentSavedState); 
      
      if (currentSavedState) {
        await api.delete(`/api/v1/favorites/${id}`);
      } else {
        await api.post('/api/v1/favorites', { business_id: id });
      }
    } catch {
      setIsSaved(isSaved);
    }
  };

  if (isLoading) {
    return <div className="min-h-[100dvh] bg-[#110800] flex items-center justify-center"><div className="w-10 h-10 border-4 border-white/10 border-t-[#C1121F] rounded-full animate-spin" /></div>;
  }

  if (error || !business) {
    return (
      <div className="min-h-[100dvh] bg-[#110800] flex flex-col items-center justify-center gap-4 px-8 text-center text-[#FFF3DC]">
        <span className="text-5xl">😕</span>
        <p className="font-bold text-lg text-white">Este negocio no está disponible</p>
        <p className="text-white/40 text-sm">Verifica tu conexión a internet o intenta más tarde.</p>
        <button onClick={() => navigate(-1)} className="bg-[#C1121F] text-white px-6 py-2.5 rounded-full font-bold text-sm active:scale-95 transition-all shadow-lg mt-4">Regresar</button>
      </div>
    );
  }

  const description = business.translated_description ?? business.description ?? '';
  const hasImages = business.images.length > 0;
  const routeDistance = directionsResponse?.routes[0]?.legs[0]?.distance?.text;
  const routeTime = directionsResponse?.routes[0]?.legs[0]?.duration?.text;

  const globalBiz = globalBusinesses.find(b => b.id === id);
  const extDestLat = passedLat || globalBiz?.lat || business?.lat;
  const extDestLng = passedLng || globalBiz?.lng || business?.lng;

  const externalMapsUrl = (userLat && userLng && extDestLat && extDestLng)
    ? `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${extDestLat},${extDestLng}&travelmode=${travelMode === 'DRIVING' ? 'driving' : 'walking'}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((business?.address || '') + ', ' + (business?.city || ''))}`;

  const preVideo = business.business_videos?.find(v => v.video_type === 'pre_worldcup');
  const postVideo = business.business_videos?.find(v => v.video_type === 'post_worldcup');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-[100dvh] bg-[#110800] text-[#FFF3DC] flex flex-col pb-32">

      <section className="relative h-[45vh] w-full overflow-hidden flex-shrink-0">
        <div className="absolute inset-0">
          <AnimatePresence mode="wait">
            {hasImages ? (
              <motion.img
                key={imgIndex}
                src={getImageUrl(business.images[imgIndex].storage_path)}
                initial={{ scale: 1.05, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}
                className="w-full h-full object-cover" alt={business.name}
              />
            ) : (
              <div className="w-full h-full bg-[#1a0d00] flex items-center justify-center text-7xl opacity-50">{business.category_icon}</div>
            )}
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-t from-[#110800] via-[#110800]/20 to-black/60" />
        </div>

        <div className="absolute top-0 left-0 right-0 z-20">
          <div className="h-[3px] w-full flex"><div className="flex-1 bg-[#006847]" /><div className="flex-1 bg-white" /><div className="flex-1 bg-[#C1121F]" /></div>
          <div className="px-4 py-3 flex items-center justify-between" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}>
            <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white active:scale-90 transition-all"><ChevronLeft size={24} /></button>
            <button 
              onClick={toggleSave} 
              className={`w-10 h-10 flex items-center justify-center rounded-full backdrop-blur-md border active:scale-90 transition-all ${
                isSaved ? 'bg-[#C1121F]/20 border-[#C1121F]/50' : 'bg-black/40 border-white/10'
              }`}
            >
              <Bookmark size={20} className={isSaved ? 'fill-[#C1121F] text-[#C1121F]' : 'text-white'} />
            </button>
          </div>
        </div>

        {business.images.length > 1 && (
          <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-2 z-20">
            {business.images.map((_, i) => (
              <button key={i} onClick={() => setImgIndex(i)} className={`h-1.5 rounded-full transition-all ${i === imgIndex ? 'bg-[#C1121F] w-6' : 'bg-white/40 w-1.5'}`} />
            ))}
          </div>
        )}
      </section>

      <main className="px-4 -mt-6 relative z-30 space-y-8">
        <div className="space-y-2 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0 max-w-[70%] truncate text-[10px] font-black uppercase tracking-[0.2em] text-[#C1121F] bg-[#C1121F]/10 px-2 py-0.5 rounded-md">{business.category_icon} {business.category_slug}</span>
            <div className="flex-shrink-0">
              {business.ola_verified && <OlaBadge />}
            </div>
          </div>
          <h1 className="break-words text-2xl font-black italic tracking-tighter text-white uppercase leading-tight drop-shadow-lg sm:text-3xl">{business.name}</h1>
          <div className="flex items-start gap-1.5 text-white/50 mt-1 min-w-0">
            <MapPin size={14} className="text-[#F4A300] mt-0.5 flex-shrink-0" />
            <span className="min-w-0 break-words text-[11px] font-bold uppercase tracking-wider">{business.address}, {business.city}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatBox
            label="Rating"
            value={business.avg_rating.toFixed(1)}
            sub={`${business.review_count} reseñas`}
            icon={<Star fill="#F4A300" className="text-[#F4A300]" size={14} />}
          />
          <StatBox
            label="Populares"
            value={business.checkin_count}
            sub="Check-ins"
            icon={<Flame className="text-[#C1121F]" size={14} />}
          />
          <StatBox
            label="Atención"
            value="ES/EN"
            sub="Idiomas"
            icon={<Languages className="text-[#2D6A4F]" size={14} />}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {business.accepts_card && <DetailTag icon={<CreditCard size={12} />} label="Acepta Tarjeta" />}
          {business.checkin_count > 100 && <DetailTag icon={<Flame size={12} />} label="Muy Popular" highlight />}
          {business.folio && <DetailTag icon={<Bookmark size={12} />} label={`Folio: #${business.folio}`} />}
        </div>

        {(preVideo || postVideo) && (
          <section className="space-y-3">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F4A300]">Ola México 2026</h2>
            <div className="flex gap-3">
              {preVideo && (
                <button 
                  onClick={() => setActiveVideo(getVideoUrl(preVideo.storage_path))}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#F4A300]/10 border border-[#F4A300]/30 text-[#F4A300] py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-md"
                >
                  <Play size={14} className="fill-current" /> Intro
                </button>
              )}
              {postVideo && business.worldcup_finished && (
                <button 
                  onClick={() => setActiveVideo(getVideoUrl(postVideo.storage_path))}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#52B788]/10 border border-[#52B788]/30 text-[#52B788] py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-md"
                >
                  <Play size={14} className="fill-current" /> Despedida
                </button>
              )}
            </div>
          </section>
        )}

        {business.menu_items.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Menú Destacado</h2>
            <div className="flex gap-3 overflow-x-auto [scrollbar-width:none] pb-2">
              {business.menu_items.map((item) => (
                <div
                  key={item.id}
                  className="flex-shrink-0 w-28 sm:w-32 rounded-[24px] border border-[#C1121F]/10 bg-[#1e1006] p-4 text-center shadow-lg"
                >
                  <span className="text-3xl drop-shadow-md">{item.icon || '🍽️'}</span>
                  <p className="mt-2 text-[11px] font-bold leading-tight text-white/90">{item.name}</p>
                  {item.price !== null && <p className="mt-1 text-xs font-black text-[#F4A300]">${item.price.toFixed(0)}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {description && (
          <section className="space-y-3 bg-white/5 border border-white/5 p-4 rounded-[24px]">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Sobre este lugar</h2>
            <p className="text-[13px] leading-relaxed text-white/80 font-medium">{description}</p>
          </section>
        )}

        {business.recent_reviews.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-end justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Reseñas de Turistas</h2>
              <span className="text-[10px] font-bold text-[#F4A300] bg-[#F4A300]/10 px-2 py-0.5 rounded-full">{business.review_count} en total</span>
            </div>
            <div className="space-y-3">
              {business.recent_reviews.map((rev) => (
                <div key={rev.id} className="bg-[#1e1006] border border-white/5 rounded-3xl p-4 space-y-3 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#C1121F] flex items-center justify-center font-black text-white text-xs overflow-hidden shadow-inner">
                        {rev.profile.avatar_url ? <img src={rev.profile.avatar_url} className="w-full h-full object-cover" alt="" /> : rev.profile.display_name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white">{rev.profile.display_name}</span>
                        <p className="text-[9px] text-white/30 uppercase tracking-wider">{formatDate(rev.created_at)}</p>
                      </div>
                    </div>
                    <StarRating rating={rev.rating} size="sm" />
                  </div>
                  {rev.body && <p className="text-xs text-white/60 leading-relaxed italic">"{rev.body}"</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <AnimatePresence>
        {activeVideo && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          >
            <button 
              onClick={() => setActiveVideo(null)}
              className="absolute top-6 right-6 p-2 bg-white/10 rounded-full text-white/60 hover:text-white active:scale-90"
            >
              <X size={24} />
            </button>
            <div className="w-full max-w-md aspect-[9/16] bg-black rounded-[32px] overflow-hidden border border-white/10 shadow-2xl relative">
              <video 
                src={activeVideo} 
                controls 
                autoPlay 
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRouteModal && isMapLoaded && userLat && userLng && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              onClick={() => setShowRouteModal(false)} className="fixed inset-0 bg-black/80 z-[60] backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 h-[80dvh] bg-[#110800] rounded-t-[36px] z-[70] flex flex-col overflow-hidden border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.8)]"
            >
              <div className="p-4 flex flex-col gap-4 bg-[#1a0d00] border-b border-white/5 flex-shrink-0">
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-1" />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-black text-white uppercase italic tracking-tight">Ruta hacia {business.name}</h3>
                    {routeDistance && <p className="text-xs text-[#52B788] font-bold mt-1">{routeTime} de viaje ({routeDistance})</p>}
                  </div>
                  <button onClick={() => setShowRouteModal(false)} className="flex-shrink-0 p-2 bg-white/10 rounded-full active:scale-90 text-white/60 hover:text-white"><X size={18}/></button>
                </div>
                
                <div className="flex gap-2 bg-black/40 p-1 rounded-xl">
                  <button 
                    onClick={() => setTravelMode(window.google.maps.TravelMode.DRIVING)} 
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${travelMode === 'DRIVING' ? 'bg-[#C1121F] text-white shadow-md' : 'text-white/40 hover:text-white'}`}
                  >
                    <Car size={16}/> Auto
                  </button>
                  <button 
                    onClick={() => setTravelMode(window.google.maps.TravelMode.WALKING)} 
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${travelMode === 'WALKING' ? 'bg-[#C1121F] text-white shadow-md' : 'text-white/40 hover:text-white'}`}
                  >
                    <Footprints size={16}/> Caminando
                  </button>
                </div>
              </div>

              <div className="flex-1 relative bg-[#1a0d00]">
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={{ lat: userLat, lng: userLng }}
                  zoom={14}
                  options={{ disableDefaultUI: true, styles: modalMapStyle }}
                >
                  <MarkerF 
                    position={{ lat: userLat, lng: userLng }} 
                    icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' }} 
                  />
                  {directionsResponse && (
                    <DirectionsRenderer 
                      directions={directionsResponse} 
                      options={{ suppressMarkers: false, polylineOptions: { strokeColor: '#C1121F', strokeOpacity: 0.8, strokeWeight: 5 } }} 
                    />
                  )}
                </GoogleMap>
                
                <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6">
                  <a 
                    href={externalMapsUrl} 
                    target="_blank" rel="noopener noreferrer" 
                    className="w-full bg-[#110800]/90 backdrop-blur-md border border-[#F4A300]/50 text-[#F4A300] px-4 py-4 rounded-2xl font-black uppercase text-[10px] sm:text-[11px] tracking-[0.12em] sm:tracking-widest shadow-xl flex justify-center items-center gap-2 text-center active:scale-95 transition-all"
                  >
                    <Navigation size={16} /> Abrir en la App de Google Maps
                  </a>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-[#110800] via-[#110800] to-transparent px-4 pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom)+1rem)] sm:pb-[calc(5rem+env(safe-area-inset-bottom)+1rem)]">
        <div className="app-shell-form grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              if (userLat && userLng) {
                setShowRouteModal(true); 
              } else {
                window.open(externalMapsUrl, '_blank');
              }
            }}
            className="min-w-0 flex items-center justify-center gap-2 bg-[#C1121F] text-white px-3 py-4 rounded-[18px] font-black uppercase text-[10px] sm:text-[11px] tracking-[0.12em] sm:tracking-widest text-center shadow-[0_4px_20px_rgba(193,18,31,0.5)] active:scale-95 transition-all"
          >
            <Navigation size={16} strokeWidth={3} /> Cómo Llegar
          </button>
          
          <button
            onClick={() => navigate(`/chat/${id}`)}
            className="min-w-0 flex items-center justify-center gap-2 bg-[#1e1006] backdrop-blur-md border border-[#F4A300]/40 text-[#F4A300] px-3 py-4 rounded-[18px] font-black uppercase text-[10px] sm:text-[11px] tracking-[0.12em] sm:tracking-widest text-center active:scale-95 transition-all shadow-lg"
          >
            <MessageSquare size={16} strokeWidth={3} /> Chat con IA
          </button>
        </div>
      </footer>

      <BottomNav />
    </motion.div>
  );
}

function StatBox({ label, value, sub, icon }: { label: string; value: string | number; sub: string; icon: React.ReactNode }) {
  return (
    <div className="bg-[#1e1006] border border-white/5 rounded-2xl p-3 flex flex-col items-center text-center gap-1 shadow-md">
      <div className="flex items-center gap-1 text-[9px] font-black text-white/40 uppercase tracking-wider">{icon} {label}</div>
      <div className="text-xl font-black text-white">{value}</div>
      <div className="text-[9px] font-bold text-white/30 uppercase tracking-tight">{sub}</div>
    </div>
  );
}

function DetailTag({ icon, label, highlight = false }: { icon: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-tight shadow-sm ${highlight ? 'bg-[#F4A300]/15 border-[#F4A300]/50 text-[#F4A300]' : 'bg-white/5 border-white/10 text-white/60'}`}>
      {icon} {label}
    </div>
  );
}
