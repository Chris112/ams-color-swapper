import { GcodeStats } from '../types/gcode';
import { OptimizationResult } from '../types/optimization';
import { DebugLog } from '../types/logging';
import { CacheMetadata, CachedAnalysis } from '../types/cache';

// Extend CachedAnalysis for internal use with version
interface CacheEntry extends CachedAnalysis {
  logs: DebugLog[]; // Make logs required internally
  version: string; // Cache format version for future compatibility
}

export class GcodeCache {
  private static readonly DB_NAME = 'ams-gcode-cache';
  private static readonly DB_VERSION = 1;
  private static readonly STORE_NAME = 'parsed-results';
  private static readonly CACHE_VERSION = '1.0.0';
  private static readonly EXPIRY_DAYS = 90; // 3 months - generous since data is small

  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(GcodeCache.DB_NAME, GcodeCache.DB_VERSION);

      request.onerror = () => reject(new Error('Failed to open IndexedDB'));

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(GcodeCache.STORE_NAME)) {
          const store = db.createObjectStore(GcodeCache.STORE_NAME, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('fileName', 'fileName', { unique: false });
        }
      };
    });
  }

  async get(key: string): Promise<CacheEntry | null> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([GcodeCache.STORE_NAME], 'readonly');
      const store = transaction.objectStore(GcodeCache.STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;

        if (!entry) {
          resolve(null);
          return;
        }

        // Check if entry is expired
        const expiryTime = entry.timestamp + GcodeCache.EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        if (Date.now() > expiryTime) {
          // Remove expired entry
          this.delete(key).catch(console.error);
          resolve(null);
          return;
        }

        // Reconstruct Maps from stored data
        if (entry.stats.layerColorMap) {
          entry.stats.layerColorMap = new Map(
            Object.entries(entry.stats.layerColorMap).map(([k, v]) => [Number(k), v])
          );
        }

        resolve(entry);
      };

      request.onerror = () => reject(new Error('Failed to get cache entry'));
    });
  }

  async set(
    key: string,
    fileName: string,
    fileSize: number,
    stats: GcodeStats,
    optimization: OptimizationResult,
    logs: DebugLog[]
  ): Promise<void> {
    if (!this.db) await this.initialize();

    // Convert Maps to plain objects for storage
    const statsToStore: GcodeStats = {
      ...stats,
      layerColorMap: Object.fromEntries(stats.layerColorMap || new Map()) as unknown as Map<
        number,
        string[]
      >,
    };

    const entry: CacheEntry = {
      key,
      fileName,
      fileSize,
      stats: statsToStore,
      optimization,
      logs,
      timestamp: Date.now(),
      version: GcodeCache.CACHE_VERSION,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([GcodeCache.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(GcodeCache.STORE_NAME);
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to cache entry'));
    });
  }

  async delete(key: string): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([GcodeCache.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(GcodeCache.STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete cache entry'));
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([GcodeCache.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(GcodeCache.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear cache'));
    });
  }

  async getMetadata(): Promise<CacheMetadata> {
    if (!this.db) await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([GcodeCache.STORE_NAME], 'readonly');
      const store = transaction.objectStore(GcodeCache.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result as CacheEntry[];

        if (entries.length === 0) {
          resolve({
            totalEntries: 0,
            totalSize: 0,
            oldestEntry: 0,
            newestEntry: 0,
          });
          return;
        }

        // Estimate size (rough approximation)
        const totalSize = entries.reduce((sum, entry) => {
          return sum + JSON.stringify(entry).length;
        }, 0);

        const timestamps = entries.map((e) => e.timestamp);

        resolve({
          totalEntries: entries.length,
          totalSize,
          oldestEntry: Math.min(...timestamps),
          newestEntry: Math.max(...timestamps),
        });
      };

      request.onerror = () => reject(new Error('Failed to get metadata'));
    });
  }

  async cleanupExpired(): Promise<number> {
    if (!this.db) await this.initialize();

    const expiryThreshold = Date.now() - GcodeCache.EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([GcodeCache.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(GcodeCache.STORE_NAME);
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(expiryThreshold);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(new Error('Failed to cleanup expired entries'));
    });
  }

  async cleanupOldAlgorithmVersions(): Promise<number> {
    if (!this.db) await this.initialize();

    // Get current algorithm version to compare against
    const currentVersion = await this.getCurrentAlgorithmVersion();
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([GcodeCache.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(GcodeCache.STORE_NAME);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const entry = cursor.value as CacheEntry;
          // Check if the cache key doesn't match current algorithm version
          // Cache keys now include algorithm version, so entries with different versions won't match
          if (!entry.key.includes(currentVersion)) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(new Error('Failed to cleanup old algorithm versions'));
    });
  }

  private async getCurrentAlgorithmVersion(): Promise<string> {
    // This should match the version generation in hash.ts
    const ALGORITHM_VERSION = '2.0.0';
    const gitCommitHash = import.meta.env.VITE_GIT_COMMIT_HASH || Date.now().toString(36);
    return `${ALGORITHM_VERSION}-${gitCommitHash}`;
  }
}

// Export singleton instance
export const gcodeCache = new GcodeCache();
