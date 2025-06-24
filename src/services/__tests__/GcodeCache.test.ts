import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GcodeCache } from '../GcodeCache';
import { GcodeStats, OptimizationResult, DebugLog } from '../../types';

// Mock IndexedDB for testing
const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};

global.indexedDB = mockIndexedDB as any;

describe('GcodeCache', () => {
  let cache: GcodeCache;
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

    // Create cache instance
    cache = new GcodeCache();

    // Simulate successful DB open
    setTimeout(() => {
      if (openRequest.onsuccess) {
        openRequest.onsuccess();
      }
    }, 0);
  });

  describe('initialize', () => {
    it('should open IndexedDB connection', async () => {
      await cache.initialize();
      expect(mockIndexedDB.open).toHaveBeenCalledWith('ams-gcode-cache', 1);
    });

    it('should create object store on upgrade', async () => {
      // Create a new cache instance to trigger upgrade
      const newCache = new GcodeCache();
      
      // Get the open request from the mock
      const openRequest = mockIndexedDB.open.mock.results[mockIndexedDB.open.mock.results.length - 1].value;
      
      // Trigger upgrade
      if (openRequest.onupgradeneeded) {
        openRequest.onupgradeneeded({ target: openRequest });
      }
      
      expect(mockDb.createObjectStore).toHaveBeenCalledWith(
        'parsed-results',
        { keyPath: 'key' }
      );
    });
  });

  describe('get', () => {
    it('should retrieve cached entry', async () => {
      const mockEntry = {
        key: 'test-hash',
        fileName: 'test.gcode',
        fileSize: 1000,
        stats: { layerColorMap: { '0': 'T0', '1': 'T1' } },
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

      const promise = cache.get('test-hash');

      // Simulate successful get
      setTimeout(() => {
        if (getRequest.onsuccess) {
          getRequest.onsuccess();
        }
      }, 0);

      const result = await promise;
      
      expect(result).toBeTruthy();
      expect(result?.fileName).toBe('test.gcode');
      expect(result?.stats.layerColorMap).toBeInstanceOf(Map);
    });

    it('should return null for non-existent entry', async () => {
      const getRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: undefined,
      };

      mockObjectStore.get.mockReturnValue(getRequest);

      const promise = cache.get('non-existent');

      setTimeout(() => {
        if (getRequest.onsuccess) {
          getRequest.onsuccess();
        }
      }, 0);

      const result = await promise;
      expect(result).toBeNull();
    });

    it('should remove expired entries', async () => {
      const expiredEntry = {
        key: 'expired-hash',
        fileName: 'expired.gcode',
        fileSize: 1000,
        stats: {},
        optimization: {},
        logs: [],
        timestamp: Date.now() - (100 * 24 * 60 * 60 * 1000), // 100 days ago
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

      const promise = cache.get('expired-hash');

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
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should store cache entry', async () => {
      const stats: GcodeStats = {
        fileName: 'test.gcode',
        fileSize: 1000,
        totalLayers: 100,
        totalHeight: 200,
        colors: [],
        toolChanges: [],
        layerColorMap: new Map([['0', 'T0']]),
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

      const promise = cache.set('test-hash', 'test.gcode', 1000, stats, optimization, logs);

      setTimeout(() => {
        if (putRequest.onsuccess) {
          putRequest.onsuccess();
        }
      }, 0);

      await promise;

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
      const clearRequest = {
        onsuccess: null as any,
        onerror: null as any,
      };

      mockObjectStore.clear.mockReturnValue(clearRequest);

      const promise = cache.clear();

      setTimeout(() => {
        if (clearRequest.onsuccess) {
          clearRequest.onsuccess();
        }
      }, 0);

      await promise;
      expect(mockObjectStore.clear).toHaveBeenCalled();
    });
  });

  describe('getMetadata', () => {
    it('should return cache metadata', async () => {
      const mockEntries = [
        {
          key: 'hash1',
          fileName: 'file1.gcode',
          timestamp: Date.now() - 1000,
        },
        {
          key: 'hash2',
          fileName: 'file2.gcode',
          timestamp: Date.now(),
        },
      ];

      const getAllRequest = {
        onsuccess: null as any,
        onerror: null as any,
        result: mockEntries,
      };

      mockObjectStore.getAll.mockReturnValue(getAllRequest);

      const promise = cache.getMetadata();

      setTimeout(() => {
        if (getAllRequest.onsuccess) {
          getAllRequest.onsuccess();
        }
      }, 0);

      const metadata = await promise;
      
      expect(metadata.totalEntries).toBe(2);
      expect(metadata.totalSize).toBeGreaterThan(0);
      expect(metadata.oldestEntry).toBeLessThan(metadata.newestEntry);
    });
  });
});