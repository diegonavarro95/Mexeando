/**
 * src/store/authStore.ts
 *
 * Estado global de autenticación (spec §06).
 *
 * Campos que debe tener según la especificación:
 *   accessToken, userId, userRole, displayName, preferredLang, pointBalance
 *
 * REGLAS:
 *  • accessToken  → SOLO en memoria (aquí). NUNCA en localStorage.
 *  • refreshToken → en localStorage bajo la llave 'refreshToken' (lo maneja api.ts / auth service).
 *  • Al iniciar la app: leer refreshToken de localStorage → llamar /auth/refresh
 *    → poblar este store (esto lo hace initAuth() llamado desde main.tsx).
 */

import { create } from 'zustand';
import i18n from '../i18n';
import { supabase } from '../lib/l-supabase';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type UserRole = 'tourist' | 'owner' | 'admin';

export type PreferredLang = 'es' | 'en' | 'fr' | 'pt' | 'de' | 'zh';

interface AuthState {
  // ── Datos de sesión ───────────────────────────────────────────────────────
  accessToken: string | null;
  userId: string | null;
  userRole: UserRole | null;

  // ── Datos del perfil (se rellenan tras login / refresh) ──────────────────
  displayName: string | null;
  preferredLang: PreferredLang;
  pointBalance: number;

  // ── Estado de inicialización ──────────────────────────────────────────────
  /** true mientras initAuth() espera la respuesta del servidor */
  isLoadingAuth: boolean;
  /** true una vez que initAuth() termina (exitoso o no) */
  isAuthReady: boolean;

  // ── Acciones ──────────────────────────────────────────────────────────────

  /**
   * Guarda el token y los metadatos básicos del usuario.
   * Llamar después de login exitoso o de un refresh exitoso.
   */
  setAuth: (
    accessToken: string,
    userId: string,
    role: string,
    displayName?: string,
    preferredLang?: string
  ) => void;

  /** Actualiza campos del perfil sin tocar el accessToken. */
  setProfile: (partial: Partial<Pick<AuthState, 'displayName' | 'preferredLang' | 'pointBalance'>>) => void;

  /** Sincroniza el idioma preferido entre store, localStorage e i18n. */
  setPreferredLang: (preferredLang: PreferredLang) => void;

  /** Actualiza el saldo de puntos (se llama tras check-in y apertura de sobres). */
  setPointBalance: (balance: number) => void;

  /**
   * Cierra sesión: limpia el store y el refreshToken del localStorage.
   * Redirige a /login.
   */
  clearAuth: () => void;
  resetAuthState: () => void;

  /** Marca que initAuth() terminó de ejecutarse. */
  setAuthReady: (ready: boolean) => void;
}

function syncPreferredLang(preferredLang: PreferredLang) {
  localStorage.setItem('preferredLang', preferredLang);
  if (i18n.language !== preferredLang) {
    void i18n.changeLanguage(preferredLang).catch((error) => {
      console.error('Language sync failed:', error);
    });
  }
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set) => ({
  // Estado inicial
  accessToken: null,
  userId: null,
  userRole: null,
  displayName: null,
  preferredLang: (localStorage.getItem('preferredLang') as PreferredLang) ?? 'es',
  pointBalance: 0,
  isLoadingAuth: true,
  isAuthReady: false,

  // ── Acciones ──────────────────────────────────────────────────────────────

  setAuth: (accessToken, userId, role, displayName, preferredLang) =>
    set((state) => {
      const nextPreferredLang = (preferredLang as PreferredLang) ?? state.preferredLang;
      syncPreferredLang(nextPreferredLang);

      return {
        accessToken,
        userId,
        userRole: role as UserRole,
        displayName: displayName ?? state.displayName,
        preferredLang: nextPreferredLang,
        isLoadingAuth: false,
        isAuthReady: true,
      };
    }),

  setProfile: (partial) =>
    set((state) => {
      if (partial.preferredLang) {
        syncPreferredLang(partial.preferredLang);
      }
      return { ...state, ...partial };
    }),

  setPreferredLang: (preferredLang) => {
    syncPreferredLang(preferredLang);
    set({ preferredLang });
  },

  setPointBalance: (balance) => set({ pointBalance: balance }),

  clearAuth: () => {
    localStorage.removeItem('refreshToken');
    void supabase.auth.signOut().catch((error) => {
      console.error('Supabase sign out failed:', error);
    });
    set({
      accessToken: null,
      userId: null,
      userRole: null,
      displayName: null,
      pointBalance: 0,
      isLoadingAuth: false,
      isAuthReady: true,
    });
    window.location.href = '/login';
  },

  resetAuthState: () =>
    set({
      accessToken: null,
      userId: null,
      userRole: null,
      displayName: null,
      pointBalance: 0,
      isLoadingAuth: false,
      isAuthReady: true,
    }),

  setAuthReady: (ready) =>
    set({ isAuthReady: ready, isLoadingAuth: !ready }),
}));
