// src/services/s-worker.ts
import { getAllActions, removeAction, updateAction } from './s-offline-queue';

type EndpointConfig = {
    url: string;
    method: string;
    body?: any;
};

const endpointMap: Record<
    string,
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

self.addEventListener('sync', (event: any) => {
    if(event.tag === 'sync-offline-actions'){
        event.waitUntil(syncOfflineActions());
    }
})

async function syncOfflineActions() {
    const actions = await getAllActions();

    for(const action of actions){
        try{
            const config = endpointMap[action.type](action.payload);

            const res = await fetch(config.url, {
                method: config.method,
                headers: { 'Content-Type': 'application/json' },
                body: config.body ? JSON.stringify(config.body) : undefined,
            });

            if(!res.ok) {
                if (res.status === 409) {
                    // Peticion existente, se puede eliminar
                    if (action.id) await removeAction(action.id);
                    continue;
                }

                if (res.status === 403) {
                    if (action.type === 'review-create') {
                        // Depende de checkin, se reintenta despues
                        continue;
                    }

                    // Hay 403 que se deben de eliminar
                    if (action.id) await removeAction(action.id);
                    continue;
                }
                throw new Error('Error servidor');
            }

            //Eliminación en caso de haber sido exitoso
            if (action.id) await removeAction(action.id);
        }
        catch (err){
            console.log('No se pudo sincronizar', action, err);

            //Reintento controlado
            action.retries = (action.retries || 0) + 1;

            //Limite de 5 intentos
            if (action.retries > 5) {
                console.warn('Demasiados reintentos, descartando', action);
                await removeAction(action.id!);
            }
            else{
                await updateAction(action);
            }
        }
    }
}