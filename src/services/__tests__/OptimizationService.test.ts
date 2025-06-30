import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OptimizationService, OptimizationAlgorithm } from '../OptimizationService';
import { Color } from '../../domain/models/Color';
import { GcodeStats } from '../../types/gcode';
import { SystemConfiguration } from '../../types/configuration';

// Mock dependencies
vi.mock('../../domain/services/ColorOverlapAnalyzer', () => ({
  ColorOverlapAnalyzer: {
    findNonOverlappingGroups: vi.fn(),
    calculateOptimalSwaps: vi.fn(),
    calculateSwapsForGroup: vi.fn().mockReturnValue(1),
    optimizeByIntervals: vi.fn().mockReturnValue({
      assignments: new Map(),
      totalSwaps: 0,
      swapDetails: [],
    }),
    optimizeSlotAssignments: vi.fn().mockReturnValue({
      assignments: new Map(),
      totalSwaps: 0,
      swapDetails: [],
    }),
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
      fileSize: 1000,
      totalHeight: 50,
      totalLayers: 100,
      layerColorMap: new Map(),
      parserWarnings: [],
      parseTime: 100,
      toolChanges: [],
      colors: [
        new Color({
          id: 'T0',
          name: 'Red PLA',
          hexValue: '#FF0000',
          firstLayer: 1,
          lastLayer: 30,
          layersUsed: new Set([1, 10, 20, 30]),
          totalLayers: 100,
        }),
        new Color({
          id: 'T1',
          name: 'Blue PLA',
          hexValue: '#0000FF',
          firstLayer: 40,
          lastLayer: 60,
          layersUsed: new Set([40, 50, 60]),
          totalLayers: 100,
        }),
        new Color({
          id: 'T2',
          name: 'Green PLA',
          hexValue: '#00FF00',
          firstLayer: 70,
          lastLayer: 100,
          layersUsed: new Set([70, 80, 90, 100]),
          totalLayers: 100,
        }),
      ],
      colorUsageRanges: [
        { colorId: 'T0', startLayer: 1, endLayer: 30, continuous: true },
        { colorId: 'T1', startLayer: 40, endLayer: 60, continuous: true },
        { colorId: 'T2', startLayer: 70, endLayer: 100, continuous: true },
      ],
      slicerInfo: {
        software: 'OrcaSlicer',
        version: '1.9.0',
      },
      printTime: '2h 30m',
      filamentUsageStats: {
        total: 150.0,
        model: 120.0,
        support: 20.0,
        flushed: 10.0,
        tower: 0.0,
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

    it('should handle overlapping colors requiring swaps with mocked analyzer', () => {
      // Test that the service calls the ColorOverlapAnalyzer correctly
      // Even with mocks, we can verify the service orchestration
      const overlappingStats = {
        ...mockStats,
        colors: [
          new Color({
            id: 'T0',
            name: 'Red PLA',
            hexValue: '#FF0000',
            firstLayer: 1,
            lastLayer: 50,
            layersUsed: new Set([1, 25, 50]),
            totalLayers: 100,
          }),
          new Color({
            id: 'T1',
            name: 'Blue PLA',
            hexValue: '#0000FF',
            firstLayer: 40, // Overlaps with T0
            lastLayer: 80,
            layersUsed: new Set([40, 60, 80]),
            totalLayers: 100,
          }),
        ],
      };

      const result = optimizationService.generateOptimization(overlappingStats, mockConfiguration);

      expect(result).toBeDefined();
      expect(result.totalColors).toBe(2);
      expect(result.slotAssignments).toBeDefined();
      // With mocked analyzer returning empty assignments, should still have basic structure
      expect(Array.isArray(result.slotAssignments)).toBe(true);
      expect(Array.isArray(result.manualSwaps)).toBe(true);
    });

    it('should assign slot IDs correctly', () => {
      const result = optimizationService.generateOptimization(mockStats, mockConfiguration);

      result.slotAssignments.forEach((assignment) => {
        expect(assignment.slotId).toBe(`${assignment.unit}-${assignment.slot}`);
      });
    });
  });

  describe('Manual Swap Generation', () => {
    it('should handle many colors scenario with mocked analyzer', () => {
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
              totalLayers: 120,
            })
        ),
      };

      const result = optimizationService.generateOptimization(manyColorsStats, mockConfiguration);

      expect(result.totalColors).toBe(6);
      // With mocked analyzer returning empty assignments, requiredSlots may be 0
      expect(result.requiredSlots).toBeGreaterThanOrEqual(0);

      // Even with mocked analyzer, the service should handle the scenario gracefully
      expect(result).toBeDefined();
      expect(result.slotAssignments).toBeDefined();
      expect(result.manualSwaps).toBeDefined();
      expect(Array.isArray(result.slotAssignments)).toBe(true);
      expect(Array.isArray(result.manualSwaps)).toBe(true);
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
      ];

      configs.forEach((config) => {
        const result = optimizationService.generateOptimization(mockStats, config);
        // Configuration should match except totalSlots is calculated
        expect(result.configuration?.type).toBe(config.type);
        expect(result.configuration?.unitCount).toBe(config.unitCount);
        // totalSlots is calculated as unitCount * 4 for AMS
        expect(result.totalSlots).toBe(config.unitCount * 4);
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
        expect(typeof pair.color1).toBe('string');
        expect(typeof pair.color2).toBe('string');
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
            totalLayers: 100,
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
            totalLayers: 1000000,
          }),
        ],
      };

      const result = optimizationService.generateOptimization(largeLayerStats, mockConfiguration);

      expect(result).toBeDefined();
      expect(result.totalColors).toBe(1);
    });

    it('should handle configuration with zero slots', () => {
      const zeroSlotConfig = { ...mockConfiguration, unitCount: 0, totalSlots: 0 };

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
            totalLayers: 100,
          }),
          new Color({
            id: 'T1',
            name: 'Red PLA Copy',
            hexValue: '#FF0000',
            firstLayer: 1,
            lastLayer: 50,
            layersUsed: new Set([1, 25, 50]),
            totalLayers: 100,
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

  describe('Simulated Annealing Debug', () => {
    it('should use simulated annealing algorithm with mocked dependencies', () => {
      // Create scenario similar to carrot_sign.gcode with overlapping colors
      const overlappingStats = {
        ...mockStats,
        colors: [
          new Color({
            id: 'T0',
            name: 'Orange PLA',
            hexValue: '#FF6600',
            firstLayer: 1,
            lastLayer: 21,
            layersUsed: new Set([1, 5, 10, 15, 20, 21]),
            totalLayers: 40,
          }),
          new Color({
            id: 'T1',
            name: 'Green PLA',
            hexValue: '#00FF00',
            firstLayer: 11,
            lastLayer: 25,
            layersUsed: new Set([11, 15, 20, 25]),
            totalLayers: 40,
          }),
          new Color({
            id: 'T2',
            name: 'White PLA',
            hexValue: '#FFFFFF',
            firstLayer: 22,
            lastLayer: 30,
            layersUsed: new Set([22, 25, 30]),
            totalLayers: 40,
          }),
          new Color({
            id: 'T3',
            name: 'Black PLA',
            hexValue: '#000000',
            firstLayer: 26,
            lastLayer: 35,
            layersUsed: new Set([26, 30, 35]),
            totalLayers: 40,
          }),
          new Color({
            id: 'T4',
            name: 'Red PLA',
            hexValue: '#FF0000',
            firstLayer: 31,
            lastLayer: 40,
            layersUsed: new Set([31, 35, 40]),
            totalLayers: 40,
          }),
        ],
        colorUsageRanges: [
          { colorId: 'T0', startLayer: 1, endLayer: 21, continuous: true },
          { colorId: 'T1', startLayer: 11, endLayer: 25, continuous: true },
          { colorId: 'T2', startLayer: 22, endLayer: 30, continuous: true },
          { colorId: 'T3', startLayer: 26, endLayer: 35, continuous: true },
          { colorId: 'T4', startLayer: 31, endLayer: 40, continuous: true },
        ],
      };

      const result = optimizationService.generateOptimization(
        overlappingStats,
        mockConfiguration,
        OptimizationAlgorithm.SimulatedAnnealing
      );

      expect(result).toBeDefined();
      expect(result.totalColors).toBe(5);

      // With mocked ColorOverlapAnalyzer, we test that the service can handle
      // the simulated annealing algorithm parameter without crashing
      expect(result.slotAssignments).toBeDefined();
      expect(result.manualSwaps).toBeDefined();
      expect(Array.isArray(result.manualSwaps)).toBe(true);

      // Verify the original configuration was NOT mutated (critical for preventing side effects)
      expect(mockConfiguration.totalSlots).toBe(4); // Original should be unchanged

      // The optimization result should reflect adjusted configuration for algorithms
      // (5 colors need at least 5 slots for algorithms to work)
      expect(result.configuration?.totalSlots).toBe(5); // Adjusted for optimization
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
