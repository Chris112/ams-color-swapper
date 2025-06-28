/**
 * Non-blocking FilamentDatabase service with progressive enhancement
 * Provides immediate responses while syncing data in the background
 */

import { FilamentDatabaseStorage, StoredFilament, SyncStatus } from './FilamentDatabaseStorage';
import { getColorName } from '../utils/colorNames';
import { FilamentSyncController } from './FilamentSyncController';

export interface FilamentMatch {
  filament: StoredFilament;
  confidence: 'exact' | 'close' | 'approximate';
  deltaE: number;
  source: 'indexeddb' | 'fallback';
}

export interface SyncProgress {
  isActive: boolean;
  progress: number; // 0-100
  totalPages: number;
  syncedPages: number;
  totalFilaments: number;
  error?: string;
}

export interface DatabaseStats {
  totalFilaments: number;
  totalGroups: number;
  manufacturers: string[];
  lastSync?: Date;
  isAvailable: boolean;
  estimatedSizeBytes: number;
}

export class FilamentDatabase {
  private static instance: FilamentDatabase;
  private storage: FilamentDatabaseStorage;
  private worker: Worker | null = null;
  private isStorageReady = false;
  private isWorkerReady = false;
  private pendingSyncRequest: { force: boolean } | null = null;
  private syncCallbacks = new Set<(progress: SyncProgress) => void>();
  private syncController: FilamentSyncController;

  public static getInstance(): FilamentDatabase {
    if (!FilamentDatabase.instance) {
      FilamentDatabase.instance = new FilamentDatabase();
    }
    return FilamentDatabase.instance;
  }

  private constructor() {
    this.storage = new FilamentDatabaseStorage();
    this.syncController = FilamentSyncController.getInstance();
    this.initializeStorage();
    this.initializeWorker();
  }

  private async initializeStorage(): Promise<void> {
    try {
      await this.storage.initialize();
      this.isStorageReady = true;
      console.log('FilamentDatabase storage initialized');
    } catch (error) {
      console.error('Failed to initialize FilamentDatabase storage:', error);
    }
  }

