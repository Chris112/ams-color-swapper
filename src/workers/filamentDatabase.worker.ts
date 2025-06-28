/**
 * Web Worker for background filament database synchronization
 * Handles all API fetching without blocking the main UI thread
 */

import { FilamentDatabaseStorage, StoredFilament } from '../services/FilamentDatabaseStorage';

interface FilamentSwatch {
  id: number;
  color_name: string;
  manufacturer: {
    id: number;
    name: string;
    website: string;
  };
  filament_type: {
    id: number;
    name: string;
    diameter: string;
    extruder_temp: string;
    bed_temp: string;
    created_at: string;
  };
  color_parent: {
    id: number;
    name: string;
    description: string;
  };
  hex_color: string;
  image_front: string;
  image_back: string;
  card_img: string;
  closest_pantone_1?: any;
  closest_pantone_2?: any;
  closest_pantone_3?: any;
  closest_pms_1?: any;
  closest_pms_2?: any;
  closest_pms_3?: any;
  closest_ral_1?: any;
  closest_ral_2?: any;
  closest_ral_3?: any;
  td: number;
  human_readable_date: string;
  is_available: boolean;
  published: boolean;
}

interface ApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: FilamentSwatch[];
}

interface ApiVersionResponse {
  db_version: number;
  db_last_modified: number;
}

interface WorkerMessage {
  type: 'START_SYNC' | 'STOP_SYNC' | 'GET_STATUS' | 'CLEAR_DATA';
  payload?: any;
}

interface WorkerResponse {
  type:
    | 'WORKER_READY'
    | 'SYNC_PROGRESS'
    | 'SYNC_COMPLETE'
    | 'SYNC_ERROR'
    | 'STATUS'
    | 'DATA_CLEARED';
  payload?: any;
}

class FilamentDatabaseWorker {
  private storage: FilamentDatabaseStorage;
  private isInitialized = false;
  private currentSyncController: AbortController | null = null;

  // Parallel sync configuration
  private readonly PARALLEL_BATCH_SIZE = 4; // Concurrent requests per batch
  private readonly BATCH_DELAY_MS = 100; // Delay between batches
  private readonly STORAGE_BATCH_SIZE = 500; // Filaments to accumulate before storing

