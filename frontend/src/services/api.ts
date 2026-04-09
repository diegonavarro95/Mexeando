/**
 * src/services/api.ts
 *
 * Instancia central de Axios con:
 *  - baseURL configurable por variable de entorno
 *  - Interceptor de REQUEST  → inyecta el accessToken de Zustand
 *  - Interceptor de RESPONSE → maneja 401, refresca el token y
 *    reintenta la petición original UNA sola vez
 *
 * REGLAS (spec §00, §07):
 *  • accessToken  → memoria (Zustand authStore), NUNCA localStorage
 *  • refreshToken → localStorage bajo la llave 'refreshToken'
 *  • Si el refresh falla → clearAuth() + redirect /login con mensaje
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '../store/authStore';

// ─── Constantes ──────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// ─── Instancia principal ──────────────────────────────────────────────────────

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
});

// ─── Tipos internos ───────────────────────────────────────────────────────────

/** Extendemos InternalAxiosRequestConfig para marcar el reintento */
interface RetryableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// ─── Interceptor: REQUEST ─────────────────────────────────────────────────────

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Interceptor: RESPONSE ───────────────────────────────────────────────────

api.interceptors.response.use(
  // Respuestas 2xx pasan directo
  (response) => response,

  // Errores: capturamos el 401 para intentar el refresh
  async (error) => {
    const originalRequest = error.config as RetryableRequest;

    const is401 = error.response?.status === 401;
    const alreadyRetried = originalRequest._retry === true;

    if (is401 && !alreadyRetried) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');

      // Sin refresh token → sesión muerta, redirigir
      if (!refreshToken) {
        _handleSessionExpired();
        return Promise.reject(error);
      }

      try {
        // Usamos axios puro (NO la instancia `api`) para evitar bucle del interceptor
        const { data } = await axios.post<{
          data: {
            accessToken: string;
            refreshToken: string;
            userId: string;
            role: string;
          };
        }>(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken });

        const {
          accessToken: newAccess,
          refreshToken: newRefresh,
          userId,
          role,
        } = data.data;

        // Persiste el nuevo refresh token
        localStorage.setItem('refreshToken', newRefresh);

        // Actualiza el store con el nuevo access token
        useAuthStore.getState().setAuth(newAccess, userId, role);

        // Reintentar la petición original con el token nuevo
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest as AxiosRequestConfig);

      } catch (refreshError) {
        // Refresh token expirado (7 días) o inválido → logout forzado
        console.error('[api] Refresh token inválido. Cerrando sesión.');
        _handleSessionExpired();
        return Promise.reject(refreshError);
      }
    }

    // Cualquier otro error (400, 403, 404, 500…) pasa al componente
    return Promise.reject(error);
  }
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Limpia el estado y redirige al login con mensaje de sesión expirada */
function _handleSessionExpired(): void {
  useAuthStore.getState().clearAuth();
  // clearAuth() ya llama window.location.href = '/login'
  // pero añadimos el query param para que LoginPage muestre el toast
  const url = new URL('/login', window.location.origin);
  url.searchParams.set('expired', '1');
  window.location.replace(url.toString());
}