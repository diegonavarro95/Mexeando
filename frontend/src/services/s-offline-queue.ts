// src/services/s-offline-queue.ts
import { openDB } from 'idb';

export type OfflineActionType =
  | 'checkin'
  | 'review-create'
  | 'review-like';
  
export interface OfflineAction {
    id?: number;
    type: OfflineActionType;
    payload: any;
    createdAt: number;
    retries?: number;
}

const DB_NAME = 'offline_actions';
const STORE_NAME = 'queue';

export async function getDB(){
    return openDB(DB_NAME, 1, {
        upgrade(db){
            if(!db.objectStoreNames.contains(STORE_NAME)){
                db.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                    autoIncrement: true
                });
            }
        }
    });
}

export async function enqueueAction(action: OfflineAction) {
    const db = await getDB();

    //Evitar acciones duplicadas de likes
    if (action.type === 'review-like') {
        const existing = await db.getAll(STORE_NAME);

        const duplicate = existing.find(
        (a) =>
            a.type === 'review-like' &&
            a.payload.reviewId === action.payload.reviewId
        );

        if (duplicate?.id) {
            // reemplazar (toggle más reciente)
            action.id = duplicate.id;
        }
    }

    await db.put(STORE_NAME, action);
}

export async function getAllActions(): Promise<OfflineAction[]> {
    const db = await getDB();
    const actions = await db.getAll(STORE_NAME);
    
    return actions.sort((a,b) => a.createdAt - b.createdAt);
}

export async function removeAction(id: number) {
    const db = await getDB()
    await db.delete(STORE_NAME, id);
}

export async function clearAllActions() {
    const db = await getDB();
    await db.clear(STORE_NAME);
}

export async function updateAction(action: OfflineAction) {
    const db = await getDB();
    await db.put(STORE_NAME, action);
}