import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MergeHistoryManager } from '../MergeHistoryManager';
import { TimelineState } from '../TimelineStateMachine';
import { GcodeStats } from '../../types/gcode';
import { OptimizationResult } from '../../types/optimization';
import { Color } from '../../domain/models/Color';

// Mock the TimelineRepository to avoid IndexedDB in tests
vi.mock('../../repositories/TimelineRepository', () => ({
  TimelineRepository: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue({ ok: true }),
    saveTimeline: vi.fn().mockResolvedValue({ ok: true }),
    loadTimeline: vi.fn().mockResolvedValue({ ok: false }),
    deleteTimeline: vi.fn().mockResolvedValue({ ok: true }),
    getStorageMetrics: vi
      .fn()
      .mockResolvedValue({ ok: true, value: { totalSize: 1024, timelineCount: 1 } }),
  })),
}));

describe('MergeHistoryManager - Regression Tests', () => {
  let manager: MergeHistoryManager;
  let mockStats: GcodeStats;
  let mockOptimization: OptimizationResult;

  beforeEach(() => {
    manager = new MergeHistoryManager();

    mockStats = {
      colors: [
        new Color({
          id: 'T0',
          name: 'Red',
          hexValue: '#ff0000',
          firstLayer: 1,
          lastLayer: 10,
          totalLayers: 20,
        }),
        new Color({
          id: 'T1',
          name: 'Blue',
          hexValue: '#0000ff',
          firstLayer: 5,
          lastLayer: 15,
          totalLayers: 20,
        }),
      ],
      totalLayers: 20,
      toolChanges: [],
      layerColorMap: new Map(),
      colorUsageRanges: [],
      parserWarnings: [],
    };

    mockOptimization = {
      totalSlots: 4,
      slotAssignments: [],
      manualSwaps: [],
      efficiency: 95,
      analysis: {
        totalColors: 2,
        overlappingColors: 0,
        maxSimultaneousColors: 2,
        colorDistribution: new Map(),
      },
    };
  });

  describe('Bug: Cannot add merge state in current timeline state: EMPTY', () => {
    it('should reproduce the original bug scenario', () => {
      // This test reproduces the exact bug that was happening:
      // 1. User uploads file and processes it (addInitialState called)
      // 2. User uploads another file (clear() called but fails silently)
      // 3. User tries to merge (addMergeState fails because still in EMPTY state)

      // Step 1: First file upload - works fine
      manager.addInitialState(mockStats, mockOptimization);
      expect(manager.getTimelineState()).toBe(TimelineState.INITIAL);

      // Step 2: Perform some merges to get into AT_SNAPSHOT state
      manager.addMergeState(mockStats, mockOptimization, {
        targetColorId: 'T0',
        sourceColorIds: ['T1'],
        freedSlots: ['slot1'],
        description: 'Test merge',
      });
      expect(manager.getTimelineState()).toBe(TimelineState.AT_SNAPSHOT);

      // Step 3: Simulate new file upload - this is where the bug was
      // Before the fix, clear() would silently fail because CLEAR action
      // wasn't allowed from all states, leaving the state machine in AT_SNAPSHOT
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      manager.clear(); // This should force reset to EMPTY
      expect(manager.getTimelineState()).toBe(TimelineState.EMPTY);

      // Step 4: Add initial state for new file - should work
      manager.addInitialState(mockStats, mockOptimization);
      expect(manager.getTimelineState()).toBe(TimelineState.INITIAL);

      // Step 5: Try to merge - this should now work (before fix, it would fail)
      manager.addMergeState(mockStats, mockOptimization, {
        targetColorId: 'T0',
        sourceColorIds: ['T1'],
        freedSlots: ['slot1'],
        description: 'Second file merge',
      });
      expect(manager.getTimelineState()).toBe(TimelineState.AT_SNAPSHOT);
      expect(manager.getTimeline().snapshots).toHaveLength(2); // initial + merge

      consoleSpy.mockRestore();
    });

    it('should handle clear() from any state without silent failures', () => {
      // Test that clear() works from various states
      const states = [
        { name: 'INITIAL', setup: () => manager.addInitialState(mockStats, mockOptimization) },
        {
          name: 'AT_SNAPSHOT',
          setup: () => {
            manager.addInitialState(mockStats, mockOptimization);
            manager.addMergeState(mockStats, mockOptimization, {
              targetColorId: 'T0',
              sourceColorIds: ['T1'],
              freedSlots: ['slot1'],
              description: 'test',
            });
          },
        },
        { name: 'EMPTY', setup: () => {} }, // Already empty
      ];

      states.forEach(({ name, setup }) => {
        const testManager = new MergeHistoryManager();
        setup.call(testManager);

        // Clear should always work, regardless of current state
        testManager.clear();
        expect(testManager.getTimelineState()).toBe(TimelineState.EMPTY);
        expect(testManager.getTimeline().snapshots).toHaveLength(0);

        // Should be able to add initial state after clearing
        testManager.addInitialState(mockStats, mockOptimization);
        expect(testManager.getTimelineState()).toBe(TimelineState.INITIAL);
      });
    });

    it('should prevent the exact error message that was occurring', () => {
      // This test ensures the specific error "Cannot add merge state in current timeline state: EMPTY"
      // doesn't happen in normal workflow

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Simulate the complete workflow that was failing
      manager.addInitialState(mockStats, mockOptimization);
      manager.addMergeState(mockStats, mockOptimization, {
        targetColorId: 'T0',
        sourceColorIds: ['T1'],
        freedSlots: ['slot1'],
        description: 'merge1',
      });

      // New file upload workflow
      manager.clear();
      manager.addInitialState(mockStats, mockOptimization);

      // This merge should NOT trigger the warning
      manager.addMergeState(mockStats, mockOptimization, {
        targetColorId: 'T0',
        sourceColorIds: ['T1'],
        freedSlots: ['slot1'],
        description: 'merge2',
      });

      // Verify the specific error message did not occur
      expect(consoleSpy).not.toHaveBeenCalledWith(
        'Cannot add merge state in current timeline state:',
        TimelineState.EMPTY
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Edge cases that should be handled gracefully', () => {
    it('should handle multiple clears in sequence', () => {
      manager.addInitialState(mockStats, mockOptimization);

      // Multiple clears should not cause issues
      manager.clear();
      manager.clear();
      manager.clear();

      expect(manager.getTimelineState()).toBe(TimelineState.EMPTY);
      expect(manager.getTimeline().snapshots).toHaveLength(0);
    });

    it('should handle clear() without any prior state', () => {
      // Clear on brand new manager should not cause issues
      expect(() => manager.clear()).not.toThrow();
      expect(manager.getTimelineState()).toBe(TimelineState.EMPTY);
    });

    it('should maintain state consistency through rapid file uploads', () => {
      // Simulate rapid file uploads (user quickly switching files)
      for (let i = 0; i < 5; i++) {
        manager.clear();
        manager.addInitialState(mockStats, mockOptimization);

        // Should always be in correct state
        expect(manager.getTimelineState()).toBe(TimelineState.INITIAL);
        expect(manager.getTimeline().snapshots).toHaveLength(1);
      }
    });
  });
});
