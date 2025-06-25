import { ICacheRepository, CachedAnalysis, CacheMetadata } from './interfaces';
import { Result, GcodeStats, OptimizationResult, DebugLog, CacheError } from '../types';

export class CacheRepository implements ICacheRepository {
  private dbName = 'ams-gcode-cache';
  private version = 1;
  private storeName = 'parsed-results';
  private db: IDBDatabase | null = null;
  private cacheVersion = '1.0.0';
  private maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days

  async initialize(): Promise<Result<void>> {
    try {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('fileName', 'fileName', { unique: false });
        }
      };

      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      return Result.ok(undefined);
    } catch (error) {
      return Result.err(
        new CacheError(
          `Failed to initialize cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'initialize',
          error
        )
      );
    }
  }

  async get(key: string): Promise<Result<CachedAnalysis | null>> {
    if (!this.db) {
      return Result.err(new CacheError('Database not initialized', 'get'));
    }

    try {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      const entry = await new Promise<any>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!entry) {
        return Result.ok(null);
      }

      // Check if entry is expired
      if (Date.now() - entry.timestamp > this.maxAge) {
        await this.delete(key);
        return Result.ok(null);
      }

      // Check version compatibility
      if (entry.version !== this.cacheVersion) {
        await this.delete(key);
        return Result.ok(null);
      }

      // Convert stored data back to proper types
      const cachedAnalysis: CachedAnalysis = {
        ...entry,
        stats: {
          ...entry.stats,
          layerColorMap: new Map(entry.stats.layerColorMap),
        },
      };

      return Result.ok(cachedAnalysis);
    } catch (error) {
      return Result.err(
        new CacheError(
          `Failed to retrieve from cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'get',
          error
        )
      );
    }
  }

  async set(
    key: string,
    fileName: string,
    fileSize: number,
    stats: GcodeStats,
    optimization: OptimizationResult,
    logs: DebugLog[]
  ): Promise<Result<void>> {
    if (!this.db) {
      return Result.err(new CacheError('Database not initialized', 'set'));
    }

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      // Convert Map to array for storage
      const statsToStore = {
        ...stats,
        layerColorMap: Array.from(stats.layerColorMap.entries()),
      };

      const entry = {
        key,
        fileName,
        fileSize,
        stats: statsToStore,
        optimization,
        logs,
        timestamp: Date.now(),
        version: this.cacheVersion,
      };

      const request = store.put(entry);

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return Result.ok(undefined);
    } catch (error) {
      return Result.err(
        new CacheError(
          `Failed to store in cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'set',
          error
        )
      );
    }
  }

  async clear(): Promise<Result<void>> {
    if (!this.db) {
      return Result.err(new CacheError('Database not initialized', 'clear'));
    }

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return Result.ok(undefined);
    } catch (error) {
      return Result.err(
        new CacheError(
          `Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'clear',
          error
        )
      );
    }
  }

  async getMetadata(): Promise<Result<CacheMetadata>> {
    if (!this.db) {
      return Result.err(new CacheError('Database not initialized', 'getMetadata'));
    }

    try {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      const entries = await new Promise<any[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (entries.length === 0) {
        return Result.ok({
          totalEntries: 0,
          totalSize: 0,
          oldestEntry: Date.now(),
          newestEntry: Date.now(),
        });
      }

      const metadata: CacheMetadata = {
        totalEntries: entries.length,
        totalSize: entries.reduce((sum, entry) => sum + (entry.fileSize || 0), 0),
        oldestEntry: Math.min(...entries.map((e) => e.timestamp)),
        newestEntry: Math.max(...entries.map((e) => e.timestamp)),
      };

      return Result.ok(metadata);
    } catch (error) {
      return Result.err(
        new CacheError(
          `Failed to get cache metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'getMetadata',
          error
        )
      );
    }
  }

  private async delete(key: string): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const request = store.delete(key);

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
