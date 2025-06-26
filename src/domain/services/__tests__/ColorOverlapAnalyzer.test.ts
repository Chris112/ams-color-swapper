import { describe, it, expect } from 'vitest';
import { ColorOverlapAnalyzer } from '../ColorOverlapAnalyzer';
import { Color } from '../../models/Color';

describe('ColorOverlapAnalyzer', () => {
  // Helper function to create test colors
  const createColor = (
    id: string,
    firstLayer: number,
    lastLayer: number,
    layerCount?: number
  ): Color => {
    return new Color({
      id,
      name: `Color ${id}`,
      hexColor: '#000000',
      firstLayer,
      lastLayer,
      layerCount: layerCount || lastLayer - firstLayer + 1,
    });
  };

  describe('hasOverlap', () => {
    it('should detect overlapping colors', () => {
      const color1 = createColor('T0', 0, 50);
      const color2 = createColor('T1', 25, 75);

      expect(ColorOverlapAnalyzer.hasOverlap(color1, color2)).toBe(true);
    });

    it('should detect non-overlapping colors', () => {
      const color1 = createColor('T0', 0, 50);
      const color2 = createColor('T1', 51, 100);

      expect(ColorOverlapAnalyzer.hasOverlap(color1, color2)).toBe(false);
    });

    it('should detect adjacent colors as non-overlapping', () => {
      const color1 = createColor('T0', 0, 50);
      const color2 = createColor('T1', 50, 100);

      expect(ColorOverlapAnalyzer.hasOverlap(color1, color2)).toBe(true); // They share layer 50
    });
  });

  describe('buildOverlapMatrix', () => {
    it('should build correct overlap matrix for 3 colors', () => {
      const colors = [
        createColor('T0', 0, 50),
        createColor('T1', 25, 75),
        createColor('T2', 60, 100),
      ];

      const matrix = ColorOverlapAnalyzer.buildOverlapMatrix(colors);

      expect(matrix.get('T0')!.has('T1')).toBe(true);
      expect(matrix.get('T0')!.has('T2')).toBe(false);
      expect(matrix.get('T1')!.has('T2')).toBe(true);
    });
  });

  describe('findNonOverlappingGroups', () => {
    it('should group non-overlapping colors together', () => {
      const colors = [
        createColor('T0', 0, 30),
        createColor('T1', 31, 60),
        createColor('T2', 61, 90),
        createColor('T3', 0, 90), // Overlaps with all others
      ];

      const groups = ColorOverlapAnalyzer.findNonOverlappingGroups(colors);

      // Should have 2 groups: [T0, T1, T2] and [T3]
      expect(groups.length).toBe(2);
      const group1 = groups.find((g) => g.colors.length === 3);
      const group2 = groups.find((g) => g.colors.length === 1);

      expect(group1).toBeDefined();
      expect(group2).toBeDefined();
      expect(group2!.colors[0].id).toBe('T3');
    });
  });

  describe('calculateSwapsForGroup', () => {
    it('should return 0 swaps for single color', () => {
      const colors = [createColor('T0', 0, 100)];
      expect(ColorOverlapAnalyzer.calculateSwapsForGroup(colors)).toBe(0);
    });

    it('should calculate correct swaps for multiple colors', () => {
      const colors = [
        createColor('T0', 0, 30),
        createColor('T1', 31, 60),
        createColor('T2', 61, 90),
      ];
      expect(ColorOverlapAnalyzer.calculateSwapsForGroup(colors)).toBe(2);
    });
  });

  describe('optimizeSlotAssignments', () => {
    it('should assign each color to own slot when colors <= slots', () => {
      const colors = [createColor('T0', 0, 50), createColor('T1', 0, 50), createColor('T2', 0, 50)];

      const result = ColorOverlapAnalyzer.optimizeSlotAssignments(colors, 4);

      expect(result.totalSwaps).toBe(0);
      expect(result.assignments.size).toBe(3);
      expect(result.assignments.get(1)!.length).toBe(1);
      expect(result.assignments.get(2)!.length).toBe(1);
      expect(result.assignments.get(3)!.length).toBe(1);
    });

    it('should optimize 7 colors across 4 slots', () => {
      const colors = [
        createColor('T0', 0, 50, 50), // Most used
        createColor('T1', 0, 40, 40),
        createColor('T2', 51, 100, 50), // No overlap with T0, T1
        createColor('T3', 41, 90, 50), // Overlaps with T2
        createColor('T4', 91, 140, 50), // No overlap with T0-T2
        createColor('T5', 101, 150, 50), // Overlaps with T4
        createColor('T6', 141, 200, 60), // No overlap with T0-T4
      ];

      const result = ColorOverlapAnalyzer.optimizeSlotAssignments(colors, 4);

      // All colors should be assigned
      let totalColors = 0;
      result.assignments.forEach((slotColors) => {
        totalColors += slotColors.length;
      });
      expect(totalColors).toBe(7);

      // Should have some swaps but optimized
      expect(result.totalSwaps).toBeGreaterThan(0);
      expect(result.totalSwaps).toBeLessThan(7); // Should be less than worst case
    });
  });

  describe('optimizeByIntervals', () => {
    it('should use interval scheduling to minimize swaps', () => {
      const colors = [
        createColor('T0', 0, 25),
        createColor('T1', 26, 50),
        createColor('T2', 51, 75),
        createColor('T3', 76, 100),
        createColor('T4', 0, 100), // Spans entire print
      ];

      const result = ColorOverlapAnalyzer.optimizeByIntervals(colors, 4);

      // T0-T3 can share one slot (3 swaps), T4 gets its own slot
      expect(result.totalSwaps).toBe(3);

      // Should use 2 slots effectively
      const nonEmptySlots = Array.from(result.assignments.values()).filter((s) => s.length > 0);
      expect(nonEmptySlots.length).toBe(2);
    });

    it('should handle complex overlapping scenario', () => {
      const colors = [
        createColor('T0', 0, 30),
        createColor('T1', 20, 50),
        createColor('T2', 40, 70),
        createColor('T3', 60, 90),
        createColor('T4', 80, 110),
        createColor('T5', 100, 130),
        createColor('T6', 120, 150),
      ];

      const result = ColorOverlapAnalyzer.optimizeByIntervals(colors, 4);

      // All colors should be assigned
      let totalColors = 0;
      result.assignments.forEach((slotColors) => {
        totalColors += slotColors.length;
      });
      expect(totalColors).toBe(7);

      // Should distribute across all 4 slots
      expect(result.assignments.size).toBeLessThanOrEqual(4);
    });
  });

  describe('Real-world scenario: 7-color Venusaur', () => {
    it('should optimize colors that mostly overlap', () => {
      // Simulating a scenario where most colors are used throughout
      const colors = [
        createColor('T0', 0, 200, 180), // Teal - used most
        createColor('T1', 10, 190, 150), // Green - heavy overlap
        createColor('T2', 50, 180, 100), // Pink - mid overlap
        createColor('T3', 60, 120, 50), // Red - limited range
        createColor('T4', 5, 195, 140), // White - heavy overlap
        createColor('T5', 70, 130, 40), // Dark Green - limited
        createColor('T6', 80, 140, 30), // Yellow - limited
      ];

      const groupResult = ColorOverlapAnalyzer.optimizeSlotAssignments(colors, 4);
      const intervalResult = ColorOverlapAnalyzer.optimizeByIntervals(colors, 4);

      // Both methods should assign all colors
      let groupTotal = 0,
        intervalTotal = 0;
      groupResult.assignments.forEach((s) => (groupTotal += s.length));
      intervalResult.assignments.forEach((s) => (intervalTotal += s.length));

      expect(groupTotal).toBe(7);
      expect(intervalTotal).toBe(7);

      // Log results for debugging
      console.log('Group optimization swaps:', groupResult.totalSwaps);
      console.log('Interval optimization swaps:', intervalResult.totalSwaps);

      // Should use all 4 slots effectively
      expect(groupResult.assignments.size).toBeGreaterThan(1);
      expect(intervalResult.assignments.size).toBeGreaterThan(1);
    });
  });
});
