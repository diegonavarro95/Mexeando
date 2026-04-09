/**
 * src/store/mapStore.ts
 *
 * Estado global del mapa (spec §06).
 *
 * Campos:
 *   businesses[]  – resultados del endpoint GET /api/v1/businesses
 *   filtros activos (categoryId, radius)
 *   ubicación actual del usuario (lat, lng)
 *
 * También expone helpers para la pantalla T-1 (Explorar):
 *   - isLoading / error para mostrar estados de carga
 *   - selectedBusinessId para highlight en el mapa
 *   - searchQuery para la barra de búsqueda
 */

import { create } from 'zustand';

// ─── Tipo importado del backend (duplicado aquí para independencia) ───────────

export interface BusinessMapResult {
  id: string;
  name: string;
  slug: string;
  category_slug: string;
  category_icon: string;
  lat: number;
  lng: number;
  primary_image: string | null;
  avg_rating: number;
  review_count: number;
  checkin_count: number;
  accepts_card: boolean;
  ola_verified: boolean;
  distance_m: number;
  indice_ola: number;
  is_open_now: boolean;
}

// ─── Categorías (spec §02, tabla categories) ─────────────────────────────────

export type CategorySlug =
  | 'food'
  | 'crafts'
  | 'tourism'
  | 'entertainment'
  | 'wellness'
  | 'retail';

// ─── Tipos de estado ─────────────────────────────────────────────────────────

interface MapState {
  // ── Datos ─────────────────────────────────────────────────────────────────
  businesses: BusinessMapResult[];

  // ── Filtros activos (spec §02 T-1) ───────────────────────────────────────
  /** null = "Todos" */
  categoryId: number | null;
  /** Radio de búsqueda en metros. Default: 2000 (spec §02 T-1) */
  radius: number;
  /** Texto de búsqueda libre (parámetro q del endpoint) */
  searchQuery: string;

  // ── Ubicación del usuario ─────────────────────────────────────────────────
  userLat: number | null;
  userLng: number | null;
  /** true si el usuario denegó el permiso de geolocalización */
  locationDenied: boolean;

  // ── UI ────────────────────────────────────────────────────────────────────
  isLoading: boolean;
  error: string | null;
  /** ID del negocio resaltado en el mapa / lista */
  selectedBusinessId: string | null;
  /** true cuando no hay conexión y se muestran datos de IndexedDB */
  isOffline: boolean;

  // ── Acciones ──────────────────────────────────────────────────────────────
  setBusinesses: (businesses: BusinessMapResult[]) => void;
  setCategoryId: (id: number | null) => void;
  setRadius: (radius: number) => void;
  setSearchQuery: (query: string) => void;
  setUserLocation: (lat: number, lng: number) => void;
  setLocationDenied: (denied: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedBusiness: (id: string | null) => void;
  setOffline: (offline: boolean) => void;
  resetFilters: () => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

const DEFAULT_RADIUS = 2000; // spec §02 T-1

export const useMapStore = create<MapState>((set) => ({
  // Estado inicial
  businesses: [],
  categoryId: null,
  radius: DEFAULT_RADIUS,
  searchQuery: '',
  userLat: null,
  userLng: null,
  locationDenied: false,
  isLoading: false,
  error: null,
  selectedBusinessId: null,
  isOffline: false,

  // Acciones
  setBusinesses: (businesses) => set({ businesses, error: null }),
  setCategoryId: (categoryId) => set({ categoryId }),
  setRadius: (radius) => set({ radius }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setUserLocation: (userLat, userLng) => set({ userLat, userLng, locationDenied: false }),
  setLocationDenied: (locationDenied) => set({ locationDenied }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  setSelectedBusiness: (selectedBusinessId) => set({ selectedBusinessId }),
  setOffline: (isOffline) => set({ isOffline }),

  resetFilters: () =>
    set({
      categoryId: null,
      radius: DEFAULT_RADIUS,
      searchQuery: '',
    }),
}));