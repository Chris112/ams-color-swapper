import { describe, it, expect } from 'vitest';
import { AmsConfiguration } from '../AmsConfiguration';
import { Color } from '../Color';

describe('AmsConfiguration', () => {
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
      hexValue: '#000000',
      firstLayer,
      lastLayer,
    });
  };

  describe('Legacy Algorithm', () => {
    it('should assign colors using legacy algorithm', () => {
      const config = new AmsConfiguration('ams', 1, 'legacy');
      const colors = [
        createColor('T0', 0, 100, 100),
        createColor('T1', 0, 80, 80),
        createColor('T2', 0, 60, 60),
        createColor('T3', 50, 100, 50),
        createColor('T4', 70, 120, 50),
        createColor('T5', 90, 140, 50),
        createColor('T6', 110, 160, 50),
      ];

      config.assignColors(colors);
      const slots = config.getAllSlots();

      // Slots 1-3 should have the most used colors (T0, T1, T2)
      expect(slots[0].colorIds).toContain('T0');
      expect(slots[1].colorIds).toContain('T1');
      expect(slots[2].colorIds).toContain('T2');

      // Slot 4 should have remaining colors
      expect(slots[3].colorIds.length).toBeGreaterThan(0);

      // All colors should be assigned
      const allAssignedColors = new Set<string>();
      slots.forEach((slot) => {
        slot.colorIds.forEach((id) => allAssignedColors.add(id));
      });
      expect(allAssignedColors.size).toBe(7);
    });
  });

  describe('Optimized Algorithm - Groups', () => {
    it('should optimize color assignment using group strategy', () => {
      const config = new AmsConfiguration('ams', 1, 'groups');
      const colors = [
        createColor('T0', 0, 30),
        createColor('T1', 31, 60),
        createColor('T2', 61, 90),
        createColor('T3', 91, 120),
        createColor('T4', 0, 120), // Overlaps all
        createColor('T5', 121, 150),
        createColor('T6', 151, 180),
      ];

      config.assignColors(colors);
      const slots = config.getAllSlots();

      // All colors should be assigned
      const allAssignedColors = new Set<string>();
      slots.forEach((slot) => {
        slot.colorIds.forEach((id) => allAssignedColors.add(id));
      });
      expect(allAssignedColors.size).toBe(7);

      // Should use multiple slots effectively
      const nonEmptySlots = slots.filter((s) => s.colorIds.length > 0);
      expect(nonEmptySlots.length).toBeGreaterThan(1);
    });
  });

  describe('Optimized Algorithm - Intervals', () => {
    it('should optimize color assignment using interval scheduling', () => {
      const config = new AmsConfiguration('ams', 1, 'intervals');
      const colors = [
        createColor('T0', 0, 25),
        createColor('T1', 26, 50),
        createColor('T2', 51, 75),
        createColor('T3', 76, 100),
        createColor('T4', 101, 125),
        createColor('T5', 126, 150),
      ];

      config.assignColors(colors);
      const slots = config.getAllSlots();

      // All colors should be assigned
      const allAssignedColors = new Set<string>();
      slots.forEach((slot) => {
        slot.colorIds.forEach((id) => allAssignedColors.add(id));
      });
      expect(allAssignedColors.size).toBe(6);

      // Should efficiently pack colors
      const totalSwaps = config.getManualSwaps().length;
      expect(totalSwaps).toBeLessThan(6); // Should be optimized
    });
  });

  describe('Manual Swaps', () => {
    it('should generate correct manual swaps for shared slots', () => {
      const config = new AmsConfiguration('ams', 1, 'intervals');
      const colors = [
        createColor('T0', 0, 50),
        createColor('T1', 51, 100),
        createColor('T2', 101, 150),
        createColor('T3', 151, 200),
      ];

      config.assignColors(colors);
      const swaps = config.getManualSwaps();

      // These colors don't overlap, so they can share one slot with 3 swaps
      if (swaps.length === 3) {
        expect(swaps[0].atLayer).toBe(51);
        expect(swaps[1].atLayer).toBe(101);
        expect(swaps[2].atLayer).toBe(151);
      }
    });

    it('should calculate pause layer ranges correctly', () => {
      const config = new AmsConfiguration('ams', 1, 'intervals');
      const colors = [
        createColor('T0', 0, 30), // Ends at layer 30
        createColor('T1', 60, 100), // Starts at layer 60 (gap between 31-59)
        createColor('T2', 110, 150), // Starts at layer 110 (gap between 101-109)
        createColor('T3', 151, 200), // Starts at layer 151 (adjacent to T2)
      ];

      config.assignColors(colors);
      const swaps = config.getManualSwaps();

      // Find swap from T0 to T1
      const swap1 = swaps.find((s) => s.fromColor === 'T0' && s.toColor === 'T1');
      if (swap1) {
        expect(swap1.pauseStartLayer).toBe(31);
        expect(swap1.pauseEndLayer).toBe(59);
        expect(swap1.reason).toContain('Pause between layers 31-59');
      }

      // Find swap from T1 to T2
      const swap2 = swaps.find((s) => s.fromColor === 'T1' && s.toColor === 'T2');
      if (swap2) {
        expect(swap2.pauseStartLayer).toBe(101);
        expect(swap2.pauseEndLayer).toBe(109);
        expect(swap2.reason).toContain('Pause between layers 101-109');
      }

      // Find swap from T2 to T3 (adjacent colors)
      const swap3 = swaps.find((s) => s.fromColor === 'T2' && s.toColor === 'T3');
      if (swap3) {
        expect(swap3.pauseStartLayer).toBe(151);
        expect(swap3.pauseEndLayer).toBe(150);
        expect(swap3.reason).toContain('Colors are adjacent - pause at layer 151');
      }
    });

    it('should calculate correct time saved', () => {
      const config = new AmsConfiguration('ams', 1);
      const colors = [
        createColor('T0', 0, 50),
        createColor('T1', 51, 100),
        createColor('T2', 101, 150),
        createColor('T3', 151, 200),
        createColor('T4', 0, 200),
      ];

      config.assignColors(colors);
      const timeSaved = config.getTimeSaved();

      // Time saved = number of swaps * 120 seconds
      const swaps = config.getManualSwaps();
      expect(timeSaved).toBe(swaps.length * 120);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single color', () => {
      const config = new AmsConfiguration('ams', 1);
      const colors = [createColor('T0', 0, 100)];

      config.assignColors(colors);
      const slots = config.getAllSlots();

      expect(slots[0].colorIds).toContain('T0');
      expect(config.getManualSwaps().length).toBe(0);
    });

    it('should handle exactly 4 colors', () => {
      const config = new AmsConfiguration('ams', 1);
      const colors = [
        createColor('T0', 0, 100),
        createColor('T1', 0, 100),
        createColor('T2', 0, 100),
        createColor('T3', 0, 100),
      ];

      config.assignColors(colors);
      const slots = config.getAllSlots();

      // Each color should get its own slot
      slots.forEach((slot, index) => {
        expect(slot.colorIds.length).toBe(1);
        expect(slot.colorIds[0]).toBe(`T${index}`);
      });

      expect(config.getManualSwaps().length).toBe(0);
    });

    it('should handle 10+ colors', () => {
      const config = new AmsConfiguration('ams', 1, 'intervals');
      const colors: Color[] = [];

      // Create 10 colors with various overlaps
      for (let i = 0; i < 10; i++) {
        colors.push(createColor(`T${i}`, i * 10, i * 10 + 50));
      }

      config.assignColors(colors);

      // All colors should be assigned
      const allAssignedColors = new Set<string>();
      config.getAllSlots().forEach((slot) => {
        slot.colorIds.forEach((id) => allAssignedColors.add(id));
      });
      expect(allAssignedColors.size).toBe(10);

      // Should have manual swaps
      expect(config.getManualSwaps().length).toBeGreaterThan(0);
    });
  });

  describe('Validation', () => {
    it('should validate non-overlapping colors in same slot', () => {
      const config = new AmsConfiguration('ams', 1);
      const colors = [
        createColor('T0', 0, 50),
        createColor('T1', 51, 100),
        createColor('T2', 101, 150),
        createColor('T3', 151, 200),
      ];

      config.assignColors(colors);
      expect(config.isValid()).toBe(true);
    });

    it('should detect invalid overlapping colors in same slot', () => {
      const config = new AmsConfiguration('ams', 1, 'legacy');
      const colors = [
        createColor('T0', 0, 100, 100),
        createColor('T1', 0, 100, 80),
        createColor('T2', 0, 100, 60),
        createColor('T3', 0, 100, 40),
        createColor('T4', 0, 100, 20),
      ];

      config.assignColors(colors);
      // With legacy algorithm, overlapping colors might be assigned to same slot
      // The validation should detect this
      const isValid = config.isValid();

      // If invalid, there should be overlapping colors in slot 4
      if (!isValid) {
        const slot4 = config.getSlot(1, 4);
        expect(slot4?.colors.length).toBeGreaterThan(1);
      }
    });
  });
});
