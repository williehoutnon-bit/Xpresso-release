class MediaCacheDB {
  private dbPromise: Promise<any> | null = null;

  private getDB(): Promise<any> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }
      const request = indexedDB.open('exup-offline-media-cache-db', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('media-blobs')) {
          db.createObjectStore('media-blobs');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };
    });
    return this.dbPromise;
  }

  async get(messageId: string): Promise<Blob | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('media-blobs', 'readonly');
        const store = tx.objectStore('media-blobs');
        const req = store.get(messageId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      console.warn('MediaCacheDB.get failed:', e);
      return null;
    }
  }

  async set(messageId: string, blob: Blob | File): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve) => {
        const tx = db.transaction('media-blobs', 'readwrite');
        const store = tx.objectStore('media-blobs');
        const req = store.put(blob, messageId);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch (e) {
      console.warn('MediaCacheDB.set failed:', e);
    }
  }

  async delete(messageId: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve) => {
        const tx = db.transaction('media-blobs', 'readwrite');
        const store = tx.objectStore('media-blobs');
        const req = store.delete(messageId);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {}
  }
}

export const mediaCacheDB = new MediaCacheDB();
