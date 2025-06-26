import { AppStateData } from '../state/AppState';

export class HMRStateRepository {
  private dbName = 'ams-hmr-state';
  private version = 1;
  private storeName = 'dev-state';
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    try {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };

      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to initialize HMR state DB:', error);
    }
  }

  async save(state: AppStateData): Promise<void> {
    if (!this.db) {
      await this.initialize();
      if (!this.db) return;
    }

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      // Prepare state for storage - convert non-serializable objects
      const stateToStore = {
        id: 'current-state',
        timestamp: Date.now(),
        state: {
          ...state,
          // Don't store File objects
          currentFile: state.currentFile
            ? {
                name: state.currentFile.name,
                size: state.currentFile.size,
                type: state.currentFile.type,
                lastModified: state.currentFile.lastModified,
              }
            : null,
          // Convert Map to array for storage
          stats: state.stats
            ? {
                ...state.stats,
                layerColorMap: Array.from(state.stats.layerColorMap.entries()),
              }
            : null,
        },
      };

      const request = store.put(stateToStore);

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          console.log('✅ HMR state saved to IndexedDB');
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to save HMR state:', error);
    }
  }

  async load(): Promise<Partial<AppStateData> | null> {
    if (!this.db) {
      await this.initialize();
      if (!this.db) return null;
    }

    try {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get('current-state');

      const entry = await new Promise<any>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!entry) return null;

      // Convert stored data back to proper types
      const restoredState = entry.state;
      if (restoredState.stats && restoredState.stats.layerColorMap) {
        restoredState.stats.layerColorMap = new Map(restoredState.stats.layerColorMap);
      }

      // Always reset these fields
      restoredState.currentFile = null;
      restoredState.isLoading = false;
      restoredState.loadingMessage = '';
      restoredState.loadingProgress = 0;

      console.log('🔄 HMR state loaded from IndexedDB');
      return restoredState;
    } catch (error) {
      console.error('Failed to load HMR state:', error);
      return null;
    }
  }

  async clear(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          console.log('🗑️ HMR state cleared from IndexedDB');
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to clear HMR state:', error);
    }
  }
}

// Singleton instance
export const hmrStateRepository = new HMRStateRepository();
