// src/types/service-worker.d.ts
/*
* ─────────────── Interfaces declaradas ───────────────
*
* 1. SyncManager
* -------------
*   - register(tag: string): Promise<void>
*       Registra un trabajo de sincronización para ejecutarse cuando
*       haya conexión.
*
*   - getTags?(): Promise<string[]>
*       Método opcional que devuelve los tags de sincronización
*       pendientes. Útil para depuración o evitar duplicados.
*
* 2. ServiceWorkerRegistration (extendido)
* ----------------------------------------
*   - sync: SyncManager
*       Permite acceder al SyncManager directamente desde la
*       instancia de ServiceWorkerRegistration.
*
* ──────────────────────────────────────────────────────────────
* Notas:
* - Estas declaraciones son necesarias solo para TypeScript.
* - No agregan funcionalidad extra en tiempo de ejecución.
* - Asegúrate de que el navegador soporte Background Sync antes
*   de usarlo en producción.
* ──────────────────────────────────────────────────────────────
*/

interface SyncManager {
  register(tag: string): Promise<void>;
  getTags?(): Promise<string[]>;
}

interface ServiceWorkerRegistration {
  sync: SyncManager;
}