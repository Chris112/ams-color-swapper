import { describe, it, expect } from 'vitest';
import { OptimizationService } from '../OptimizationService';
import { SystemConfiguration } from '../../types/configuration';
import { GcodeStats } from '../../types/gcode';
import { Color } from '../../domain/models/Color';

describe('Configuration Bug Regression Tests', () => {
  describe('Merge Operation Configuration Corruption', () => {
    it('should preserve original configuration through multiple merge operations', () => {
      // This test recreates the exact bug scenario:
      // 1. User configures 2 toolheads (2 slots)
      // 2. Upload 6-color file -> shows violations (correct)
      // 3. Merge colors -> previously corrupted config from 2 to 6 slots
      // 4. After merge -> should still show violations for remaining colors vs 2 slots

      const userConfig: SystemConfiguration = {
        type: 'toolhead',
        unitCount: 2,
        totalSlots: 2, // User has 2 toolheads
        parserAlgorithm: 'optimized',
      };

      // Capture the original config state
      const originalConfigSnapshot = JSON.parse(JSON.stringify(userConfig));

      // Create 6-color stats (like Slowbro)
      const create6ColorStats = (): GcodeStats => ({
        fileName: '6_color_Slowbro.gcode',
        fileSize: 5000000,
        totalLayers: 197,
        totalHeight: 39.4,
        colors: [
          new Color({
            id: 'T0',
            name: 'Pink PLA',
            hexValue: '#FF80C0',
            firstLayer: 0,
            lastLayer: 196,
            layersUsed: new Set(Array.from({ length: 197 }, (_, i) => i)),
            totalLayers: 197,
          }),
          new Color({
            id: 'T1',
            name: 'White PLA',
            hexValue: '#FFFFFF',
            firstLayer: 0,
            lastLayer: 72,
            layersUsed: new Set(Array.from({ length: 73 }, (_, i) => i)),
            totalLayers: 197,
          }),
          new Color({
            id: 'T2',
            name: 'Black PLA',
            hexValue: '#000000',
            firstLayer: 72,
            lastLayer: 196,
            layersUsed: new Set(Array.from({ length: 125 }, (_, i) => i + 72)),
            totalLayers: 197,
          }),
          new Color({
            id: 'T3',
            name: 'Cream PLA',
            hexValue: '#ECE1BB',
            firstLayer: 3,
            lastLayer: 196,
            layersUsed: new Set(Array.from({ length: 194 }, (_, i) => i + 3)),
            totalLayers: 197,
          }),
          new Color({
            id: 'T4',
            name: 'Gray PLA',
            hexValue: '#808080',
            firstLayer: 0,
            lastLayer: 196,
            layersUsed: new Set(Array.from({ length: 197 }, (_, i) => i)),
            totalLayers: 197,
          }),
          new Color({
            id: 'T5',
            name: 'Dark Gray PLA',
            hexValue: '#5C5C5C',
            firstLayer: 50,
            lastLayer: 196,
            layersUsed: new Set(Array.from({ length: 147 }, (_, i) => i + 50)),
            totalLayers: 197,
          }),
        ],
        toolChanges: [],
        layerColorMap: new Map([
          // Create layer color map that shows multiple colors are used simultaneously
          // This will trigger constraint violations when there are only 2 slots available
          [1, ['T0', 'T1', 'T4']], // 3 colors > 2 slots = violation
          [10, ['T0', 'T1', 'T3', 'T4']], // 4 colors > 2 slots = violation
          [50, ['T0', 'T1', 'T3', 'T4', 'T5']], // 5 colors > 2 slots = violation
          [100, ['T0', 'T2', 'T3', 'T4', 'T5']], // 5 colors > 2 slots = violation
          [150, ['T0', 'T2', 'T3', 'T4', 'T5']], // 5 colors > 2 slots = violation
          [196, ['T0', 'T2', 'T3', 'T4', 'T5']], // 5 colors > 2 slots = violation
        ]),
        colorUsageRanges: [],
        parserWarnings: [],
        parseTime: 2000,
      });

      const optimizationService = new OptimizationService();

      // STEP 1: Initial upload with 6 colors and 2 slots
      const initialStats = create6ColorStats();
      optimizationService.generateOptimization(initialStats, userConfig);

      // Verify constraint validation detects violations
      expect(initialStats.constraintValidation?.hasViolations).toBe(true);
      expect(initialStats.constraintValidation?.summary.availableSlots).toBe(2);
      expect(initialStats.constraintValidation?.summary.maxColorsRequired).toBeGreaterThan(2);

      // CRITICAL: User config must remain unchanged after first optimization
      expect(userConfig).toEqual(originalConfigSnapshot);
      expect(userConfig.totalSlots).toBe(2);

      // STEP 2: Simulate merge operation (T5 -> T4, reducing to 5 colors)
      const afterMergeStats = create6ColorStats();
      // Remove T5 from colors array (simulating merge)
      afterMergeStats.colors = afterMergeStats.colors.filter((c) => c.id !== 'T5');

      optimizationService.generateOptimization(afterMergeStats, userConfig);

      // CRITICAL: User config must STILL remain unchanged after merge operation
      expect(userConfig).toEqual(originalConfigSnapshot);
      expect(userConfig.totalSlots).toBe(2); // Must still be 2, not corrupted to 5 or 6

      // Constraint validation should still detect violations (5 colors vs 2 slots)
      expect(afterMergeStats.constraintValidation?.hasViolations).toBe(true);
      expect(afterMergeStats.constraintValidation?.summary.availableSlots).toBe(2);
      expect(afterMergeStats.constraintValidation?.summary.maxColorsRequired).toBeGreaterThan(2);

      // STEP 3: Another merge operation (T3 -> T1, reducing to 4 colors)
      const afterSecondMergeStats = create6ColorStats();
      afterSecondMergeStats.colors = afterSecondMergeStats.colors.filter(
        (c) => c.id !== 'T5' && c.id !== 'T3'
      );

      optimizationService.generateOptimization(afterSecondMergeStats, userConfig);

      // CRITICAL: User config must STILL remain unchanged after multiple merges
      expect(userConfig).toEqual(originalConfigSnapshot);
      expect(userConfig.totalSlots).toBe(2); // Still 2, never corrupted

      // Should still have violations (4 colors vs 2 slots)
      expect(afterSecondMergeStats.constraintValidation?.hasViolations).toBe(true);
      expect(afterSecondMergeStats.constraintValidation?.summary.availableSlots).toBe(2);

      // STEP 4: Final merge to get down to 2 colors (should resolve violations)
      const finalStats = create6ColorStats();
      finalStats.colors = finalStats.colors.filter((c) => c.id === 'T0' || c.id === 'T1');
      // Update layerColorMap to only show the 2 remaining colors
      finalStats.layerColorMap = new Map([
        [1, ['T0', 'T1']], // 2 colors = 2 slots = no violation
        [10, ['T0', 'T1']], // 2 colors = 2 slots = no violation
        [50, ['T0', 'T1']], // 2 colors = 2 slots = no violation
        [100, ['T0', 'T1']], // 2 colors = 2 slots = no violation
        [150, ['T0', 'T1']], // 2 colors = 2 slots = no violation
        [196, ['T0', 'T1']], // 2 colors = 2 slots = no violation
      ]);

      optimizationService.generateOptimization(finalStats, userConfig);

      // CRITICAL: User config must remain unchanged even when violations are resolved
      expect(userConfig).toEqual(originalConfigSnapshot);
      expect(userConfig.totalSlots).toBe(2);

      // Now violations should be resolved (2 colors vs 2 slots)
      expect(finalStats.constraintValidation?.hasViolations).toBe(false);
      expect(finalStats.constraintValidation?.summary.availableSlots).toBe(2);
    });

    it('should handle the original bug scenario from user reports', () => {
      // This recreates the exact scenario reported:
      // "after my first merge, all of the warnings go away and i get the success alert"

      const userConfig: SystemConfiguration = {
        type: 'toolhead',
        unitCount: 2,
        totalSlots: 2,
      };

      const before = JSON.parse(JSON.stringify(userConfig));

      // 6 colors -> should have violations
      const sixColorStats: GcodeStats = {
        fileName: 'test.gcode',
        fileSize: 1000,
        totalLayers: 100,
        totalHeight: 20,
        colors: Array.from(
          { length: 6 },
          (_, i) =>
            new Color({
              id: `T${i}`,
              name: `Color ${i}`,
              hexValue: '#FF0000',
              firstLayer: 1,
              lastLayer: 100,
              layersUsed: new Set([1, 50, 100]),
              totalLayers: 100,
            })
        ),
        toolChanges: [],
        layerColorMap: new Map([
          [1, ['T0', 'T1', 'T2']], // 3 colors > 2 slots = violation
          [50, ['T0', 'T1', 'T2', 'T3']], // 4 colors > 2 slots = violation
          [100, ['T0', 'T1', 'T2', 'T3', 'T4', 'T5']], // 6 colors > 2 slots = violation
        ]),
        colorUsageRanges: [],
        parserWarnings: [],
        parseTime: 100,
      };

      const optimizationService = new OptimizationService();

      // First optimization: 6 colors vs 2 slots -> violations
      optimizationService.generateOptimization(sixColorStats, userConfig);
      expect(sixColorStats.constraintValidation?.hasViolations).toBe(true);
      expect(userConfig).toEqual(before); // Config unchanged

      // After merge: 5 colors -> should STILL have violations
      const fiveColorStats: GcodeStats = {
        ...sixColorStats,
        colors: sixColorStats.colors.slice(0, 5), // Remove one color
        layerColorMap: new Map([
          [1, ['T0', 'T1', 'T2']], // 3 colors > 2 slots = violation
          [50, ['T0', 'T1', 'T2', 'T3']], // 4 colors > 2 slots = violation
          [100, ['T0', 'T1', 'T2', 'T3', 'T4']], // 5 colors > 2 slots = violation
        ]),
      };

      optimizationService.generateOptimization(fiveColorStats, userConfig);

      // THE BUG: Previously this would show no violations because config was corrupted
      // THE FIX: Now it correctly shows violations because config stays at 2 slots
      expect(fiveColorStats.constraintValidation?.hasViolations).toBe(true);
      expect(fiveColorStats.constraintValidation?.summary.availableSlots).toBe(2);
      expect(userConfig.totalSlots).toBe(2); // Config never corrupted
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined configurations without mutation', () => {
      const mockStats: GcodeStats = {
        fileName: 'test.gcode',
        fileSize: 1000,
        totalLayers: 10,
        totalHeight: 20,
        colors: [
          new Color({
            id: 'T0',
            name: 'Red PLA',
            hexValue: '#FF0000',
            firstLayer: 1,
            lastLayer: 10,
            layersUsed: new Set([1, 5, 10]),
            totalLayers: 10,
          }),
        ],
        toolChanges: [],
        layerColorMap: new Map(),
        colorUsageRanges: [],
        parserWarnings: [],
        parseTime: 100,
      };

      const optimizationService = new OptimizationService();

      // Test with undefined config (should use default)
      const result1 = optimizationService.generateOptimization(mockStats, undefined);
      expect(result1.configuration?.type).toBe('ams');
      expect(result1.configuration?.totalSlots).toBe(4);

      // Test with null config (should use default)
      const result2 = optimizationService.generateOptimization(mockStats, null as any);
      expect(result2.configuration?.type).toBe('ams');
      expect(result2.configuration?.totalSlots).toBe(4);
    });
  });
});
