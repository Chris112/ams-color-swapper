import { Result } from '../types';
import { PrintData } from '../services/FactoryFloorService';

export interface IFactoryFloorRepository {
  initialize(): Promise<Result<void>>;
  save(prints: Map<string, PrintData>): Promise<Result<void>>;
  load(): Promise<Result<Map<string, PrintData>>>;
  clear(): Promise<Result<void>>;
  deletePrint(printId: string): Promise<Result<void>>;
}

export class FactoryFloorRepository implements IFactoryFloorRepository {
  private dbName = 'ams-factory-floor';
  private version = 1;
  private storeName = 'prints';
  private db: IDBDatabase | null = null;

  async initialize(): Promise<Result<void>> {
    try {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('dateAdded', 'dateAdded', { unique: false });
          store.createIndex('filename', 'filename', { unique: false });
        }
      };

      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      return Result.ok(undefined);
    } catch (error) {
      return Result.err(
        new Error(`Failed to initialize factory floor database: ${error instanceof Error ? error.message : 'Unknown error'}`)
      );
    }
  }

  async save(prints: Map<string, PrintData>): Promise<Result<void>> {
    if (!this.db) {
      return Result.err(new Error('Database not initialized'));
    }

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      // Clear existing data first
      await new Promise<void>((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => reject(clearRequest.error);
      });

      // Save all prints (but only metadata, not full gcode content)
      for (const [id, printData] of prints) {
        const storageData = {
          ...printData,
          // Don't store the full gcode content to save space
          gcodeContent: '', 
          // Store a flag that this needs to be reloaded
          needsReload: true
        };

        await new Promise<void>((resolve, reject) => {
          const request = store.put(storageData);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }

      return Result.ok(undefined);
    } catch (error) {
      return Result.err(
        new Error(`Failed to save factory floor data: ${error instanceof Error ? error.message : 'Unknown error'}`)
      );
    }
  }

  async load(): Promise<Result<Map<string, PrintData>>> {
    if (!this.db) {
      return Result.err(new Error('Database not initialized'));
    }

    try {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      const prints = await new Promise<PrintData[]>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      const printsMap = new Map<string, PrintData>();
      
      // Only load prints that don't need full gcode reload
      // (In a real implementation, you might want to reload from original files)
      prints.forEach(print => {
        if (!print.needsReload) {
          printsMap.set(print.id, print);
        }
      });

      return Result.ok(printsMap);
    } catch (error) {
      return Result.err(
        new Error(`Failed to load factory floor data: ${error instanceof Error ? error.message : 'Unknown error'}`)
      );
    }
  }

  async clear(): Promise<Result<void>> {
    if (!this.db) {
      return Result.err(new Error('Database not initialized'));
    }

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return Result.ok(undefined);
    } catch (error) {
      return Result.err(
        new Error(`Failed to clear factory floor data: ${error instanceof Error ? error.message : 'Unknown error'}`)
      );
    }
  }

  async deletePrint(printId: string): Promise<Result<void>> {
    if (!this.db) {
      return Result.err(new Error('Database not initialized'));
    }

    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(printId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return Result.ok(undefined);
    } catch (error) {
      return Result.err(
        new Error(`Failed to delete print: ${error instanceof Error ? error.message : 'Unknown error'}`)
      );
    }
  }
}