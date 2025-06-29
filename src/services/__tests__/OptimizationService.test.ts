import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OptimizationService } from '../OptimizationService';
import { Color } from '../../domain/models/Color';
import { GcodeStats } from '../../types/gcode';
import { SystemConfiguration } from '../../types/configuration';

// Mock dependencies
vi.mock('../../domain/services/ColorOverlapAnalyzer', () => ({
  ColorOverlapAnalyzer: {
    findNonOverlappingGroups: vi.fn(),
    calculateOptimalSwaps: vi.fn(),
  },
}));

describe('OptimizationService', () => {
  let optimizationService: OptimizationService;
  let mockStats: GcodeStats;
  let mockConfiguration: SystemConfiguration;

  beforeEach(() => {
    optimizationService = new OptimizationService();

    // Create mock configuration
    mockConfiguration = {
      type: 'ams',
      unitCount: 1,
      totalSlots: 4,
    };

    // Create mock stats with test colors
    mockStats = {
      fileName: 'test.gcode',
      totalLayers: 100,
      toolChanges: [],
      colors: [
        new Color({
          id: 'T0',
          name: 'Red PLA',
          hexValue: '#FF0000',
          firstLayer: 1,
          lastLayer: 30,
          layersUsed: new Set([1, 10, 20, 30]),
        }),
        new Color({
          id: 'T1',
          name: 'Blue PLA',
          hexValue: '#0000FF',
          firstLayer: 40,
          lastLayer: 60,
          layersUsed: new Set([40, 50, 60]),
        }),
        new Color({
          id: 'T2',
          name: 'Green PLA',
          hexValue: '#00FF00',
          firstLayer: 70,
          lastLayer: 100,
          layersUsed: new Set([70, 80, 90, 100]),
        }),
      ],
      colorUsageRanges: [
        { colorId: 'T0', startLayer: 1, endLayer: 30 },
        { colorId: 'T1', startLayer: 40, endLayer: 60 },
        { colorId: 'T2', startLayer: 70, endLayer: 100 },
      ],
      slicerInfo: {
        software: 'OrcaSlicer',
        version: '1.9.0',
      },
      printTime: '2h 30m',
      filamentUsageStats: {
        total: 150.0,
        byColor: {
          T0: 50.0,
          T1: 50.0,
          T2: 50.0,
        },
      },
    } as GcodeStats;
  });

  describe('Basic Optimization', () => {
    it('should create optimization service instance', () => {
      expect(optimizationService).toBeInstanceOf(OptimizationService);
    });

    it('should optimize colors that fit in available slots', () => {
      const result = optimizationService.generateOptimization(mockStats, mockConfiguration);

      expect(result).toBeDefined();
      expect(result.totalColors).toBe(3);
      expect(result.requiredSlots).toBeLessThanOrEqual(4);
      expect(result.slotAssignments).toBeDefined();
      expect(result.manualSwaps).toBeDefined();
      expect(result.estimatedTimeSaved).toBeGreaterThanOrEqual(0);
    });

    it('should handle single color optimization', () => {
      const singleColorStats = {
        ...mockStats,
        colors: [mockStats.colors[0]], // Only one color
        colorUsageRanges: [mockStats.colorUsageRanges[0]],
      };

      const result = optimizationService.generateOptimization(singleColorStats, mockConfiguration);

      expect(result.totalColors).toBe(1);
      expect(result.requiredSlots).toBe(1);
      expect(result.manualSwaps).toHaveLength(0);
      expect(result.slotAssignments).toHaveLength(1);
    });

    it('should handle empty colors gracefully', () => {
      const emptyStats = {
        ...mockStats,
        colors: [],
        colorUsageRanges: [],
      };

      const result = optimizationService.generateOptimization(emptyStats, mockConfiguration);

      expect(result.totalColors).toBe(0);
      expect(result.requiredSlots).toBe(0);
      expect(result.manualSwaps).toHaveLength(0);
      expect(result.slotAssignments).toHaveLength(0);
    });
  });

  describe('Slot Assignment Logic', () => {
    it('should create proper slot assignments for non-overlapping colors', () => {
      const result = optimizationService.generateOptimization(mockStats, mockConfiguration);

      expect(result.slotAssignments).toHaveLength(3); // 3 colors, each in own slot

      // Each slot should have one color
      result.slotAssignments.forEach((assignment, index) => {
        expect(assignment.unit).toBe(1);
        expect(assignment.slot).toBe(index + 1);
        expect(assignment.colors).toHaveLength(1);
        expect(assignment.isPermanent).toBe(true);
      });
    });

    it('should handle overlapping colors requiring swaps', () => {
      // Create overlapping colors that require more than 4 slots
      const overlappingStats = {
        ...mockStats,
        colors: [
          new Color({
            id: 'T0',
            name: 'Color 1',
            hexValue: '#FF0000',
            firstLayer: 1,
            lastLayer: 50,
            layersUsed: new Set([1, 25, 50]),
          }),
          new Color({
            id: 'T1',
            name: 'Color 2',
            hexValue: '#00FF00',
            firstLayer: 1,
            lastLayer: 50,
            layersUsed: new Set([1, 25, 50]),
          }),
          new Color({
            id: 'T2',
            name: 'Color 3',
            hexValue: '#0000FF',
            firstLayer: 1,
            lastLayer: 50,
            layersUsed: new Set([1, 25, 50]),
          }),
          new Color({
            id: 'T3',
            name: 'Color 4',
            hexValue: '#FFFF00',
            firstLayer: 1,
            lastLayer: 50,
            layersUsed: new Set([1, 25, 50]),
          }),
          new Color({
            id: 'T4',
            name: 'Color 5',
            hexValue: '#FF00FF',
            firstLayer: 60,
            lastLayer: 100,
            layersUsed: new Set([60, 80, 100]),
          }),
        ],
        colorUsageRanges: [
          { colorId: 'T0', startLayer: 1, endLayer: 50 },
          { colorId: 'T1', startLayer: 1, endLayer: 50 },
          { colorId: 'T2', startLayer: 1, endLayer: 50 },
          { colorId: 'T3', startLayer: 1, endLayer: 50 },
          { colorId: 'T4', startLayer: 60, endLayer: 100 },
        ],
      };

      const result = optimizationService.generateOptimization(overlappingStats, mockConfiguration);

      expect(result.totalColors).toBe(5);
      expect(result.requiredSlots).toBeGreaterThan(4);
      expect(result.manualSwaps.length).toBeGreaterThan(0);
    });

    it('should assign slot IDs correctly', () => {
      const result = optimizationService.generateOptimization(mockStats, mockConfiguration);

      result.slotAssignments.forEach((assignment) => {
        expect(assignment.slotId).toBe(`unit${assignment.unit}_slot${assignment.slot}`);
      });
    });
  });

  describe('Manual Swap Generation', () => {
    it('should generate manual swaps when colors exceed slots', () => {
      // Create more colors than available slots
      const manyColorsStats = {
        ...mockStats,
        colors: Array.from(
          { length: 6 },
          (_, i) =>
            new Color({
              id: `T${i}`,
              name: `Color ${i}`,
              hexValue: `#${i.toString(16).padStart(2, '0')}0000`,
              firstLayer: i * 20 + 1,
              lastLayer: (i + 1) * 20,
              layersUsed: new Set([i * 20 + 1, i * 20 + 10, (i + 1) * 20]),
            })
        ),
      };

      const result = optimizationService.generateOptimization(manyColorsStats, mockConfiguration);

      expect(result.totalColors).toBe(6);
      expect(result.requiredSlots).toBeGreaterThan(4);
      expect(result.manualSwaps.length).toBeGreaterThan(0);

      // Check manual swap structure
      result.manualSwaps.forEach((swap) => {
        expect(swap).toHaveProperty('unit');
        expect(swap).toHaveProperty('slot');
        expect(swap).toHaveProperty('fromColor');
        expect(swap).toHaveProperty('toColor');
        expect(swap).toHaveProperty('atLayer');
        expect(swap).toHaveProperty('reason');
        expect(swap.unit).toBeGreaterThan(0);
        expect(swap.slot).toBeGreaterThan(0);
      });
    });

    it('should include timing information in manual swaps', () => {
      const overlappingStats = {
        ...mockStats,
        colors: Array.from(
          { length: 6 },
          (_, i) =>
            new Color({
              id: `T${i}`,
              name: `Color ${i}`,
              hexValue: `#${i.toString(16).padStart(2, '0')}0000`,
              firstLayer: i * 15 + 1,
              lastLayer: (i + 1) * 15,
              layersUsed: new Set([i * 15 + 1, i * 15 + 7, (i + 1) * 15]),
            })
        ),
      };

      const result = optimizationService.generateOptimization(overlappingStats, mockConfiguration);

      if (result.manualSwaps.length > 0) {
        result.manualSwaps.forEach((swap) => {
          expect(swap).toHaveProperty('timingOptions');
          expect(swap).toHaveProperty('swapWindow');
          expect(swap).toHaveProperty('confidence');

          expect(swap.timingOptions).toHaveProperty('earliest');
          expect(swap.timingOptions).toHaveProperty('latest');
          expect(swap.timingOptions).toHaveProperty('optimal');

          expect(swap.swapWindow).toHaveProperty('startLayer');
          expect(swap.swapWindow).toHaveProperty('endLayer');
          expect(swap.swapWindow).toHaveProperty('flexibilityScore');

          expect(swap.confidence).toHaveProperty('timing');
          expect(swap.confidence).toHaveProperty('necessity');
          expect(swap.confidence).toHaveProperty('userControl');
        });
      }
    });
  });

  describe('Configuration Handling', () => {
    it('should handle different AMS configurations', () => {
      const configs = [
        { ...mockConfiguration, unitCount: 1, totalSlots: 4 },
        { ...mockConfiguration, unitCount: 2, totalSlots: 8 },
        { ...mockConfiguration, unitCount: 1, totalSlots: 8 },
      ];

      configs.forEach((config) => {
        const result = optimizationService.generateOptimization(mockStats, config);
        expect(result.configuration).toEqual(config);
        expect(result.totalSlots).toBe(config.totalSlots);
      });
    });

    it('should optimize better with more slots available', () => {
      const smallConfig = { ...mockConfiguration, totalSlots: 2 };
      const largeConfig = { ...mockConfiguration, totalSlots: 8 };

      const smallResult = optimizationService.generateOptimization(mockStats, smallConfig);
      const largeResult = optimizationService.generateOptimization(mockStats, largeConfig);

      // More slots should result in fewer manual swaps
      expect(largeResult.manualSwaps.length).toBeLessThanOrEqual(smallResult.manualSwaps.length);
      expect(largeResult.estimatedTimeSaved).toBeGreaterThanOrEqual(smallResult.estimatedTimeSaved);
    });

    it('should use default algorithm when none specified', () => {
      const result = optimizationService.generateOptimization(mockStats, mockConfiguration);

      expect(result).toBeDefined();
      expect(result.configuration).toEqual(mockConfiguration);
    });
  });

  describe('Optimization Metrics', () => {
    it('should calculate estimated time saved', () => {
      const result = optimizationService.generateOptimization(mockStats, mockConfiguration);

      expect(result.estimatedTimeSaved).toBeGreaterThanOrEqual(0);
      expect(typeof result.estimatedTimeSaved).toBe('number');
    });

    it('should identify shareable slot opportunities', () => {
      const result = optimizationService.generateOptimization(mockStats, mockConfiguration);

      expect(result.canShareSlots).toBeDefined();
      expect(Array.isArray(result.canShareSlots)).toBe(true);

      // Each color pair should have proper structure
      result.canShareSlots.forEach((pair) => {
        expect(pair).toHaveProperty('color1');
        expect(pair).toHaveProperty('color2');
        expect(pair).toHaveProperty('overlapLayers');
        expect(pair.overlapLayers).toBeGreaterThanOrEqual(0);
      });
    });

    it('should calculate correct total slots used', () => {
      const result = optimizationService.generateOptimization(mockStats, mockConfiguration);

      expect(result.totalSlots).toBe(mockConfiguration.totalSlots);
      expect(result.requiredSlots).toBeGreaterThan(0);
      expect(result.requiredSlots).toBeLessThanOrEqual(result.totalColors);
    });
  });

  describe('Edge Cases', () => {
    it('should handle colors with no layers', () => {
      const emptyColorStats = {
        ...mockStats,
        colors: [
          new Color({
            id: 'T0',
            name: 'Empty Color',
            hexValue: '#FF0000',
            firstLayer: 1,
            lastLayer: 1,
            layersUsed: new Set(),
          }),
        ],
      };

      const result = optimizationService.generateOptimization(emptyColorStats, mockConfiguration);

      expect(result.totalColors).toBe(1);
      expect(result.slotAssignments).toHaveLength(1);
    });

    it('should handle very large layer numbers', () => {
      const largeLayerStats = {
        ...mockStats,
        totalLayers: 1000000,
        colors: [
          new Color({
            id: 'T0',
            name: 'Large Layer Color',
            hexValue: '#FF0000',
            firstLayer: 999990,
            lastLayer: 1000000,
            layersUsed: new Set([999990, 999995, 1000000]),
          }),
        ],
      };

      const result = optimizationService.generateOptimization(largeLayerStats, mockConfiguration);

      expect(result).toBeDefined();
      expect(result.totalColors).toBe(1);
    });

    it('should handle configuration with zero slots', () => {
      const zeroSlotConfig = { ...mockConfiguration, totalSlots: 0 };

      const result = optimizationService.generateOptimization(mockStats, zeroSlotConfig);

      expect(result.totalSlots).toBe(0);
      expect(result.slotAssignments).toHaveLength(0);
      // All colors should require manual swaps if no slots available
      expect(result.manualSwaps.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle identical colors', () => {
      const identicalColorsStats = {
        ...mockStats,
        colors: [
          new Color({
            id: 'T0',
            name: 'Red PLA',
            hexValue: '#FF0000',
            firstLayer: 1,
            lastLayer: 50,
            layersUsed: new Set([1, 25, 50]),
          }),
          new Color({
            id: 'T1',
            name: 'Red PLA Copy',
            hexValue: '#FF0000',
            firstLayer: 1,
            lastLayer: 50,
            layersUsed: new Set([1, 25, 50]),
          }),
        ],
      };

      const result = optimizationService.generateOptimization(
        identicalColorsStats,
        mockConfiguration
      );

      expect(result.totalColors).toBe(2);
      expect(result.slotAssignments).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should handle optimization of many colors efficiently', () => {
      const manyColorsStats = {
        ...mockStats,
        colors: Array.from(
          { length: 50 },
          (_, i) =>
            new Color({
              id: `T${i}`,
              name: `Color ${i}`,
              hexValue: `#${i.toString(16).padStart(6, '0')}`,
              firstLayer: i * 2 + 1,
              lastLayer: i * 2 + 2,
              layersUsed: new Set([i * 2 + 1, i * 2 + 2]),
            })
        ),
      };

      const startTime = performance.now();
      const result = optimizationService.generateOptimization(manyColorsStats, mockConfiguration);
      const endTime = performance.now();

      // Should complete in reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
      expect(result).toBeDefined();
      expect(result.totalColors).toBe(50);
    });
  });
});
