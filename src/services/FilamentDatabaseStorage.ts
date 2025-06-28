/**
 * IndexedDB storage layer for filament color database
 * Provides fast, persistent storage with hex color indexing
 */

export interface StoredFilament {
  id: number;
  hex_color: string;
  color_name: string;
  manufacturer_name: string;
  brand_priority: number; // 1=Bambu Labs, 2=PolyTerra, 3=Others
  popularity_score: number;
  filament_type: string;
  is_available: boolean;
  last_updated: number;
}

export interface FilamentGroup {
  hex_color: string;
  filaments: StoredFilament[];
  best_match: StoredFilament;
  last_updated: number;
}

export interface SyncStatus {
  last_sync: number;
  total_pages: number;
  synced_pages: number;
  is_syncing: boolean;
  version: number;
  db_version?: number; // Remote database version from API
  db_last_modified?: number; // Remote database last modified timestamp
}

export class FilamentDatabaseStorage {
  private static readonly DB_NAME = 'FilamentColorsDB';
  private static readonly DB_VERSION = 1;
  private static readonly FILAMENTS_STORE = 'filaments';
  private static readonly GROUPS_STORE = 'filament_groups';
  private static readonly SYNC_STORE = 'sync_status';

  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(
        FilamentDatabaseStorage.DB_NAME,
        FilamentDatabaseStorage.DB_VERSION
      );

      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStores(db);
      };
    });
  }

  private createObjectStores(db: IDBDatabase): void {
    // Filaments store - stores individual filament entries
    if (!db.objectStoreNames.contains(FilamentDatabaseStorage.FILAMENTS_STORE)) {
      const filamentsStore = db.createObjectStore(FilamentDatabaseStorage.FILAMENTS_STORE, {
        keyPath: 'id',
      });
      filamentsStore.createIndex('hex_color', 'hex_color', { unique: false });
      filamentsStore.createIndex('manufacturer', 'manufacturer_name', { unique: false });
      filamentsStore.createIndex('brand_priority', 'brand_priority', { unique: false });
    }

    // Filament groups store - stores best matches per hex color
    if (!db.objectStoreNames.contains(FilamentDatabaseStorage.GROUPS_STORE)) {
      const groupsStore = db.createObjectStore(FilamentDatabaseStorage.GROUPS_STORE, {
        keyPath: 'hex_color',
      });
      groupsStore.createIndex('last_updated', 'last_updated', { unique: false });
    }

    // Sync status store - tracks sync progress and metadata
    if (!db.objectStoreNames.contains(FilamentDatabaseStorage.SYNC_STORE)) {
      db.createObjectStore(FilamentDatabaseStorage.SYNC_STORE, {
        keyPath: 'id',
      });
    }
  }

  async storeFilaments(filaments: StoredFilament[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    console.log(`[FilamentStorage] Storing ${filaments.length} filaments to IndexedDB...`);

    const transaction = this.db.transaction(
      [FilamentDatabaseStorage.FILAMENTS_STORE, FilamentDatabaseStorage.GROUPS_STORE],
      'readwrite'
    );

    const filamentsStore = transaction.objectStore(FilamentDatabaseStorage.FILAMENTS_STORE);
    const groupsStore = transaction.objectStore(FilamentDatabaseStorage.GROUPS_STORE);

    // Store individual filaments
    for (const filament of filaments) {
      filamentsStore.put(filament);
    }

    // Group filaments by hex color and determine best matches
    const hexGroups = new Map<string, StoredFilament[]>();

    for (const filament of filaments) {
      const hex = filament.hex_color.toUpperCase();
      if (!hexGroups.has(hex)) {
        hexGroups.set(hex, []);
      }
      hexGroups.get(hex)!.push(filament);
    }

    console.log(
      `[FilamentStorage] Grouped ${filaments.length} filaments into ${hexGroups.size} hex color groups`
    );

    // Store optimized groups with best matches
    for (const [hex, groupFilaments] of hexGroups) {
      const bestMatch = this.selectBestFilament(groupFilaments);
      const group: FilamentGroup = {
        hex_color: hex,
        filaments: groupFilaments,
        best_match: bestMatch,
        last_updated: Date.now(),
      };
      groupsStore.put(group);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log(
          `[FilamentStorage] Successfully stored ${filaments.length} filaments and ${hexGroups.size} groups`
        );
        resolve();
      };
      transaction.onerror = (event) => {
        console.error('[FilamentStorage] Failed to store filaments:', event);
        reject(new Error('Failed to store filaments'));
      };
    });
  }

  async findBestFilamentMatch(hexColor: string): Promise<StoredFilament | null> {
    if (!this.db) {
      return null;
    }

    const hex = hexColor.replace('#', '').toUpperCase();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([FilamentDatabaseStorage.GROUPS_STORE], 'readonly');
      const store = transaction.objectStore(FilamentDatabaseStorage.GROUPS_STORE);
      const request = store.get(hex);

      request.onsuccess = () => {
        const group = request.result as FilamentGroup | undefined;
        resolve(group?.best_match || null);
      };

      request.onerror = () => {
        reject(new Error('Failed to find filament match'));
      };
    });
  }

  async getAllFilamentsByManufacturer(manufacturer: string): Promise<StoredFilament[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [FilamentDatabaseStorage.FILAMENTS_STORE],
        'readonly'
      );
      const store = transaction.objectStore(FilamentDatabaseStorage.FILAMENTS_STORE);
      const index = store.index('manufacturer');
      const request = index.getAll(manufacturer);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error('Failed to get filaments by manufacturer'));
    });
  }

  async getSyncStatus(): Promise<SyncStatus | null> {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([FilamentDatabaseStorage.SYNC_STORE], 'readonly');
      const store = transaction.objectStore(FilamentDatabaseStorage.SYNC_STORE);
      const request = store.get('main');

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get sync status'));
    });
  }

  async updateSyncStatus(status: Partial<SyncStatus>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const currentStatus = await this.getSyncStatus();
    const updatedStatus: SyncStatus = {
      last_sync: currentStatus?.last_sync || 0,
      total_pages: currentStatus?.total_pages || 0,
      synced_pages: currentStatus?.synced_pages || 0,
      is_syncing: currentStatus?.is_syncing || false,
      version: currentStatus?.version || 1,
      ...status,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([FilamentDatabaseStorage.SYNC_STORE], 'readwrite');
      const store = transaction.objectStore(FilamentDatabaseStorage.SYNC_STORE);
      const request = store.put({ id: 'main', ...updatedStatus });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to update sync status'));
    });
  }

  async getStorageStats(): Promise<{
    totalFilaments: number;
    totalGroups: number;
    manufacturers: string[];
    estimatedSizeBytes: number;
  }> {
    if (!this.db)
      return { totalFilaments: 0, totalGroups: 0, manufacturers: [], estimatedSizeBytes: 0 };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [FilamentDatabaseStorage.FILAMENTS_STORE, FilamentDatabaseStorage.GROUPS_STORE],
        'readonly'
      );

      let totalFilaments = 0;
      let totalGroups = 0;
      let estimatedSizeBytes = 0;
      const manufacturers = new Set<string>();

      // Count filaments and collect manufacturers
      const filamentsStore = transaction.objectStore(FilamentDatabaseStorage.FILAMENTS_STORE);
      const filamentsRequest = filamentsStore.count();

      filamentsRequest.onsuccess = () => {
        totalFilaments = filamentsRequest.result;
      };

      // Get all manufacturers and calculate estimated size
      const manufacturerIndex = filamentsStore.index('manufacturer');
      const manufacturerRequest = manufacturerIndex.openCursor();

      manufacturerRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const filament = cursor.value as StoredFilament;
          manufacturers.add(filament.manufacturer_name);

          // Estimate size of this filament record (rough calculation)
          const recordSize = JSON.stringify(filament).length * 2; // UTF-16 characters
          estimatedSizeBytes += recordSize;

          cursor.continue();
        }
      };

      // Count groups and add their estimated size
      const groupsStore = transaction.objectStore(FilamentDatabaseStorage.GROUPS_STORE);
      const groupsRequest = groupsStore.count();

      groupsRequest.onsuccess = () => {
        totalGroups = groupsRequest.result;
      };

      // Get all groups to calculate their size
      const allGroupsRequest = groupsStore.getAll();
      allGroupsRequest.onsuccess = () => {
        const groups = allGroupsRequest.result as FilamentGroup[];
        groups.forEach((group) => {
          const groupSize = JSON.stringify(group).length * 2; // UTF-16 characters
          estimatedSizeBytes += groupSize;
        });
      };

      transaction.oncomplete = () => {
        resolve({
          totalFilaments,
          totalGroups,
          manufacturers: Array.from(manufacturers).sort(),
          estimatedSizeBytes,
        });
      };

      transaction.onerror = () => reject(new Error('Failed to get storage stats'));
    });
  }

  async clearAllData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [
          FilamentDatabaseStorage.FILAMENTS_STORE,
          FilamentDatabaseStorage.GROUPS_STORE,
          FilamentDatabaseStorage.SYNC_STORE,
        ],
        'readwrite'
      );

      const stores = [
        transaction.objectStore(FilamentDatabaseStorage.FILAMENTS_STORE),
        transaction.objectStore(FilamentDatabaseStorage.GROUPS_STORE),
        transaction.objectStore(FilamentDatabaseStorage.SYNC_STORE),
      ];

      stores.forEach((store) => store.clear());

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to clear data'));
    });
  }

  private selectBestFilament(filaments: StoredFilament[]): StoredFilament {
    return filaments.sort((a, b) => {
      // Priority 1: Brand priority (1=Bambu Labs, 2=PolyTerra, 3=Others)
      if (a.brand_priority !== b.brand_priority) {
        return a.brand_priority - b.brand_priority;
      }

      // Priority 2: Popularity score (higher is better)
      if (a.popularity_score !== b.popularity_score) {
        return b.popularity_score - a.popularity_score;
      }

      // Priority 3: Availability
      if (a.is_available !== b.is_available) {
        return a.is_available ? -1 : 1;
      }

      // Priority 4: ID (for consistent ordering)
      return a.id - b.id;
    })[0];
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
