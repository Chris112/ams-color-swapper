import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheRepository } from '../CacheRepository';
import { GcodeStats, OptimizationResult, DebugLog } from '../../types';

// Mock IndexedDB for testing
const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};

global.indexedDB = mockIndexedDB as any;

describe('CacheRepository', () => {
  let repository: CacheRepository;
  let mockDb: any;
  let mockObjectStore: any;
  let mockTransaction: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock object store
    mockObjectStore = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      getAll: vi.fn(),
      index: vi.fn(),
      createIndex: vi.fn(),
    };

    // Create mock transaction
    mockTransaction = {
      objectStore: vi.fn(() => mockObjectStore),
    };

    // Create mock database
    mockDb = {
      transaction: vi.fn(() => mockTransaction),
      objectStoreNames: {
        contains: vi.fn(() => false),
      },
      createObjectStore: vi.fn(() => mockObjectStore),
    };

    // Setup IndexedDB mock
    const openRequest = {
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any,
      result: mockDb,
    };

    mockIndexedDB.open.mockReturnValue(openRequest);

    // Create repository instance
    repository = new CacheRepository();

    // Simulate successful DB open
    setTimeout(() => {
      if (openRequest.onsuccess) {
        openRequest.onsuccess();
      }
    }, 0);
  });

  describe('initialize', () => {
    it('should open IndexedDB connection', async () => {
      const result = await repository.initialize();
      expect(result.ok).toBe(true);
      expect(mockIndexedDB.open).toHaveBeenCalledWith('ams-gcode-cache', 1);
    });

    it('should create object store on upgrade', async () => {
      // Clear previous mocks
      vi.clearAllMocks();

      // Setup a fresh mock database
      const upgradeDb = {
        objectStoreNames: {
          contains: vi.fn(() => false),
        },
        createObjectStore: vi.fn(() => mockObjectStore),
      };

      let capturedUpgradeHandler: any = null;
      const upgradeRequest = {
        set onupgradeneeded(handler: any) {
          capturedUpgradeHandler = handler;
        },
        onsuccess: null as any,
        onerror: null as any,
        result: upgradeDb,
      };

      mockIndexedDB.open.mockReturnValue(upgradeRequest);

      // Create a new repository instance and call initialize
      const newRepository = new CacheRepository();
      const initPromise = newRepository.initialize();

      // Wait for the handler to be set
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Now trigger the upgrade event
      if (capturedUpgradeHandler) {
        const event = { target: { result: upgradeDb } };
        capturedUpgradeHandler(event);
      }

      // Trigger success to complete initialization
      if (upgradeRequest.onsuccess) {
        upgradeRequest.onsuccess();
      }

      await initPromise;

      expect(upgradeDb.createObjectStore).toHaveBeenCalledWith('parsed-results', {
        keyPath: 'key',
      });
    });
  });

  describe('get', () => {
    it('should retrieve cached entry', async () => {
      // Initialize first
      await repository.initialize();

      const mockEntry = {
        key: 'test-hash',
        fileName: 'test.gcode',
        fileSize: 1000,
        stats: {
          layerColorMap: [
            ['0', 'T0'],
            ['1', 'T1'],
          ],
        },
        optimization: {},
        logs: [],
        timestamp: Date.now(),
        version: '1.0.0',
      };

      const getRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: mockEntry,
      };

      mockObjectStore.get.mockReturnValue(getRequest);

      const promise = repository.get('test-hash');

      // Simulate successful get
      setTimeout(() => {
        if (getRequest.onsuccess) {
          getRequest.onsuccess();
        }
      }, 0);

      const result = await promise;

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.fileName).toBe('test.gcode');
        expect(result.value.stats.layerColorMap).toBeInstanceOf(Map);
      }
    });

    it('should return null for non-existent entry', async () => {
      await repository.initialize();

      const getRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: undefined,
      };

      mockObjectStore.get.mockReturnValue(getRequest);

      const promise = repository.get('non-existent');

      setTimeout(() => {
        if (getRequest.onsuccess) {
          getRequest.onsuccess();
        }
      }, 0);

      const result = await promise;
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it('should remove expired entries', async () => {
      await repository.initialize();

      const expiredEntry = {
        key: 'expired-hash',
        fileName: 'expired.gcode',
        fileSize: 1000,
        stats: { layerColorMap: [] },
        optimization: {},
        logs: [],
        timestamp: Date.now() - 100 * 24 * 60 * 60 * 1000, // 100 days ago
        version: '1.0.0',
      };

      const getRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: expiredEntry,
      };

      const deleteRequest = {
        onsuccess: null as any,
        onerror: null as any,
      };

      mockObjectStore.get.mockReturnValue(getRequest);
      mockObjectStore.delete.mockReturnValue(deleteRequest);

      const promise = repository.get('expired-hash');

      setTimeout(() => {
        if (getRequest.onsuccess) {
          getRequest.onsuccess();
        }
      }, 0);

      setTimeout(() => {
        if (deleteRequest.onsuccess) {
          deleteRequest.onsuccess();
        }
      }, 10);

      const result = await promise;
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe('set', () => {
    it('should store cache entry', async () => {
      await repository.initialize();

      const stats: GcodeStats = {
        fileName: 'test.gcode',
        fileSize: 1000,
        totalLayers: 100,
        totalHeight: 200,
        colors: [],
        toolChanges: [],
        layerColorMap: new Map([[0, 'T0']]),
        colorUsageRanges: [],
        parserWarnings: [],
        parseTime: 500,
      };

      const optimization: OptimizationResult = {
        totalColors: 4,
        requiredSlots: 4,
        slotAssignments: [],
        manualSwaps: [],
        estimatedTimeSaved: 0,
        canShareSlots: [],
      };

      const logs: DebugLog[] = [];

      const putRequest = {
        onsuccess: null as any,
        onerror: null as any,
      };

      mockObjectStore.put.mockReturnValue(putRequest);

      const promise = repository.set('test-hash', 'test.gcode', 1000, stats, optimization, logs);

      setTimeout(() => {
        if (putRequest.onsuccess) {
          putRequest.onsuccess();
        }
      }, 0);

      const result = await promise;

      expect(result.ok).toBe(true);
      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'test-hash',
          fileName: 'test.gcode',
          fileSize: 1000,
          version: '1.0.0',
        })
      );
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', async () => {
      await repository.initialize();

      const clearRequest = {
        onsuccess: null as any,
        onerror: null as any,
      };

      mockObjectStore.clear.mockReturnValue(clearRequest);

      const promise = repository.clear();

      setTimeout(() => {
        if (clearRequest.onsuccess) {
          clearRequest.onsuccess();
        }
      }, 0);

      const result = await promise;
      expect(result.ok).toBe(true);
      expect(mockObjectStore.clear).toHaveBeenCalled();
    });
  });

  describe('getMetadata', () => {
    it('should return cache metadata', async () => {
      await repository.initialize();

      const mockEntries = [
        {
          key: 'hash1',
          fileName: 'file1.gcode',
          fileSize: 1000,
          timestamp: Date.now() - 1000,
        },
        {
          key: 'hash2',
          fileName: 'file2.gcode',
          fileSize: 2000,
          timestamp: Date.now(),
        },
      ];

      const getAllRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: mockEntries,
      };

      mockObjectStore.getAll.mockReturnValue(getAllRequest);

      const promise = repository.getMetadata();

      setTimeout(() => {
        if (getAllRequest.onsuccess) {
          getAllRequest.onsuccess();
        }
      }, 0);

      const result = await promise;

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.totalEntries).toBe(2);
        expect(result.value.totalSize).toBe(3000);
        expect(result.value.oldestEntry).toBeLessThan(result.value.newestEntry);
      }
    });
  });
});
