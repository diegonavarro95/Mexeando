/**
 * src/services/initAuth.ts
 * Versión Corregida: Soporte OAuth Google + Sync de Ready State
 */

import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { usePassportStore } from '../store/passportStore';
import { supabase } from '../lib/l-supabase';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const AUTH_REQUEST_TIMEOUT = 6000;

function hasOAuthArtifacts(): boolean {
  return (
    window.location.search.includes('code=') ||
    window.location.search.includes('state=') ||
    window.location.hash.includes('access_token') ||
    window.location.hash.includes('refresh_token')
  );
}

function cleanupOAuthArtifacts(): void {
  const url = new URL(window.location.href);
  const hasOAuthCode = url.searchParams.has('code') || url.searchParams.has('state');
  const hasOAuthHash = window.location.hash.includes('access_token') || window.location.hash.includes('refresh_token');

  if (!hasOAuthCode && !hasOAuthHash) {
    return;
  }

  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('scope');
  url.searchParams.delete('authuser');
  url.searchParams.delete('prompt');
  url.hash = '';
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

async function exchangeOAuthSessionForAppRefreshToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const supabaseAccessToken = data.session?.access_token;
  if (!supabaseAccessToken) {
    return null;
  }

  const response = await axios.post<{
    data: {
      accessToken: string;
      refreshToken: string;
      userId: string;
      role: string;
      is_new_user: boolean;
    };
  }>(`${BASE_URL}/api/v1/auth/oauth/callback`, {
    supabase_access_token: supabaseAccessToken,
  }, {
    timeout: AUTH_REQUEST_TIMEOUT,
  });

  const backendRefreshToken = response.data.data.refreshToken;
  localStorage.setItem('refreshToken', backendRefreshToken);
  cleanupOAuthArtifacts();
  return backendRefreshToken;
}

export async function initAuth(): Promise<void> {
  const { setAuth, setAuthReady, resetAuthState } = useAuthStore.getState();

  // 1. CAPTURAR TOKENS DE LA URL (Para Google OAuth)
  // Si venimos de Google, el backend nos manda los tokens por query params
  const urlParams = new URLSearchParams(window.location.search);
  const urlAccess = urlParams.get('accessToken');
  const urlRefresh = urlParams.get('refreshToken');

  if (urlAccess && urlRefresh) {
    // Si Google nos mandó tokens, los guardamos de una vez
    localStorage.setItem('refreshToken', urlRefresh);
    // Limpiamos la URL para que no se vea feo y no se re-procese al recargar
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  let refreshToken = localStorage.getItem('refreshToken');

  if (!refreshToken && hasOAuthArtifacts()) {
    try {
      refreshToken = await exchangeOAuthSessionForAppRefreshToken();
    } catch (error) {
      console.error('OAuth exchange failed:', error);
      await supabase.auth.signOut();
    }
  }

  if (!refreshToken) {
    setAuthReady(true); // 👈 IMPORTANTE: Avisar que terminamos aunque no haya sesión
    return;
  }

  try {
    const { data } = await axios.post<{
      data: {
        accessToken: string;
        refreshToken: string;
        userId: string;
        role: string;
        displayName?: string;
        preferredLang?: string;
        pointBalance?: number;
      };
    }>(`${BASE_URL}/api/v1/auth/refresh`, { refreshToken }, { timeout: AUTH_REQUEST_TIMEOUT });

    const {
      accessToken,
      refreshToken: newRefresh,
      userId,
      role,
      displayName,
      preferredLang,
      pointBalance,
    } = data.data;

    localStorage.setItem('refreshToken', newRefresh);
    setAuth(accessToken, userId, role, displayName, preferredLang);

    if (typeof pointBalance === 'number') {
      useAuthStore.getState().setPointBalance(pointBalance);
      usePassportStore.getState().setPointBalance(pointBalance);
    }
  } catch (error) {
    console.error('Auth initialization failed:', error);
    localStorage.removeItem('refreshToken');
    await supabase.auth.signOut().catch((signOutError) => {
      console.error('Supabase cleanup failed:', signOutError);
    });
    resetAuthState();
  } finally {
    // 2. EL FIX MAESTRO: Siempre marcar como ready al final del proceso
    setAuthReady(true); 
  }
}
