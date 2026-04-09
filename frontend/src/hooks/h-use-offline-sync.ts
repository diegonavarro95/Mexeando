// src/hooks/h-use-offline-sync.ts

import { enqueueAction, type OfflineActionType } from "../services/s-offline-queue";
import { api } from '../services/api'; // 🔥 Importamos tu instancia de Axios

type EndpointConfig = {
  url: string;
  method: string;
  body?: any;
};

const endpointMap: Record<
  OfflineActionType,
  (payload: any) => EndpointConfig
> = {
  checkin: () => ({
    url: '/api/v1/checkins',
    method: 'POST',
  }),

  'review-create': (payload) => ({
    url: `/api/v1/businesses/${payload.businessId}/reviews`,
    method: 'POST',
    body: {
      rating: payload.rating,
      body: payload.body,
      image_path: payload.image_path,
      language: payload.language,
    },
  }),

  'review-like': (payload) => ({
    url: `/api/v1/reviews/${payload.reviewId}/like`,
    method: 'POST',
  }),
};

export async function syncAction(
  type: OfflineActionType,
  payload: any
) {
  const config = endpointMap[type](payload)
  
  // Intento en modo online primero
  if (navigator.onLine) {
    try {
      // 🔥 Usamos 'api' (Axios) para que inyecte el JWT en los headers automáticamente
      await api.request({
        url: config.url,
        method: config.method,
        data: config.body, // En Axios, el body de la petición se pasa en 'data'
      })

      // Realizado con éxito, no requiere encolado
      return;

    } catch (err: any) {
      // Manejo de errores específicos de la respuesta de Axios
      const status = err.response?.status;
      
      if (status === 409) return; // Duplicado OK (ya lo había enviado antes)
      if (status === 403 && type !== 'review-create') return;

      // Fallback online: el server falló (ej. 500), así que encolamos
      console.log('Fallo online (Server Error), encolando para reintentar...', err);
    }
  }

  // En caso de que no se esté online o el servidor falle, se encola localmente (IndexedDB)
  await enqueueAction({
    type,
    payload,
    createdAt: Date.now(),
  });

  // Registro background sync (Service Worker)
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const sw = await navigator.serviceWorker.ready;
      await sw.sync.register('sync-offline-actions');
    } catch (err) {
      console.warn('No se pudo registrar sync', err)
    }
  }
}