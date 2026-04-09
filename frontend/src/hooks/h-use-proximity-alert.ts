//frontend/src/hooks/h-use-proximity-alerts.ts

import { useEffect, useRef } from 'react';
import type { BusinessMapResult } from '../store/MapStore';

//Algoritmo de proximidad con Formual de Haversine
function distanceInMeters(lat1: number, lon1:number, lat2:number, lon2:number){
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface Props {
    userLat: number | null;
    userLng: number | null;
    businesses: BusinessMapResult[];
}

export function useProximityAlerts({ userLat, userLng, businesses }: Props){
    const notifiedIds = useRef<Set<string>>(new Set());
    const lastNotifiedAt = useRef(0);

    useEffect(() => {
        if (userLat === null || userLng === null) return;

        const interval = setInterval(() => {
            //Evitar que se ejecute en background
            //Lo comente para que suene la notificacion
            //if(document.visibilityState !== 'visible') return;

            const nearby = businesses.filter((b) => {
                if((b.indice_ola ?? 0) < 0.8) return false;
                if (notifiedIds.current.has(b.id)) return false;

                const dist = distanceInMeters(userLat, userLng, b.lat, b.lng)
                return dist <= 300;
            });

            if (nearby.length === 0) return;

            //Tiempo de espera de 5 min
            if(Date.now() - lastNotifiedAt.current < 5 * 60 * 1000) return;

            lastNotifiedAt.current = Date.now();
            nearby.forEach(b => notifiedIds.current.add(b.id));

            //Notificación local
            if('Notification' in window && Notification.permission === 'granted') {
                navigator.serviceWorker.ready.then((reg) => {
                    reg.showNotification('Lugares populares cerca', {
                        body: `Hay ${nearby.length} lugares con alta actividad cerca de ti`,
                        icon: '/icon.png',
                        data: { url: '/explore' },
                    });
                });
            }
            else{
                console.log('Lugares cercanos detectados:', nearby);
            }

        }, 60000);

        return () => clearInterval(interval);
    }, [userLat, userLng, businesses]);
}