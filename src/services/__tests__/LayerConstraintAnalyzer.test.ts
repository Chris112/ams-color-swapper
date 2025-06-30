import { describe, it, expect } from 'vitest';
import { LayerConstraintAnalyzer } from '../LayerConstraintAnalyzer';
import { GcodeStats } from '../../types/gcode';
import { SystemConfiguration } from '../../types/configuration';
import { Color } from '../../domain/models/Color';

describe('LayerConstraintAnalyzer', () => {
  const createMockStats = (
    colorCount: number,
    layerColorMap: Map<number, string[]>
  ): GcodeStats => {
    const colors = Array.from(
      { length: colorCount },
      (_, i) =>
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
      result.violations.forEach((violation) => {
        violation.affectedLayers.forEach((layer) => {
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
      const mergeSuggestions = result.violations[0].suggestions.filter((s) => s.type === 'merge');
      expect(mergeSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('suggestion deduplication', () => {
    it('should deduplicate merge suggestions across multiple violation ranges', () => {
      const layerColorMap = new Map<number, string[]>();

      // Create multiple violation ranges with the same colors
      // Range 1: layers 10-20 with colors T0, T1, T2, T3, T4 (5 colors)
      for (let i = 10; i <= 20; i++) {
        layerColorMap.set(i, ['T0', 'T1', 'T2', 'T3', 'T4']);
      }

      // Normal layers 21-49 with 3 colors (no violation)
      for (let i = 21; i <= 49; i++) {
        layerColorMap.set(i, ['T0', 'T1', 'T2']);
      }

      // Range 2: layers 50-60 with the same colors T0, T1, T2, T3, T4 (5 colors)
      for (let i = 50; i <= 60; i++) {
        layerColorMap.set(i, ['T0', 'T1', 'T2', 'T3', 'T4']);
      }

      const stats = createMockStats(5, layerColorMap);
      // Set similar colors for T3 and T4 to trigger merge suggestions
      (stats.colors[3] as any).hexValue = '#FF0000'; // Red
      (stats.colors[4] as any).hexValue = '#FF1111'; // Very similar red

      const config = createConfig(4);
      const result = LayerConstraintAnalyzer.validateLayerConstraints(stats, config);

      expect(result.hasViolations).toBe(true);
      expect(result.violations.length).toBe(2); // Two separate ranges

      // Create a map to track unique merge suggestions across all ranges
      const mergeSuggestionMap = new Map<string, number>();

      result.violations.forEach((range) => {
        range.suggestions
          .filter((s) => s.type === 'merge' && s.secondaryColor)
          .forEach((s) => {
            // Create a normalized key for the merge
            const colors = [s.primaryColor, s.secondaryColor!].sort();
            const key = `${colors[0]}-${colors[1]}`;
            mergeSuggestionMap.set(key, (mergeSuggestionMap.get(key) || 0) + 1);
          });
      });

      // Check that no merge suggestion appears more than once across all ranges
      for (const [, count] of mergeSuggestionMap) {
        expect(count).toBe(1); // Each unique merge should appear exactly once
      }

      // Specifically verify T3-T4 merge appears only once
      expect(mergeSuggestionMap.get('T3-T4') || 0).toBe(1);
    });

    it('should merge affected layers when deduplicating suggestions', () => {
      const layerColorMap = new Map<number, string[]>();

      // Two violation ranges with same colors
      for (let i = 1; i <= 10; i++) {
        layerColorMap.set(i, ['T0', 'T1', 'T2', 'T3', 'T4']);
      }
      for (let i = 20; i <= 30; i++) {
        layerColorMap.set(i, ['T0', 'T1', 'T2', 'T3', 'T4']);
      }

      const stats = createMockStats(5, layerColorMap);
      (stats.colors[3] as any).hexValue = '#FF0000';
      (stats.colors[4] as any).hexValue = '#FF0011'; // Very similar

      const config = createConfig(4);
      const result = LayerConstraintAnalyzer.validateLayerConstraints(stats, config);

      // Find a merge suggestion that should have combined layers from both ranges
      let foundMergedSuggestion = false;
      result.violations.forEach((range) => {
        const mergeSuggestion = range.suggestions.find(
          (s) =>
            s.type === 'merge' &&
            ((s.primaryColor === 'T3' && s.secondaryColor === 'T4') ||
              (s.primaryColor === 'T4' && s.secondaryColor === 'T3'))
        );

        if (mergeSuggestion) {
          // Should include layers from both ranges
          const affectedLayers = mergeSuggestion.impact.layersAffected;
          const hasFirstRange = affectedLayers.some((l) => l >= 1 && l <= 10);
          const hasSecondRange = affectedLayers.some((l) => l >= 20 && l <= 30);

          if (hasFirstRange && hasSecondRange) {
            foundMergedSuggestion = true;
          }
        }
      });

      expect(foundMergedSuggestion).toBe(true);
    });
  });
});
