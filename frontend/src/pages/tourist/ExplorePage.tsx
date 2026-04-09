/**
 * src/pages/tourist/ExplorePage.tsx
 * T-1 — Explorar (Pantalla Principal de Mapa)
 * UX/UI Premium: Mapa expandible, Tarjetas Flotantes, Glassmorphism
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Compass, Target, Map as MapIcon, WifiOff, 
  Maximize2, Minimize2, Star, Clock, ChevronRight, X, MapPin 
} from 'lucide-react';
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api';
import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '../../store/authStore';
import { useMapStore } from '../../store/MapStore';
import { api } from '../../services/api';
import BusinessCard from '../../components/map/BusinessCard';
import BottomNav from '../../components/ui/BottomNav';
import { saveBusinessesToIDB, getCachedBusinesses } from '../../lib/db'; 
import { useProximityAlerts } from '../../hooks/h-use-proximity-alert';

const CATEGORIES = [
  { id: null, label: 'Todo', icon: '🌮' },
  { id: 1, label: 'Comida', icon: '🍽️' },
  { id: 2, label: 'Artesanías', icon: '🎨' },
  { id: 3, label: 'Tours', icon: '🗺️' },
  { id: 4, label: 'Arte', icon: '🎭' },
  { id: 5, label: 'Bienestar', icon: '🧘' },
  { id: 6, label: 'Comercio', icon: '🛍️' },
];

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#110800' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#F4A300' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#241500' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

export default function ExplorePage() {
  const navigate = useNavigate();
  const { displayName } = useAuthStore();
  
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [selectedBiz, setSelectedBiz] = useState<any | null>(null);

  const {
    categoryId, radius, searchQuery, userLat, userLng, 
    locationDenied, isOffline, setBusinesses, setCategoryId, 
    setSearchQuery, setUserLocation, setLocationDenied, setOffline
  } = useMapStore();

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places'],
  });

  // ─── GEOLOCALIZACIÓN ───
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setUserLocation(coords.latitude, coords.longitude),
      () => setLocationDenied(true),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [setUserLocation, setLocationDenied]);

  // ─── FETCH CON REACT QUERY ───
  const { isLoading, data: fetchedData } = useQuery({
    queryKey: ['businesses', userLat, userLng, categoryId, searchQuery],
    queryFn: async () => {
      if (userLat === null || userLng === null) return [];
      
      try {
        const params: any = { lat: userLat, lng: userLng, radius, limit: 50 };
        if (categoryId) params.category_id = categoryId;
        if (searchQuery) params.q = searchQuery;

        const res = await api.get('/api/v1/businesses', { params });
        const list = res.data?.data?.businesses || [];
        
        await saveBusinessesToIDB(list);
        setOffline(false);
        return list;
      } catch (err: any) {
        const isNetworkError = !navigator.onLine || err.message === 'Network Error';

        if (isNetworkError) {
          console.warn("🚨 Sin conexión de red, activando Modo Offline PWA");
          setOffline(true);
          const cached = await getCachedBusinesses();
          
          return cached.filter(b => {
            const matchesCat = categoryId ? b.category_id === categoryId : true;
            const matchesQ = searchQuery 
              ? (b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                 (b.description && b.description.toLowerCase().includes(searchQuery.toLowerCase()))) 
              : true;
            return matchesCat && matchesQ;
          });
        }
        
        console.error("🚨 Error interno del servidor (500):", err.response?.data || err.message);
        setOffline(false);
        return []; 
      }
    },
    enabled: userLat !== null && userLng !== null,
    staleTime: 1000 * 60 * 5, 
  });

  useEffect(() => {
    if (fetchedData) setBusinesses(fetchedData);
  }, [fetchedData, setBusinesses]);

  useProximityAlerts({ userLat, userLng, businesses: fetchedData || [] });

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const mapCenter = useMemo(() => ({
    lat: userLat || 19.4326,
    lng: userLng || -99.1332,
  }), [userLat, userLng]);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── HANDLERS DE UI ───
  const handleSearch = (val: string) => {
    setLocalSearch(val);
    setSelectedBiz(null); 
    if (isMapExpanded) setIsMapExpanded(false);
    
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchQuery(val);
    }, 500); 
  };

  const handleCategoryClick = (id: number | null) => {
    setCategoryId(id);
    setSelectedBiz(null); 
    if (isMapExpanded) setIsMapExpanded(false); 
  };

  return (
    <div className="min-h-[100dvh] bg-[#110800] flex flex-col overflow-hidden text-[#FFF3DC]">
      
      {/* ─── HEADER ─── */}
      <AnimatePresence>
        {!isMapExpanded && (
          <motion.header 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50, height: 0 }}
            className="sticky top-0 z-40 bg-[#110800]/80 backdrop-blur-xl border-b border-white/5"
          >
            <div className="h-[3px] w-full flex">
              <div className="flex-1 bg-[#006847]" /><div className="flex-1 bg-white" /><div className="flex-1 bg-[#C1121F]" />
            </div>

            <div className="px-4 pb-3 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-2xl font-black italic tracking-tighter text-white drop-shadow-md">
                  {displayName ? `Hola, ${displayName.split(' ')[0]}` : 'Descubrir'}
                </h1>
                <div className="flex gap-2">
                  {isOffline && <WifiOff size={18} className="text-[#F4A300] animate-pulse mt-2 mr-1" />}
                  <button onClick={() => navigate('/profile')} className="w-10 h-10 rounded-full bg-[#C1121F] border-2 border-white/10 flex items-center justify-center font-black shadow-lg active:scale-90 transition-transform text-white">
                    {displayName ? displayName[0].toUpperCase() : '?'}
                  </button>
                </div>
              </div>

              {locationDenied && !userLat && !userLng && (
                <div className="mb-3 rounded-2xl border border-[#F4A300]/25 bg-[#F4A300]/10 px-3 py-2 text-[11px] font-bold leading-snug text-[#F4A300]">
                  Activa tu ubicación para ver negocios cercanos y rutas más precisas.
                </div>
              )}

              <div className="relative group mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#C1121F] transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Buscar sabor local..."
                  value={localSearch}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-10 py-3 text-sm outline-none focus:border-[#C1121F]/50 transition-all placeholder:text-[#FFF3DC]/20 text-white"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                {CATEGORIES.map((cat) => (
                  <motion.button
                    key={String(cat.id)}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleCategoryClick(cat.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black border flex-shrink-0 transition-all ${
                      categoryId === cat.id ? 'bg-[#C1121F] border-[#C1121F] text-white shadow-[0_4px_15px_rgba(193,18,31,0.4)]' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                    }`}
                  >
                    <span>{cat.icon}</span> {cat.label.toUpperCase()}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col relative z-10">
        
        {/* ─── MAPA INTERACTIVO ─── */}
        <motion.div 
          animate={{ 
            height: isMapExpanded ? 'calc(100dvh - 80px)' : '300px', 
            margin: isMapExpanded ? '0px' : '12px 16px 0 16px',
            borderRadius: isMapExpanded ? '0px 0px 32px 32px' : '24px'
          }}
          transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
          className="relative overflow-hidden border border-white/10 shadow-2xl bg-[#1a0d00] flex-shrink-0 z-10"
        >
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={mapCenter}
              zoom={isMapExpanded ? 15 : 14}
              onLoad={onMapLoad}
              options={{ disableDefaultUI: true, styles: darkMapStyle }}
              onClick={() => setSelectedBiz(null)} 
            >
              {userLat && userLng && (
                <MarkerF position={mapCenter} icon={{ url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' }} />
              )}

              {(fetchedData || []).map((biz: any) => {
                const isSelected = selectedBiz?.id === biz.id;
                return (
                  <MarkerF
                    key={biz.id}
                    position={{ lat: Number(biz.lat), lng: Number(biz.lng) }}
                    onClick={() => {
                      setSelectedBiz(biz);
                      map?.panTo({ lat: Number(biz.lat), lng: Number(biz.lng) });
                    }}
                    icon={{
                      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                        <svg width="${isSelected ? '50' : '40'}" height="${isSelected ? '50' : '40'}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="20" cy="20" r="16" fill="${isSelected ? '#C1121F' : '#110800'}" stroke="#C1121F" stroke-width="2.5"/>
                          <text x="50%" y="50%" font-size="16" text-anchor="middle" dy=".35em">${biz.category_icon || '📍'}</text>
                        </svg>
                      `)}`,
                      anchor: new google.maps.Point(20, 20)
                    }}
                  />
                );
              })}
            </GoogleMap>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <Compass className="animate-spin text-[#C1121F]" size={32} />
              <span className="text-[10px] font-black uppercase tracking-widest text-[#C1121F]/50">Sincronizando GPS...</span>
            </div>
          )}
          
          <div className={`absolute right-4 flex flex-col gap-2 transition-all duration-300 ${selectedBiz ? 'bottom-32' : 'bottom-4'}`}>
            <button 
              onClick={() => map?.panTo(mapCenter)} 
              className="w-10 h-10 bg-[#1e1006]/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-[0_4px_15px_rgba(0,0,0,0.5)] border border-white/10 active:scale-90"
            >
              <Target size={18} className="text-[#F4A300]" />
            </button>
            <button 
              onClick={() => setIsMapExpanded(!isMapExpanded)} 
              className="w-10 h-10 bg-[#1e1006]/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-[0_4px_15px_rgba(0,0,0,0.5)] border border-white/10 active:scale-90"
            >
              {isMapExpanded ? <Minimize2 size={18} className="text-white" /> : <Maximize2 size={18} className="text-white" />}
            </button>
          </div>

          <AnimatePresence>
            {selectedBiz && (
              <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.95 }}
                transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
                className="absolute bottom-4 left-4 right-4 bg-[#110800]/95 backdrop-blur-3xl border border-white/10 rounded-3xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-20"
              >
                <button 
                  onClick={() => setSelectedBiz(null)} 
                  className="absolute top-2 right-2 p-1.5 bg-black/40 rounded-full text-white/50 hover:text-white z-10"
                >
                  <X size={12}/>
                </button>

                <div className="flex items-center gap-3">
                  {selectedBiz.images?.[0]?.storage_path || selectedBiz.primary_image ? (
                    <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 border border-white/5 relative">
                      <img 
                        src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/business_images/${selectedBiz.images?.[0]?.storage_path || selectedBiz.primary_image}`} 
                        alt={selectedBiz.name}
                        className="w-full h-full object-cover"
                        onError={(e) => e.currentTarget.style.display = 'none'} 
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/5">
                       <MapPin size={20} className="text-white/20"/>
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-[#F4A300]/15 text-[#F4A300] uppercase tracking-widest">
                        {selectedBiz.category_icon || '📍'} {selectedBiz.category_slug || 'Local'}
                      </span>
                      {Number(selectedBiz.avg_rating) > 0 && (
                        <div className="flex items-center gap-0.5 text-[#F4A300]">
                          <Star size={10} fill="currentColor" />
                          <span className="text-[10px] font-black">{selectedBiz.avg_rating}</span>
                        </div>
                      )}
                    </div>
                    
                    <h3 className="text-sm font-black text-white truncate leading-tight">{selectedBiz.name}</h3>
                    
                    <div className="flex items-center gap-1 text-[9px] text-white/40 mt-0.5">
                      <Clock size={10} className="text-[#52B788]" />
                      <span className="truncate">Ver perfil para horarios</span>
                    </div>
                  </div>

                  {/* 🔥 FIX: Enviamos lat y lng a través del State del Router */}
                  <button 
                    onClick={() => navigate(`/business/${selectedBiz.id}`, { 
                      state: { targetLat: selectedBiz.lat, targetLng: selectedBiz.lng } 
                    })}
                    className="w-12 h-12 rounded-2xl bg-[#C1121F] flex items-center justify-center flex-shrink-0 shadow-[0_4px_15px_rgba(193,18,31,0.4)] active:scale-90 transition-transform"
                  >
                    <ChevronRight size={20} className="text-white" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ─── LISTADO INFERIOR ─── */}
        <AnimatePresence>
          {!isMapExpanded && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="px-4 mt-6 space-y-4 overflow-y-auto pb-6"
            >
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#FFF3DC]/30">
                  {categoryId === null ? 'Cerca de ti' : `Resultados: ${CATEGORIES.find(c => c.id === categoryId)?.label}`}
                </h3>
                <span className="text-[9px] font-black text-[#F4A300] bg-[#F4A300]/10 px-2 py-0.5 rounded-full">
                  {fetchedData?.length || 0} LOCALES
                </span>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-24 bg-white/5 border border-white/5 rounded-3xl animate-pulse relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                    </div>
                  ))}
                </div>
              ) : (!fetchedData || fetchedData.length === 0) ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 text-center opacity-30">
                  <MapIcon className="mx-auto mb-2" size={32} strokeWidth={1} />
                  <p className="text-xs font-bold uppercase tracking-widest">Sin resultados</p>
                </motion.div>
              ) : (
                <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08 } } }} className="space-y-3">
                  {fetchedData.map((biz: any) => (
                    <motion.div key={biz.id} variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}>
                      {/* BusinessCard ahora debe recibir y enviar estas coordenadas */}
                      <BusinessCard business={biz} />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav activeTab="map" />
    </div>
  );
}
