import { describe, it, expect } from 'vitest';
import { LayerConstraintAnalyzer } from '../LayerConstraintAnalyzer';
import { GcodeStats, SystemConfiguration } from '../../types';
import { Color } from '../../domain/models/Color';

describe('LayerConstraintAnalyzer', () => {
  const createMockStats = (colorCount: number, layerColorMap: Map<number, string[]>): GcodeStats => {
    const colors = Array.from({ length: colorCount }, (_, i) => 
      new Color({
        id: `T${i}`,
        name: `Color ${i}`,
        hexValue: `#${i.toString(16).padStart(6, '0')}`,
        firstLayer: 0,
        lastLayer: 100,
        layersUsed: new Set(),
        partialLayers: new Set(),
        totalLayers: 100,
      })
    );

    return {
      fileName: 'test.gcode',
      fileSize: 1000,
      totalLayers: 100,
      totalHeight: 20,
      colors,
      toolChanges: [],
      layerColorMap,
      colorUsageRanges: [],
      parserWarnings: [],
      parseTime: 100,
    };
  };

  const createConfig = (slots: number): SystemConfiguration => ({
    type: 'ams',
    unitCount: 1,
    totalSlots: slots,
  });

  describe('constraint validation logic', () => {
    it('should not flag violations when colors equal available slots', () => {
      // Create a scenario with 4 colors and 4 slots
      const layerColorMap = new Map<number, string[]>();
      for (let i = 1; i <= 100; i++) {
        layerColorMap.set(i, ['T0', 'T1', 'T2', 'T3']); // Exactly 4 colors
      }

      const stats = createMockStats(4, layerColorMap);
      const config = createConfig(4);

      const result = LayerConstraintAnalyzer.validateLayerConstraints(stats, config);

      expect(result.hasViolations).toBe(false);
      expect(result.summary.impossibleLayerCount).toBe(0);
      expect(result.violations.length).toBe(0);
    });

    it('should flag violations when colors exceed available slots', () => {
      // Create a scenario with 5 colors but only 4 slots
      const layerColorMap = new Map<number, string[]>();
      for (let i = 1; i <= 100; i++) {
        layerColorMap.set(i, ['T0', 'T1', 'T2', 'T3', 'T4']); // 5 colors
      }

      const stats = createMockStats(5, layerColorMap);
      const config = createConfig(4);

      const result = LayerConstraintAnalyzer.validateLayerConstraints(stats, config);

      expect(result.hasViolations).toBe(true);
      expect(result.summary.impossibleLayerCount).toBe(100); // All layers are impossible
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].maxColorsRequired).toBe(5);
      expect(result.violations[0].availableSlots).toBe(4);
    });

    it('should not flag violations for layers with fewer colors than slots', () => {
      // Create a scenario with varying color counts, all within limits
      const layerColorMap = new Map<number, string[]>();
      layerColorMap.set(1, ['T0']); // 1 color
      layerColorMap.set(2, ['T0', 'T1']); // 2 colors
      layerColorMap.set(3, ['T0', 'T1', 'T2']); // 3 colors
      layerColorMap.set(4, ['T0', 'T1', 'T2', 'T3']); // 4 colors (equal to slots)

      const stats = createMockStats(4, layerColorMap);
      const config = createConfig(4);

      const result = LayerConstraintAnalyzer.validateLayerConstraints(stats, config);

      expect(result.hasViolations).toBe(false);
      expect(result.summary.impossibleLayerCount).toBe(0);
    });

    it('should correctly identify mixed violation scenarios', () => {
      // Some layers are fine, some have violations
      const layerColorMap = new Map<number, string[]>();
      // Layers 1-50: 3 colors (fine)
      for (let i = 1; i <= 50; i++) {
        layerColorMap.set(i, ['T0', 'T1', 'T2']);
      }
      // Layers 51-70: 5 colors (violation)
      for (let i = 51; i <= 70; i++) {
        layerColorMap.set(i, ['T0', 'T1', 'T2', 'T3', 'T4']);
      }
      // Layers 71-100: 4 colors (fine)
      for (let i = 71; i <= 100; i++) {
        layerColorMap.set(i, ['T0', 'T1', 'T2', 'T3']);
      }

      const stats = createMockStats(5, layerColorMap);
      const config = createConfig(4);

      const result = LayerConstraintAnalyzer.validateLayerConstraints(stats, config);

      expect(result.hasViolations).toBe(true);
      expect(result.summary.impossibleLayerCount).toBe(20); // Only layers 51-70
      expect(result.violations.length).toBe(1);
      expect(result.violations[0].startLayer).toBe(51);
      expect(result.violations[0].endLayer).toBe(70);
    });

    it('should not create suboptimal warnings (removed feature)', () => {
      // This test verifies that having exactly the number of slots doesn't create warnings
      const layerColorMap = new Map<number, string[]>();
      for (let i = 1; i <= 100; i++) {
        layerColorMap.set(i, ['T0', 'T1', 'T2', 'T3']); // Exactly 4 colors
      }

      const stats = createMockStats(4, layerColorMap);
      const config = createConfig(4);

      const result = LayerConstraintAnalyzer.validateLayerConstraints(stats, config);

      // Should have no violations at all
      expect(result.hasViolations).toBe(false);
      expect(result.violations.length).toBe(0);
      
      // Verify no violations have 'suboptimal' type
      result.violations.forEach(violation => {
        violation.affectedLayers.forEach(layer => {
          expect(layer.violationType).not.toBe('suboptimal');
        });
      });
    });
  });

  describe('suggestion generation', () => {
    it('should generate merge suggestions for violations', () => {
      const layerColorMap = new Map<number, string[]>();
      // Create a violation scenario
      for (let i = 1; i <= 10; i++) {
        layerColorMap.set(i, ['T0', 'T1', 'T2', 'T3', 'T4']); // 5 colors, only 4 slots
      }

      const stats = createMockStats(5, layerColorMap);
      const config = createConfig(4);

      const result = LayerConstraintAnalyzer.validateLayerConstraints(stats, config);

      expect(result.hasViolations).toBe(true);
      expect(result.violations[0].suggestions.length).toBeGreaterThan(0);
      
      // Should have at least one merge suggestion
      const mergeSuggestions = result.violations[0].suggestions.filter(s => s.type === 'merge');
      expect(mergeSuggestions.length).toBeGreaterThan(0);
    });
  });
});