  private initializeWorker(): void {
    try {
      this.worker = new Worker(new URL('../workers/filamentDatabase.worker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (event) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('FilamentDatabase worker error:', error);
      };

      console.log('FilamentDatabase worker initialized');
    } catch (error) {
      console.error('Failed to initialize FilamentDatabase worker:', error);
    }
  }

  private handleWorkerMessage(message: any): void {
    console.log('[FilamentDB] Received worker message:', message.type, message.payload);

    switch (message.type) {
      case 'WORKER_READY':
        console.log('[FilamentDB] Worker is ready');
        this.isWorkerReady = true;
        this.processPendingSyncRequest();
        break;

      case 'SYNC_PROGRESS':
        console.log('[FilamentDB] Sync progress update:', message.payload);
        // Update sync controller progress
        this.syncController.updateProgress(
          message.payload.syncedPages || 0,
          message.payload.totalPages || 0
        );
        // Also notify legacy listeners
        this.notifySyncProgress({
          isActive: true,
          progress: message.payload.progress || 0,
          totalPages: message.payload.totalPages || 0,
          syncedPages: message.payload.syncedPages || 0,
          totalFilaments: message.payload.totalFilaments || 0,
        });
        break;

      case 'SYNC_COMPLETE':
        console.log('[FilamentDB] Sync completed:', message.payload);
        // Update sync controller
        const isCancelled = message.payload.cancelled || false;

        // If sync was cancelled, clear the partial data
        if (isCancelled) {
          console.log('[FilamentDB] Sync was cancelled, clearing partial data');
          // Clear the database to avoid showing misleading "ready" status
          this.clearCache();
        }

        this.syncController.handleSyncComplete(!isCancelled, message.payload.message);
        // Also notify legacy listeners
        this.notifySyncProgress({
          isActive: false,
          progress: isCancelled ? 0 : 100,
          totalPages: message.payload.totalPages || 0,
          syncedPages: message.payload.totalPages || 0,
          totalFilaments: message.payload.totalFilaments || 0,
        });
        break;

      case 'SYNC_ERROR':
        console.error('[FilamentDB] Sync error received:', message.payload);
        // Update sync controller
        this.syncController.handleSyncComplete(false, message.payload.error);
        // Also notify legacy listeners
        this.notifySyncProgress({
          isActive: false,
          progress: 0,
          totalPages: 0,
          syncedPages: 0,
          totalFilaments: 0,
          error: message.payload.error,
        });
        break;

      case 'DATA_CLEARED':
        console.log('[FilamentDB] Data cleared:', message.payload);
        // Reset storage ready state since data was cleared
        this.isStorageReady = false;
        // Re-initialize storage
        this.initializeStorage();
        // Notify listeners that cache was cleared
        this.notifySyncProgress({
          isActive: false,
          progress: 0,
          totalPages: 0,
          syncedPages: 0,
          totalFilaments: 0,
          error: undefined,
        });
        break;

      default:
        console.warn('[FilamentDB] Unknown worker message type:', message.type);
    }
  }

  private notifySyncProgress(progress: SyncProgress): void {
    this.syncCallbacks.forEach((callback) => {
      try {
        callback(progress);
      } catch (error) {
        console.error('Error in sync progress callback:', error);
      }
    });
  }

  private processPendingSyncRequest(): void {
    if (this.pendingSyncRequest && this.isWorkerReady) {
      console.log('[FilamentDB] Processing pending sync request:', this.pendingSyncRequest);
      this.startSyncInternal(this.pendingSyncRequest.force);
      this.pendingSyncRequest = null;
    }
  }

  /**
   * Get enhanced color name with progressive enhancement
   * Returns immediately with best available information
   */
  public async getEnhancedColorName(hexColor: string, fallbackName?: string): Promise<string> {
    // Always return immediately - never block
    if (!this.isStorageReady) {
      return this.getFallbackColorName(hexColor, fallbackName);
    }

    try {
      // Quick IndexedDB lookup (should be < 10ms)
      const filament = await this.storage.findBestFilamentMatch(hexColor);

      if (filament) {
        return `${filament.manufacturer_name} ${filament.color_name}`;
      }

      // No match found in database
      return this.getFallbackColorName(hexColor, fallbackName);
    } catch (error) {
      console.warn('Failed to get enhanced color name:', error);
      return this.getFallbackColorName(hexColor, fallbackName);
    }
  }

  /**
   * Find best filament match with confidence scoring
   */
  public async findBestMatch(hexColor: string): Promise<FilamentMatch | null> {
    if (!this.isStorageReady) {
      return null;
    }

    try {
      const filament = await this.storage.findBestFilamentMatch(hexColor);

      if (filament) {
        // Calculate confidence based on exact hex match
        const inputHex = hexColor.replace('#', '').toUpperCase();
        const isExactMatch = filament.hex_color === inputHex;

        return {
          filament,
          confidence: isExactMatch ? 'exact' : 'close',
          deltaE: 0, // Since we're doing exact hex matching for now
          source: 'indexeddb',
        };
      }

      return null;
    } catch (error) {
      console.warn('Failed to find filament match:', error);
      return null;
    }
  }

  /**
   * Get filaments by manufacturer (for user preferences)
   */
  public async getFilamentsByManufacturer(manufacturer: string): Promise<StoredFilament[]> {
    if (!this.isStorageReady) {
      return [];
    }

    try {
      return await this.storage.getAllFilamentsByManufacturer(manufacturer);
    } catch (error) {
      console.warn('Failed to get filaments by manufacturer:', error);
      return [];
    }
  }

  /**
   * Start background synchronization
   */
  public startSync(force: boolean = false): void {
    console.log('[FilamentDB] Starting sync, force:', force);

    if (!this.worker) {
      console.warn('[FilamentDB] Worker not available for sync');
      return;
    }

    if (!this.isWorkerReady) {
      console.log('[FilamentDB] Worker not ready, queueing sync request');
      this.pendingSyncRequest = { force };
      return;
    }

    this.startSyncInternal(force);
  }

  private startSyncInternal(force: boolean): void {
    if (!this.worker) return;

    const message = {
      type: 'START_SYNC',
      payload: { force },
    };
    console.log('[FilamentDB] Sending message to worker:', message);

    this.worker.postMessage(message);
  }

  /**
   * Stop background synchronization
   */
  public stopSync(): void {
    if (!this.worker) return;

    this.worker.postMessage({
      type: 'STOP_SYNC',
    });
  }

  /**
   * Get current synchronization status
   */
  public async getSyncStatus(): Promise<SyncStatus | null> {
    if (!this.isStorageReady) {
      return null;
    }

    try {
      return await this.storage.getSyncStatus();
    } catch (error) {
      console.warn('Failed to get sync status:', error);
      return null;
    }
  }

  /**
   * Get database statistics
   */
  public async getStats(): Promise<DatabaseStats> {
    if (!this.isStorageReady) {
      return {
        totalFilaments: 0,
        totalGroups: 0,
        manufacturers: [],
        isAvailable: false,
        estimatedSizeBytes: 0,
      };
    }

    try {
      const stats = await this.storage.getStorageStats();
      const syncStatus = await this.storage.getSyncStatus();

      return {
        totalFilaments: stats.totalFilaments,
        totalGroups: stats.totalGroups,
        manufacturers: stats.manufacturers,
        lastSync: syncStatus?.last_sync ? new Date(syncStatus.last_sync) : undefined,
        isAvailable: true,
        estimatedSizeBytes: stats.estimatedSizeBytes,
      };
    } catch (error) {
      console.warn('Failed to get database stats:', error);
      return {
        totalFilaments: 0,
        totalGroups: 0,
        manufacturers: [],
        isAvailable: false,
        estimatedSizeBytes: 0,
      };
    }
  }

  /**
   * Subscribe to sync progress updates
   */
  public onSyncProgress(callback: (progress: SyncProgress) => void): () => void {
    this.syncCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.syncCallbacks.delete(callback);
    };
  }

