// src/lib/db.ts
const DB_NAME = 'OlaMX_Offline';
const STORE_NAME = 'businesses';

export async function saveBusinessesToIDB(businesses: any[]) {
  const request = indexedDB.open(DB_NAME, 1);

  request.onupgradeneeded = (event: any) => {
    const db = event.target.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  };

  request.onsuccess = (event: any) => {
    const db = event.target.result;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Solo guardamos los primeros 50 (REQ 7.1)
    businesses.slice(0, 50).forEach(b => store.put(b));
  };
}

export async function getCachedBusinesses(): Promise<any[]> {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = (event: any) => {
      const db = event.target.result;
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getAll = store.getAll();
      getAll.onsuccess = () => resolve(getAll.result);
    };
    request.onerror = () => resolve([]);
  });
}