/**
 * src/store/passportStore.ts
 *
 * Estado global del Pasaporte del Mundial (spec §06).
 *
 * Campos:
 *   album[]       – colecciones con sus estampas y progreso
 *   pointBalance  – sincronizado con authStore.pointBalance
 *
 * Acciones importantes (spec §06 "Flujo de datos"):
 *   - Tras check-in: setPointBalance() en authStore Y aquí
 *   - Tras abrir sobre: addStamps(stamp_ids[]) actualiza el álbum
 */

import { create } from 'zustand';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type CollectionSlug = 'sabores' | 'artesanias' | 'guias' | 'iconos';

/** Una estampa individual del catálogo */
export interface Stamp {
  id: number;
  collection_slug: CollectionSlug;
  name: string;
  /** Emoji / URL del ícono de la estampa */
  icon: string;
  /** Ciudad exclusiva; null = disponible en todas */
  exclusive_city: string | null;
}

/** Estampa que ya posee el usuario */
export interface UserStamp {
  stamp_id: number;
  obtained_at: string; // ISO timestamp
}

/** Colección con su progreso (viene del endpoint GET /api/v1/passport/album) */
export interface StampCollection {
  collection_slug: CollectionSlug;
  collection_name: string;
  total_stamps: number;
  obtained_stamps: number;
  completion_pct: number;
  is_complete: boolean;
  /** Todas las estampas de la colección con su estado obtenido/no obtenido */
  stamps: (Stamp & { obtained: boolean; obtained_at?: string })[];
}

// ─── Estado ──────────────────────────────────────────────────────────────────

interface PassportState {
  // ── Datos ─────────────────────────────────────────────────────────────────
  album: StampCollection[];
  /** Sincronizado con authStore.pointBalance (spec §06) */
  pointBalance: number;

  // ── UI ────────────────────────────────────────────────────────────────────
  isLoading: boolean;
  error: string | null;
  /** Estampas recién reveladas al abrir un sobre (para la animación) */
  newlyRevealedStampIds: number[];
  /** true mientras se muestra la animación de apertura del sobre */
  isOpeningPack: boolean;

  // ── Acciones ──────────────────────────────────────────────────────────────

  /** Carga completa del álbum desde el servidor */
  setAlbum: (collections: StampCollection[]) => void;

  /**
   * Actualiza el saldo de puntos.
   * Llamar desde authStore.setPointBalance para mantener sincronía (spec §06).
   */
  setPointBalance: (balance: number) => void;

  /**
   * Añade las estampas recién obtenidas al álbum tras abrir un sobre.
   * Recibe los IDs devueltos por POST /api/v1/passport/open-pack.
   * spec §06: "actualizar passportStore.album con las nuevas estampas"
   */
  addStamps: (stampIds: number[]) => void;

  /** Controla la animación de apertura del sobre */
  setOpeningPack: (isOpening: boolean) => void;

  /** Limpia las estampas recién reveladas una vez que termina la animación */
  clearNewlyRevealed: () => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  /** Resetea el store al cerrar sesión */
  resetPassport: () => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const usePassportStore = create<PassportState>((set, get) => ({
  // Estado inicial
  album: [],
  pointBalance: 0,
  isLoading: false,
  error: null,
  newlyRevealedStampIds: [],
  isOpeningPack: false,

  // Acciones
  setAlbum: (album) => set({ album, error: null }),

  setPointBalance: (pointBalance) => set({ pointBalance }),

  addStamps: (stampIds) => {
    const { album } = get();

    // Marca cada stamp_id como `obtained: true` dentro de su colección
    const updatedAlbum = album.map((collection) => {
      const updatedStamps = collection.stamps.map((stamp) => {
        if (stampIds.includes(stamp.id) && !stamp.obtained) {
          return {
            ...stamp,
            obtained: true,
            obtained_at: new Date().toISOString(),
          };
        }
        return stamp;
      });

      const newObtained = updatedStamps.filter((s) => s.obtained).length;
      const completionPct = Math.round((newObtained / collection.total_stamps) * 100);

      return {
        ...collection,
        stamps: updatedStamps,
        obtained_stamps: newObtained,
        completion_pct: completionPct,
        is_complete: newObtained >= collection.total_stamps,
      };
    });

    set({
      album: updatedAlbum,
      newlyRevealedStampIds: stampIds,
    });
  },

  setOpeningPack: (isOpeningPack) => set({ isOpeningPack }),

  clearNewlyRevealed: () => set({ newlyRevealedStampIds: [] }),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),

  resetPassport: () =>
    set({
      album: [],
      pointBalance: 0,
      isLoading: false,
      error: null,
      newlyRevealedStampIds: [],
      isOpeningPack: false,
    }),
}));