  /**
   * Clear all cached data and restart
   */
  public async clearCache(): Promise<void> {
    if (!this.worker) return;

    this.worker.postMessage({
      type: 'CLEAR_DATA',
    });
  }

  /**
   * Force clear sync state (for debugging stuck syncs)
   */
  public async forceClearSyncState(): Promise<void> {
    if (!this.isStorageReady) {
      console.warn('[FilamentDB] Storage not ready, cannot clear sync state');
      return;
    }

    try {
      await this.storage.updateSyncStatus({ is_syncing: false });
      console.log('[FilamentDB] Force cleared sync state');
    } catch (error) {
      console.error('[FilamentDB] Failed to clear sync state:', error);
    }
  }

  /**
   * Check if database needs update using version endpoint or fallback to time-based
   */
  public async needsUpdate(): Promise<boolean> {
    const syncStatus = await this.getSyncStatus();

    if (!syncStatus || !syncStatus.last_sync) {
      return true; // Never synced
    }

    try {
      // Check remote database version
      const response = await fetch('https://filamentcolors.xyz/api/version/');

      if (!response.ok) {
        console.warn('Failed to fetch version info, falling back to time-based check');
        // Fall back to time-based check (24 hours)
        const dayInMs = 24 * 60 * 60 * 1000;
        const now = Date.now();
        return now - syncStatus.last_sync > dayInMs;
      }

      const versionInfo = await response.json();

      // Compare database versions
      if (syncStatus.db_version !== versionInfo.db_version) {
        console.log(
          `Database version changed: ${syncStatus.db_version} -> ${versionInfo.db_version}`
        );
        return true;
      }

      // Compare last modified timestamps
      if (syncStatus.db_last_modified !== versionInfo.db_last_modified) {
        console.log(
          `Database modified: ${syncStatus.db_last_modified} -> ${versionInfo.db_last_modified}`
        );
        return true;
      }

      // Database hasn't changed
      return false;
    } catch (error) {
      console.warn('Error checking version info:', error);
      // Fall back to time-based check (24 hours) on error
      const dayInMs = 24 * 60 * 60 * 1000;
      const now = Date.now();
      return now - syncStatus.last_sync > dayInMs;
    }
  }

  /**
   * Auto-start sync if needed (called during app initialization)
   */
  public async autoSync(): Promise<void> {
    try {
      // First check if database is empty
      const stats = await this.getStats();

      if (stats.totalFilaments === 0) {
        console.log('Filament database is empty, starting initial sync...');
        this.startSync();
        return;
      }

      // Database has data, check if it needs update
      const needsUpdate = await this.needsUpdate();

      if (needsUpdate) {
        console.log('Filament database is outdated, starting sync...');
        this.startSync();
      } else {
        console.log('Filament database is up to date');
      }
    } catch (error) {
      console.error('Error during autoSync:', error);
      // On error, attempt sync anyway
      this.startSync();
    }
  }

  private getFallbackColorName(hexColor: string, fallbackName?: string): string {
    // Use the existing color naming utility as fallback
    const basicColorName = getColorName(hexColor);

    // If we have a meaningful color name, use it
    if (
      basicColorName !== hexColor &&
      !basicColorName.includes('-ish') &&
      !basicColorName.includes('Near')
    ) {
      return basicColorName;
    }

    // Return the provided fallback or generic name
    return fallbackName || basicColorName;
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.syncCallbacks.clear();

    if (this.storage) {
      this.storage.close();
    }
  }
}
