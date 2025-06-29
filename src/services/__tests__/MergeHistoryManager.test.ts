import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MergeHistoryManager, StateSnapshot } from '../MergeHistoryManager';
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

describe('MergeHistoryManager', () => {
  let manager: MergeHistoryManager;
  let mockStats: GcodeStats;
  let mockOptimization: OptimizationResult;

  beforeEach(() => {
    manager = new MergeHistoryManager();

    // Create mock data
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

  describe('Initialization', () => {
    it('should start with empty timeline', () => {
      const timeline = manager.getTimeline();
      expect(timeline.snapshots).toHaveLength(0);
      expect(timeline.currentIndex).toBe(-1);
      expect(timeline.currentBranch).toBe('main');
    });

    it('should have main branch initialized', () => {
      const timeline = manager.getTimeline();
      expect(timeline.branches.has('main')).toBe(true);
      expect(timeline.branches.get('main')).toEqual([]);
    });
  });

  describe('Adding initial state', () => {
    it('should successfully add initial state when timeline is empty', () => {
      manager.addInitialState(mockStats, mockOptimization);

      const timeline = manager.getTimeline();
      expect(timeline.snapshots).toHaveLength(1);
      expect(timeline.currentIndex).toBe(0);

      const snapshot = timeline.snapshots[0];
      expect(snapshot.stats).toBeDefined();
      expect(snapshot.optimization).toBeDefined();
      expect(snapshot.mergeInfo).toBeUndefined();
      expect(snapshot.colorCount).toBe(2);
    });

    it('should update state machine to INITIAL state after adding initial state', () => {
      manager.addInitialState(mockStats, mockOptimization);
      expect(manager.getTimelineState()).toBe(TimelineState.INITIAL);
    });

    it('should not allow adding initial state twice without clearing', () => {
      manager.addInitialState(mockStats, mockOptimization);

      // Try to add again (should fail)
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      manager.addInitialState(mockStats, mockOptimization);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Cannot initialize timeline in current state:',
        TimelineState.INITIAL
      );
      expect(manager.getTimeline().snapshots).toHaveLength(1);

      consoleSpy.mockRestore();
    });
  });

  describe('Adding merge states', () => {
    beforeEach(() => {
      manager.addInitialState(mockStats, mockOptimization);
    });

    it('should successfully add merge state from INITIAL state', () => {
      const mergeInfo = {
        targetColorId: 'T0',
        sourceColorIds: ['T1'],
        freedSlots: ['slot1'],
        description: 'Test merge',
      };

      manager.addMergeState(mockStats, mockOptimization, mergeInfo);

      const timeline = manager.getTimeline();
      expect(timeline.snapshots).toHaveLength(2);
      expect(timeline.currentIndex).toBe(1);

      const mergeSnapshot = timeline.snapshots[1];
      expect(mergeSnapshot.mergeInfo).toEqual(mergeInfo);
      expect(mergeSnapshot.parentId).toBe(timeline.snapshots[0].id);
    });

    it('should allow adding multiple consecutive merges', () => {
      const mergeInfo1 = {
        targetColorId: 'T0',
        sourceColorIds: ['T1'],
        freedSlots: ['slot1'],
        description: 'First merge',
      };

      const mergeInfo2 = {
        targetColorId: 'T0',
        sourceColorIds: ['T2'],
        freedSlots: ['slot2'],
        description: 'Second merge',
      };

      manager.addMergeState(mockStats, mockOptimization, mergeInfo1);
      manager.addMergeState(mockStats, mockOptimization, mergeInfo2);

      const timeline = manager.getTimeline();
      expect(timeline.snapshots).toHaveLength(3);
      expect(timeline.currentIndex).toBe(2);
    });

    it('should not allow adding merge state from EMPTY state', () => {
      manager.clear();

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const mergeInfo = {
        targetColorId: 'T0',
        sourceColorIds: ['T1'],
        freedSlots: ['slot1'],
        description: 'Test merge',
      };

      manager.addMergeState(mockStats, mockOptimization, mergeInfo);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Cannot add merge state in current timeline state:',
        TimelineState.EMPTY
      );
      expect(manager.getTimeline().snapshots).toHaveLength(0);

      consoleSpy.mockRestore();
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      manager.addInitialState(mockStats, mockOptimization);

      // Add a couple of merge states for navigation testing
      manager.addMergeState(mockStats, mockOptimization, {
        targetColorId: 'T0',
        sourceColorIds: ['T1'],
        freedSlots: ['slot1'],
        description: 'First merge',
      });

      manager.addMergeState(mockStats, mockOptimization, {
        targetColorId: 'T0',
        sourceColorIds: ['T2'],
        freedSlots: ['slot2'],
        description: 'Second merge',
      });
    });

    describe('Undo', () => {
      it('should undo to previous state', () => {
        const currentSnapshot = manager.getCurrentSnapshot();
        const previousSnapshot = manager.undo();

        expect(previousSnapshot).toBeDefined();
        expect(previousSnapshot!.id).not.toBe(currentSnapshot!.id);
        expect(manager.getTimeline().currentIndex).toBe(1);
      });

      it('should not undo beyond initial state', () => {
        manager.undo(); // Go to state 1
        manager.undo(); // Go to state 0 (initial)

        const result = manager.undo(); // Try to go before initial
        expect(result).toBeNull();
        expect(manager.getTimeline().currentIndex).toBe(0);
      });

      it('should update canUndo/canRedo flags correctly', () => {
        manager.undo();
        expect(manager.canUndo()).toBe(true);
        expect(manager.canRedo()).toBe(true);
      });
    });

    describe('Redo', () => {
      it('should redo after undo', () => {
        const originalSnapshot = manager.getCurrentSnapshot();
        manager.undo();
        const redoneSnapshot = manager.redo();

        expect(redoneSnapshot).toBeDefined();
        expect(redoneSnapshot!.id).toBe(originalSnapshot!.id);
        expect(manager.getTimeline().currentIndex).toBe(2);
      });

      it('should not redo when at latest state', () => {
        const result = manager.redo();
        expect(result).toBeNull();
        expect(manager.getTimeline().currentIndex).toBe(2);
      });
    });

    describe('Jump to snapshot', () => {
      it('should jump to specific snapshot by ID', () => {
        const timeline = manager.getTimeline();
        const targetSnapshot = timeline.snapshots[0];

        const result = manager.jumpToSnapshot(targetSnapshot.id);

        expect(result).toBeDefined();
        expect(result!.id).toBe(targetSnapshot.id);
        expect(manager.getTimeline().currentIndex).toBe(0);
      });

      it('should return null for non-existent snapshot ID', () => {
        const result = manager.jumpToSnapshot('non-existent-id');
        expect(result).toBeNull();
      });
    });
  });

  describe('Reset functionality', () => {
    beforeEach(() => {
      manager.addInitialState(mockStats, mockOptimization);
      manager.addMergeState(mockStats, mockOptimization, {
        targetColorId: 'T0',
        sourceColorIds: ['T1'],
        freedSlots: ['slot1'],
        description: 'Test merge',
      });
    });

    it('should reset to initial state', () => {
      const initialSnapshot = manager.getTimeline().snapshots[0];

      const result = manager.reset();

      expect(result).toBeDefined();
      expect(result!.id).toBe(initialSnapshot.id);
      expect(manager.getTimeline().snapshots).toHaveLength(1);
      expect(manager.getTimeline().currentIndex).toBe(0);
    });

    it('should clear all branches except master on reset', () => {
      // Create a branch first
      manager.createBranch('test-branch');

      manager.reset();

      const timeline = manager.getTimeline();
      expect(timeline.branches.size).toBe(1);
      expect(timeline.branches.has('master')).toBe(true);
      expect(timeline.currentBranch).toBe('master');
    });
  });

  describe('Clear functionality', () => {
    beforeEach(() => {
      manager.addInitialState(mockStats, mockOptimization);
      manager.addMergeState(mockStats, mockOptimization, {
        targetColorId: 'T0',
        sourceColorIds: ['T1'],
        freedSlots: ['slot1'],
        description: 'Test merge',
      });
    });

    it('should clear all timeline data', () => {
      manager.clear();

      const timeline = manager.getTimeline();
      expect(timeline.snapshots).toHaveLength(0);
      expect(timeline.currentIndex).toBe(-1);
      expect(timeline.branches.get('main')).toEqual([]);
      expect(timeline.currentBranch).toBe('main');
    });

    it('should reset state machine to EMPTY after clear', () => {
      manager.clear();
      expect(manager.getTimelineState()).toBe(TimelineState.EMPTY);
    });

    it('should allow adding initial state after clear', () => {
      manager.clear();
      manager.addInitialState(mockStats, mockOptimization);

      expect(manager.getTimeline().snapshots).toHaveLength(1);
      expect(manager.getTimelineState()).toBe(TimelineState.INITIAL);
    });
  });

  describe('Branching', () => {
    beforeEach(() => {
      manager.addInitialState(mockStats, mockOptimization);
      manager.addMergeState(mockStats, mockOptimization, {
        targetColorId: 'T0',
        sourceColorIds: ['T1'],
        freedSlots: ['slot1'],
        description: 'Test merge',
      });
    });

    it('should create new branch from current state', () => {
      const result = manager.createBranch('test-branch');

      expect(result).toBe(true);
      expect(manager.getTimeline().currentBranch).toBe('test-branch');
      expect(manager.getTimeline().branches.has('test-branch')).toBe(true);
    });

    it('should not allow duplicate branch names', () => {
      manager.createBranch('test-branch');
      const result = manager.createBranch('test-branch');

      expect(result).toBe(false);
    });

    it('should switch between branches', () => {
      manager.createBranch('test-branch');
      const result = manager.switchBranch('main');

      expect(result).toBeDefined();
      expect(manager.getTimeline().currentBranch).toBe('main');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty timeline gracefully', () => {
      expect(manager.getCurrentSnapshot()).toBeNull();
      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(false);
    });

    it('should handle operations on cleared timeline', () => {
      manager.addInitialState(mockStats, mockOptimization);
      manager.clear();

      // These should all handle empty state gracefully
      expect(manager.getCurrentSnapshot()).toBeNull();
      expect(manager.undo()).toBeNull();
      expect(manager.redo()).toBeNull();
      expect(manager.reset()).toBeNull();
    });

    it('should preserve data integrity during state transitions', () => {
      manager.addInitialState(mockStats, mockOptimization);
      const initialSnapshot = manager.getCurrentSnapshot()!;

      manager.addMergeState(mockStats, mockOptimization, {
        targetColorId: 'T0',
        sourceColorIds: ['T1'],
        freedSlots: ['slot1'],
        description: 'Test merge',
      });

      // Initial snapshot should remain unchanged
      const timeline = manager.getTimeline();
      expect(timeline.snapshots[0].id).toBe(initialSnapshot.id);
      expect(timeline.snapshots[0].mergeInfo).toBeUndefined();
    });
  });

  describe('Workflow integration tests', () => {
    it('should handle complete file upload -> merge -> reset workflow', () => {
      // Simulate file upload
      manager.clear();
      manager.addInitialState(mockStats, mockOptimization);
      expect(manager.getTimelineState()).toBe(TimelineState.INITIAL);

      // Simulate merge operation
      manager.addMergeState(mockStats, mockOptimization, {
        targetColorId: 'T0',
        sourceColorIds: ['T1'],
        freedSlots: ['slot1'],
        description: 'Merge operation',
      });
      expect(manager.getTimelineState()).toBe(TimelineState.AT_SNAPSHOT);

      // Simulate new file upload (should clear and reinitialize)
      manager.clear();
      manager.addInitialState(mockStats, mockOptimization);
      expect(manager.getTimelineState()).toBe(TimelineState.INITIAL);
      expect(manager.getTimeline().snapshots).toHaveLength(1);
    });

    it('should handle multiple merges in sequence', () => {
      manager.addInitialState(mockStats, mockOptimization);

      for (let i = 0; i < 3; i++) {
        manager.addMergeState(mockStats, mockOptimization, {
          targetColorId: 'T0',
          sourceColorIds: [`T${i + 1}`],
          freedSlots: [`slot${i + 1}`],
          description: `Merge ${i + 1}`,
        });
      }

      expect(manager.getTimeline().snapshots).toHaveLength(4); // 1 initial + 3 merges
      expect(manager.getTimelineState()).toBe(TimelineState.AT_SNAPSHOT);
      expect(manager.canUndo()).toBe(true);
    });
  });
});
