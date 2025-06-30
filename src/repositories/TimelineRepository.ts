import { Result } from '../types/result';
import { CacheError } from '../types/errors';
import { MergeTimelineState } from '../services/MergeHistoryManager';
import LZString from 'lz-string';

export interface TimelineMetadata {
  id: string;
  createdAt: number;
  updatedAt: number;
  snapshotCount: number;
  currentBranch: string;
  branches: string[];
  compressed: boolean;
  sizeBytes: number;
}

export interface CompressedTimeline {
  metadata: TimelineMetadata;
  data: string; // Compressed timeline data
  currentIndex: number;
}

export class TimelineRepository {
  private dbName = 'ams-timeline-db';
  private version = 1;
  private storeName = 'timelines';
  private metadataStore = 'timeline-metadata';
  private db: IDBDatabase | null = null;
  private maxTimelineAge = 30 * 24 * 60 * 60 * 1000; // 30 days

  async initialize(): Promise<Result<void>> {
    try {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('updatedAt', 'metadata.updatedAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(this.metadataStore)) {
          db.createObjectStore(this.metadataStore, { keyPath: 'key' });
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
          `Failed to initialize timeline database: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'initialize',
          error
        )
      );
    }
  }

  async saveTimeline(
    id: string,
    state: MergeTimelineState,
    currentIndex: number
  ): Promise<Result<void>> {
    if (!this.db) {
      return Result.err(new CacheError('Database not initialized', 'saveTimeline'));
    }

    try {
      // Optimize the timeline data before compression
      const optimizedState = this.optimizeTimelineData(state);

      // Compress the timeline data
      const compressedData = LZString.compressToUTF16(JSON.stringify(optimizedState));

      const metadata: TimelineMetadata = {
        id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        snapshotCount: state.snapshots.length,
        currentBranch: state.currentBranch,
        branches: Array.from(state.branches.keys()),
        compressed: true,
        sizeBytes: compressedData.length * 2, // UTF-16 characters are 2 bytes each
      };

      const compressedTimeline: CompressedTimeline = {
        metadata,
        data: compressedData,
        currentIndex,
      };

      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put({ id, ...compressedTimeline });

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Update storage metrics
      await this.updateStorageMetrics();

      return Result.ok(undefined);
    } catch (error) {
      return Result.err(
        new CacheError(
          `Failed to save timeline: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'saveTimeline',
          error
        )
      );
    }
  }

  async loadTimeline(
    id: string
  ): Promise<Result<{ state: MergeTimelineState; currentIndex: number } | null>> {
    if (!this.db) {
      return Result.err(new CacheError('Database not initialized', 'loadTimeline'));
    }

    try {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      const entry = await new Promise<any>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!entry) {
        return Result.ok(null);
      }

      // Check if timeline is expired
      if (Date.now() - entry.metadata.updatedAt > this.maxTimelineAge) {
        await this.deleteTimeline(id);
        return Result.ok(null);
      }

      // Decompress the timeline data
      const decompressedData = LZString.decompressFromUTF16(entry.data);
      if (!decompressedData) {
        return Result.err(new CacheError('Failed to decompress timeline data', 'loadTimeline'));
      }

      const state = JSON.parse(decompressedData);

      // Restore the full timeline data
      const restoredState = this.restoreTimelineData(state);

      return Result.ok({
        state: restoredState,
        currentIndex: entry.currentIndex,
      });
    } catch (error) {
      return Result.err(
        new CacheError(
          `Failed to load timeline: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'loadTimeline',
          error
        )
      );
    }
  }

  async deleteTimeline(id: string): Promise<Result<void>> {
    if (!this.db) {
      return Result.err(new CacheError('Database not initialized', 'deleteTimeline'));
    }

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      await this.updateStorageMetrics();

      return Result.ok(undefined);
    } catch (error) {
      return Result.err(
        new CacheError(
          `Failed to delete timeline: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'deleteTimeline',
          error
        )
      );
    }
  }

  async clearAllTimelines(): Promise<Result<void>> {
    if (!this.db) {
      return Result.err(new CacheError('Database not initialized', 'clearAllTimelines'));
    }

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      await this.updateStorageMetrics();

      return Result.ok(undefined);
    } catch (error) {
      return Result.err(
        new CacheError(
          `Failed to clear timelines: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'clearAllTimelines',
          error
        )
      );
    }
  }

  async getStorageMetrics(): Promise<
    Result<{ totalSize: number; timelineCount: number; oldestTimeline: number }>
  > {
    if (!this.db) {
      return Result.err(new CacheError('Database not initialized', 'getStorageMetrics'));
    }

    try {
      const transaction = this.db.transaction([this.metadataStore], 'readonly');
      const store = transaction.objectStore(this.metadataStore);
      const request = store.get('storage-metrics');

      const metrics = await new Promise<any>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!metrics) {
        return Result.ok({ totalSize: 0, timelineCount: 0, oldestTimeline: Date.now() });
      }

      return Result.ok(metrics.value);
    } catch (error) {
      return Result.err(
        new CacheError(
          `Failed to get storage metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'getStorageMetrics',
          error
        )
      );
    }
  }

  private async updateStorageMetrics(): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      const timelines = await new Promise<any[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const totalSize = timelines.reduce((sum, t) => sum + (t.metadata?.sizeBytes || 0), 0);
      const oldestTimeline =
        timelines.length > 0
          ? Math.min(...timelines.map((t) => t.metadata?.createdAt || Date.now()))
          : Date.now();

      const metricsTx = this.db.transaction([this.metadataStore], 'readwrite');
      const metricsStore = metricsTx.objectStore(this.metadataStore);

      await new Promise<void>((resolve, reject) => {
        const req = metricsStore.put({
          key: 'storage-metrics',
          value: {
            totalSize,
            timelineCount: timelines.length,
            oldestTimeline,
          },
        });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (error) {
      console.error('Failed to update storage metrics:', error);
    }
  }

  private optimizeTimelineData(state: MergeTimelineState): any {
    // Remove large, unnecessary data from snapshots
    const optimizedSnapshots = state.snapshots.map((snapshot) => ({
      ...snapshot,
      stats: {
        ...snapshot.stats,
        // Remove large data that can be reconstructed
        rawContent: undefined,
        layerDetails: undefined,
        // Convert Map to array for better compression (handle both Map and Array)
        layerColorMap:
          snapshot.stats.layerColorMap instanceof Map
            ? Array.from(snapshot.stats.layerColorMap.entries())
            : snapshot.stats.layerColorMap,
      },
      optimization: {
        ...snapshot.optimization,
        // Keep only essential optimization data
        slotAssignments: snapshot.optimization.slotAssignments,
        manualSwaps: snapshot.optimization.manualSwaps.map((swap) => ({
          ...swap,
          // Simplify swap data
          timingOptions: undefined,
          swapWindow: undefined,
          confidence: undefined,
        })),
      },
    }));

    return {
      ...state,
      snapshots: optimizedSnapshots,
      // Convert Map to array for branches
      branches: Array.from(state.branches.entries()),
    };
  }

  private restoreTimelineData(data: any): MergeTimelineState {
    // Restore the full data structure from optimized format
    const restoredSnapshots = data.snapshots.map((snapshot: any) => ({
      ...snapshot,
      stats: {
        ...snapshot.stats,
        // Restore Map from array
        layerColorMap: new Map(snapshot.stats.layerColorMap),
      },
    }));

    return {
      ...data,
      snapshots: restoredSnapshots,
      // Restore Map from array
      branches: new Map(data.branches),
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
