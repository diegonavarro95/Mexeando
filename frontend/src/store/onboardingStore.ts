/**
 * src/store/onboardingStore.ts
 *
 * Estado global para el flujo "Wizard" de registro de negocio (D-1 y D-2).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '../services/api';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface GeminiData {
  nombre: string;
  descripcion: string;
  categoria: 'food' | 'crafts' | 'tourism' | 'entertainment' | 'wellness' | 'retail';
  horario?: Record<string, string[]>;
  especialidades: { nombre: string; precio: number | null }[];
}

export interface SensitiveData {
  address: string;
  city: 'cdmx' | 'guadalajara' | 'monterrey';
  lat: number;
  lng: number;
  phone?: string;
  accepts_card: boolean;
  folio?: number;
}

interface OnboardingState {
  geminiData: GeminiData | null;
  sensitiveData: SensitiveData | null;
  isLoading: boolean;
  error: string | null;
  setGeminiData: (data: GeminiData) => void;
  setSensitiveData: (data: SensitiveData) => void;
  submitBusiness: () => Promise<string>;
  resetOnboarding: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<GeminiData['categoria'], number> = {
  food: 1,
  crafts: 2,
  tourism: 3,
  entertainment: 4,
  wellness: 5,
  retail: 6,
};

function normalizeSchedule(
  horario?: Record<string, string[] | null>
): Record<string, [string, string] | null> | undefined {
  if (!horario) return undefined;
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const result: Record<string, [string, string] | null> = {};
  for (const day of days) {
    const val = horario[day];
    result[day] = Array.isArray(val) && val.length === 2 ? [val[0], val[1]] : null;
  }
  return result;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      geminiData: null,
      sensitiveData: null,
      isLoading: false,
      error: null,

      setGeminiData: (data) => set({ geminiData: data, error: null }),
      setSensitiveData: (data) => set({ sensitiveData: data, error: null }),

      submitBusiness: async () => {
        // 🚨 Leemos el estado ACTUALIZADO del store
        const { geminiData, sensitiveData } = get();

        if (!geminiData) {
          throw new Error('Faltan los datos del Asistente IA.');
        }
        if (!sensitiveData) {
          throw new Error('Faltan los datos de ubicación y contacto.');
        }

        set({ isLoading: true, error: null });

        try {
          const payloadNegocio = {
            name:         geminiData.nombre,
            category_id:  CATEGORY_MAP[geminiData.categoria] || 1, // Fallback por si acaso
            description:  geminiData.descripcion,
            lat:          sensitiveData.lat,
            lng:          sensitiveData.lng,
            address:      sensitiveData.address,
            city:         sensitiveData.city,
            phone:        sensitiveData.phone,
            accepts_card: sensitiveData.accepts_card,
            folio:        sensitiveData.folio,
            schedule:     normalizeSchedule(geminiData.horario),
          };

          const resNegocio = await api.post<{ data: { id: string } }>('/api/v1/businesses', payloadNegocio);
          const newBusinessId = resNegocio.data.data.id;

          // Crear especialidades (menú inicial) si existen
          if (geminiData.especialidades && geminiData.especialidades.length > 0) {
            await Promise.all(
              geminiData.especialidades.map((platillo) =>
                api.post(`/api/v1/businesses/${newBusinessId}/menu`, {
                  name:         platillo.nombre, 
                  price:        platillo.precio || 0, 
                  is_available: true,
                })
              )
            );
          }

          // Éxito: Limpiamos el store
          set({ isLoading: false });
        return newBusinessId;     

        } catch (err: any) {
          const errMsg = err.response?.data?.error || err.message || 'Error al crear el negocio';
          set({ isLoading: false, error: errMsg });
          throw new Error(errMsg);
        }
      },

      resetOnboarding: () => set({
        geminiData:    null,
        sensitiveData: null,
        error:         null,
        isLoading:     false,
      }),
    }),
    {
      name:    'onboarding-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        geminiData:    state.geminiData,
        sensitiveData: state.sensitiveData,
      }),
    }
  )
);