  constructor() {
    this.storage = new FilamentDatabaseStorage();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      console.log('[FilamentDB] Worker initializing...');
      await this.storage.initialize();
      this.isInitialized = true;
      console.log('[FilamentDB] Worker initialized successfully');

      // Notify main thread that worker is ready
      this.sendResponse({
        type: 'WORKER_READY',
        payload: { initialized: true },
      });
    } catch (error) {
      console.error('[FilamentDB] Failed to initialize worker storage:', error);
      this.sendResponse({
        type: 'SYNC_ERROR',
        payload: { error: 'Failed to initialize worker storage' },
      });
    }
  }

  async handleMessage(message: WorkerMessage): Promise<void> {
    console.log('[FilamentDB] Worker received message:', message.type, message.payload);

    if (!this.isInitialized) {
      console.error('[FilamentDB] Worker not initialized, rejecting message');
      this.sendResponse({
        type: 'SYNC_ERROR',
        payload: { error: 'Worker not initialized' },
      });
      return;
    }

    switch (message.type) {
      case 'START_SYNC':
        console.log('[FilamentDB] Starting sync, force:', message.payload?.force || false);
        await this.startSync(message.payload?.force || false);
        break;
      case 'STOP_SYNC':
        console.log('[FilamentDB] Stopping sync');
        this.stopSync();
        break;
      case 'GET_STATUS':
        console.log('[FilamentDB] Getting status');
        await this.getStatus();
        break;
      case 'CLEAR_DATA':
        console.log('[FilamentDB] Clearing data');
        await this.clearData();
        break;
      default:
        console.warn('[FilamentDB] Unknown message type:', message.type);
    }
  }

  private async startSync(force: boolean = false): Promise<void> {
    let syncedPages = 0;
    let totalPages = 0;

    try {
      // Check if sync is needed by comparing database versions
      const syncStatus = await this.storage.getSyncStatus();

      // Check for stale sync state (if sync has been running for more than 10 minutes, it's likely stale)
      if (syncStatus?.is_syncing && syncStatus.last_sync) {
        const staleSyncThreshold = 10 * 60 * 1000; // 10 minutes
        const timeSinceLastSync = Date.now() - syncStatus.last_sync;

        if (timeSinceLastSync > staleSyncThreshold) {
          console.warn('[FilamentDB] Detected stale sync state, clearing it');
          await this.storage.updateSyncStatus({ is_syncing: false });
        } else {
          console.log('[FilamentDB] Sync already in progress, rejecting new sync request');
          this.sendResponse({
            type: 'SYNC_ERROR',
            payload: { error: 'Sync already in progress' },
          });
          return;
        }
      } else if (syncStatus?.is_syncing) {
        // If is_syncing is true but no last_sync timestamp, it's definitely stale
        console.warn('[FilamentDB] Clearing stale sync state (no timestamp)');
        await this.storage.updateSyncStatus({ is_syncing: false });
      }

      // Check remote database version
      let needsSync: boolean;
      try {
        needsSync = await this.checkIfSyncNeeded(syncStatus, force);
        console.log('[FilamentDB] Sync needed check result:', needsSync);
      } catch (error) {
        console.error(
          '[FilamentDB] Error checking sync requirements, defaulting to sync needed:',
          error
        );
        needsSync = true; // Default to syncing on error
      }

      if (!needsSync) {
        console.log('[FilamentDB] Sync not needed, sending complete message');
        this.sendResponse({
          type: 'SYNC_COMPLETE',
          payload: { message: 'Database is up to date, skipping sync' },
        });
        return;
      }

      // Start sync process with parallel batching
      console.log('[FilamentDB] Starting optimized parallel sync process...');
      this.currentSyncController = new AbortController();
      await this.storage.updateSyncStatus({ is_syncing: true, synced_pages: 0 });

      // First, get initial page to determine total pages
      const firstPageUrl = 'https://filamentcolors.xyz/api/swatch/';
      console.log('[FilamentDB] Fetching first page to determine total pages...');

      const firstResponse = await this.fetchPage(firstPageUrl, 1);
      if (!firstResponse) return;

      const { data: firstData } = firstResponse;
      const pageSize = firstData.results.length;
      totalPages = Math.ceil(firstData.count / pageSize);

      console.log(
        `[FilamentDB] Total pages detected: ${totalPages} (${firstData.count} total items, ${pageSize} per page)`
      );
      await this.storage.updateSyncStatus({ total_pages: totalPages });

      // Generate all page URLs for parallel fetching
      const pageUrls: string[] = [];

      // Start with the first page we already have info for
      pageUrls.push(firstPageUrl);

      // Generate subsequent page URLs (pattern: ?page=2, ?page=3, etc.)
      for (let page = 2; page <= totalPages; page++) {
        pageUrls.push(`https://filamentcolors.xyz/api/swatch/?page=${page}`);
      }

      console.log(`[FilamentDB] Starting parallel sync of ${totalPages} pages with batching...`);
      console.log(
        `[FilamentDB] Configuration: ${this.PARALLEL_BATCH_SIZE} concurrent requests, ${this.BATCH_DELAY_MS}ms delay between batches`
      );

      let allFilaments: StoredFilament[] = [];

      for (let i = 0; i < pageUrls.length; i += this.PARALLEL_BATCH_SIZE) {
        if (!this.currentSyncController || this.currentSyncController.signal.aborted) break;

        const batch = pageUrls.slice(i, i + this.PARALLEL_BATCH_SIZE);
        const batchNumber = Math.floor(i / this.PARALLEL_BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(pageUrls.length / this.PARALLEL_BATCH_SIZE);

        console.log(
          `[FilamentDB] Processing batch ${batchNumber}/${totalBatches} (pages ${i + 1}-${Math.min(i + this.PARALLEL_BATCH_SIZE, pageUrls.length)})`
        );

        try {
          // Fetch batch of pages in parallel
          const batchPromises = batch.map((url, batchIndex) =>
            this.fetchPage(url, i + batchIndex + 1)
          );

          const batchResults = await Promise.allSettled(batchPromises);

          // Process results from this batch
          for (const result of batchResults) {
            if (result.status === 'fulfilled' && result.value) {
              const { data, pageNumber } = result.value;

              const validFilaments = data.results
                .filter(this.isValidSwatch)
                .map((swatch) => this.convertToStoredFilament(swatch));

              allFilaments.push(...validFilaments);
              syncedPages++;

              console.log(
                `[FilamentDB] Page ${pageNumber}: ${data.results.length} total swatches, ${validFilaments.length} valid filaments`
              );
            } else if (result.status === 'rejected') {
              console.error(`[FilamentDB] Batch request failed:`, result.reason);
              // Continue with other pages in batch
            }
          }

          // Update progress
          await this.storage.updateSyncStatus({ synced_pages: syncedPages });

          this.sendResponse({
            type: 'SYNC_PROGRESS',
            payload: {
              totalPages,
              syncedPages,
              totalFilaments: allFilaments.length,
              progress: totalPages > 0 ? (syncedPages / totalPages) * 100 : 0,
            },
          });

          // Store filaments in batches for memory management
          if (allFilaments.length >= this.STORAGE_BATCH_SIZE) {
            console.log(
              `[FilamentDB] Storing batch of ${allFilaments.length} filaments to IndexedDB...`
            );
            await this.storage.storeFilaments(allFilaments);
            console.log(`[FilamentDB] Batch stored successfully`);
            allFilaments = []; // Clear memory
          }

          // Respectful delay between batches (not between individual requests)
          if (
            i + this.PARALLEL_BATCH_SIZE < pageUrls.length &&
            this.currentSyncController &&
            !this.currentSyncController.signal.aborted
          ) {
            await new Promise((resolve) => setTimeout(resolve, this.BATCH_DELAY_MS));
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('[FilamentDB] Sync was cancelled');
            return;
          }
          console.error(`[FilamentDB] Batch ${batchNumber} failed:`, error);
          // Continue with next batch
        }
      }

      // Check if sync was cancelled
      const wasCancelled = !this.currentSyncController || this.currentSyncController.signal.aborted;

      // Store remaining filaments
      if (allFilaments.length > 0) {
        console.log(`[FilamentDB] Storing final batch of ${allFilaments.length} filaments...`);
        await this.storage.storeFilaments(allFilaments);
        console.log(`[FilamentDB] Final batch stored successfully`);
      }

      if (wasCancelled) {
        console.log(`[FilamentDB] Sync was cancelled after processing ${syncedPages} pages`);

        // Update sync status to not syncing
        await this.storage.updateSyncStatus({ is_syncing: false });

        // Send cancellation response
        this.sendResponse({
          type: 'SYNC_COMPLETE',
          payload: {
            message: `Sync cancelled after ${syncedPages} pages`,
            totalFilaments: syncedPages * 50, // Approximate
            totalPages: syncedPages,
            cancelled: true,
          },
        });
        return;
      }

      console.log(
        `[FilamentDB] Sync completed! Total pages: ${syncedPages}, Total estimated filaments: ${syncedPages * 50}`
      );

      // Get current version info to store with sync completion
      let versionInfo: ApiVersionResponse | null = null;

      // Only fetch version info if sync wasn't cancelled
      if (this.currentSyncController && !this.currentSyncController.signal.aborted) {
        try {
          console.log('[FilamentDB] Fetching final version info...');
          const versionResponse = await fetch('https://filamentcolors.xyz/api/version/', {
            signal: this.currentSyncController.signal,
          });
          if (versionResponse.ok) {
            const versionText = await versionResponse.text();
            versionInfo = JSON.parse(versionText);
            console.log('[FilamentDB] Final version info:', versionInfo);
          } else {
            console.warn(
              '[FilamentDB] Failed to fetch final version info:',
              versionResponse.status
            );
          }
        } catch (error) {
          console.warn('[FilamentDB] Failed to fetch version info at sync completion:', error);
        }
      }

      // Mark sync as complete with version info
      const syncCompletionData = {
        is_syncing: false,
        last_sync: Date.now(),
        synced_pages: syncedPages,
        total_pages: totalPages,
        db_version: versionInfo?.db_version,
        db_last_modified: versionInfo?.db_last_modified,
      };
      console.log('[FilamentDB] Updating sync status with completion data:', syncCompletionData);
      await this.storage.updateSyncStatus(syncCompletionData);

      const completionPayload = {
        totalFilaments: syncedPages * 50, // Approximate
        totalPages: syncedPages,
        completedAt: new Date().toISOString(),
      };
      console.log('[FilamentDB] Sending sync complete message:', completionPayload);

      this.sendResponse({
        type: 'SYNC_COMPLETE',
        payload: completionPayload,
      });
    } catch (error) {
      console.error('[FilamentDB] Sync failed with error:', error);
      console.error(
        '[FilamentDB] Error stack:',
        error instanceof Error ? error.stack : 'No stack trace'
      );

      // Mark sync as failed
      await this.storage.updateSyncStatus({ is_syncing: false });

      const errorPayload = {
        error: error instanceof Error ? error.message : 'Unknown sync error',
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        syncedPages: typeof syncedPages !== 'undefined' ? syncedPages : 0,
        totalPages: typeof totalPages !== 'undefined' ? totalPages : 0,
      };
      console.error('[FilamentDB] Sending error response:', errorPayload);

      this.sendResponse({
        type: 'SYNC_ERROR',
        payload: errorPayload,
      });
    } finally {
      this.currentSyncController = null;
      console.log('[FilamentDB] Sync process cleanup completed');
    }
  }

  private stopSync(): void {
    if (this.currentSyncController) {
      this.currentSyncController.abort();
      this.currentSyncController = null;
    }
  }

  private async checkIfSyncNeeded(syncStatus: any, force: boolean): Promise<boolean> {
    try {
      console.log('[FilamentDB] Checking if sync needed...', {
        force,
        syncStatus: syncStatus
          ? {
              last_sync: syncStatus.last_sync,
              db_version: syncStatus.db_version,
              db_last_modified: syncStatus.db_last_modified,
              is_syncing: syncStatus.is_syncing,
            }
          : null,
      });

      // Always sync if forced or never synced before
      if (force || !syncStatus || !syncStatus.last_sync) {
        console.log('[FilamentDB] Sync needed: force or never synced');
        return true;
      }

      // Check remote database version
      console.log('[FilamentDB] Fetching version info from API...');
      const response = await fetch('https://filamentcolors.xyz/api/version/', {
        signal: this.currentSyncController?.signal,
      });

      console.log('[FilamentDB] Version API response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (!response.ok) {
        console.warn('[FilamentDB] Failed to fetch version info, falling back to time-based sync');
        // Fall back to time-based sync (24 hours)
        const dayInMs = 24 * 60 * 60 * 1000;
        const now = Date.now();
        const needsSync = now - syncStatus.last_sync > dayInMs;
        console.log('[FilamentDB] Time-based sync decision:', {
          needsSync,
          hoursSinceLastSync: (now - syncStatus.last_sync) / (60 * 60 * 1000),
        });
        return needsSync;
      }

      const responseText = await response.text();
      console.log('[FilamentDB] Version API raw response:', responseText);

      let versionInfo: ApiVersionResponse;
      try {
        versionInfo = JSON.parse(responseText);
        console.log('[FilamentDB] Parsed version info:', versionInfo);
      } catch (parseError) {
        console.error('[FilamentDB] Failed to parse version response:', parseError);
        throw new Error(`Invalid JSON response: ${responseText}`);
      }

      // Compare database versions
      if (syncStatus.db_version !== versionInfo.db_version) {
        console.log(
          `[FilamentDB] Database version changed: ${syncStatus.db_version} -> ${versionInfo.db_version}`
        );
        return true;
      }

      // Compare last modified timestamps
      if (syncStatus.db_last_modified !== versionInfo.db_last_modified) {
        console.log(
          `[FilamentDB] Database modified: ${syncStatus.db_last_modified} -> ${versionInfo.db_last_modified}`
        );
        return true;
      }

      // Database hasn't changed
      console.log('[FilamentDB] Database is up to date, no sync needed');
      return false;
    } catch (error) {
      console.error('[FilamentDB] Error checking sync requirements:', error);
      // Fall back to time-based sync (24 hours) on error
      const dayInMs = 24 * 60 * 60 * 1000;
      const now = Date.now();
      const needsSync = !syncStatus || now - syncStatus.last_sync > dayInMs;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log('[FilamentDB] Fallback time-based sync decision:', {
        needsSync,
        error: errorMessage,
      });
      return needsSync;
    }
  }

  private async getStatus(): Promise<void> {
    try {
      const syncStatus = await this.storage.getSyncStatus();
      const stats = await this.storage.getStorageStats();

      this.sendResponse({
        type: 'STATUS',
        payload: {
          syncStatus,
          stats,
          lastUpdated: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.sendResponse({
        type: 'SYNC_ERROR',
        payload: { error: 'Failed to get status' },
      });
    }
  }

  private async clearData(): Promise<void> {
    try {
      await this.storage.clearAllData();
      this.sendResponse({
        type: 'DATA_CLEARED',
        payload: { message: 'All filament data cleared' },
      });
    } catch (error) {
      this.sendResponse({
        type: 'SYNC_ERROR',
        payload: { error: 'Failed to clear data' },
      });
    }
  }

  private convertToStoredFilament(swatch: FilamentSwatch): StoredFilament {
    return {
      id: swatch.id,
      hex_color: swatch.hex_color.replace('#', '').toUpperCase(),
      color_name: swatch.color_name,
      manufacturer_name: swatch.manufacturer.name,
      brand_priority: this.calculateBrandPriority(swatch.manufacturer.name),
      popularity_score: this.calculatePopularityScore(swatch),
      filament_type: swatch.filament_type.name,
      is_available: swatch.is_available,
      last_updated: Date.now(),
    };
  }

  private calculateBrandPriority(manufacturerName: string): number {
    const name = manufacturerName.toLowerCase();

    // Priority 1: Bambu Labs
    if (name.includes('bambu')) return 1;

    // Priority 2: PolyTerra
    if (name.includes('polyterra')) return 2;

    // Priority 3: All others
    return 3;
  }

  private calculatePopularityScore(swatch: FilamentSwatch): number {
    // Simple popularity scoring based on available factors
    let score = 100; // Base score

    // Boost score for well-known manufacturers
    const manufacturer = swatch.manufacturer.name.toLowerCase();
    if (manufacturer.includes('bambu')) score += 50;
    else if (manufacturer.includes('polyterra')) score += 40;
    else if (manufacturer.includes('overture')) score += 30;
    else if (manufacturer.includes('hatchbox')) score += 25;
    else if (manufacturer.includes('sunlu')) score += 20;

    // Boost for common filament types
    const filamentType = swatch.filament_type.name.toLowerCase();
    if (filamentType.includes('pla')) score += 20;
    else if (filamentType.includes('petg')) score += 15;
    else if (filamentType.includes('abs')) score += 10;

    return score;
  }

  private async fetchPage(
    url: string,
    pageNumber: number
  ): Promise<{ data: ApiResponse; pageNumber: number } | null> {
    try {
      console.log(`[FilamentDB] Fetching page ${pageNumber} from: ${url}`);

      const response = await fetch(url, {
        signal: this.currentSyncController?.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[FilamentDB] Page ${pageNumber} request failed:`, {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      console.log(`[FilamentDB] Page ${pageNumber} response length: ${responseText.length}`);

      let data: ApiResponse;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[FilamentDB] Failed to parse page ${pageNumber}:`, parseError);
        const errorMessage =
          parseError instanceof Error ? parseError.message : 'Unknown parse error';
        throw new Error(`Failed to parse JSON response: ${errorMessage}`);
      }

      if (!data.results || !Array.isArray(data.results)) {
        console.error(`[FilamentDB] Invalid API response format for page ${pageNumber}:`, data);
        throw new Error('Invalid API response format - results is not an array');
      }

      return { data, pageNumber };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`[FilamentDB] Page ${pageNumber} fetch was cancelled`);
        return null;
      }
      console.error(`[FilamentDB] Failed to fetch page ${pageNumber}:`, error);
      throw error;
    }
  }

  private isValidSwatch(swatch: FilamentSwatch): boolean {
    const isValid =
      !!swatch.published &&
      !!swatch.hex_color &&
      !!swatch.color_name &&
      !!swatch.manufacturer?.name;

    if (!isValid) {
      console.log('[FilamentDB] Filtered out invalid swatch:', {
        id: swatch.id,
        published: swatch.published,
        has_hex_color: !!swatch.hex_color,
        has_color_name: !!swatch.color_name,
        has_manufacturer: !!swatch.manufacturer?.name,
      });
    }

    return isValid;
  }

  private sendResponse(response: WorkerResponse): void {
    self.postMessage(response);
  }
}

// Worker initialization
const worker = new FilamentDatabaseWorker();

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  await worker.handleMessage(event.data);
};
