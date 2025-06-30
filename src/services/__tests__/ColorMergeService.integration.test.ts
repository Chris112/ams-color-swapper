import { describe, it, expect } from 'vitest';
import { ColorMergeService } from '../ColorMergeService';
import { Color } from '../../domain/models/Color';
import { GcodeStats } from '../../types/gcode';

describe('ColorMergeService Integration Tests', () => {
  it('should properly merge filament estimates for UI display', () => {
    const service = new ColorMergeService();

    // Mock stats representing a real-world scenario
    const mockStats: GcodeStats = {
      fileName: 'test.gcode',
      fileSize: 1000000,
      totalLayers: 100,
      totalHeight: 20,
      slicerInfo: {
        software: 'OrcaSlicer',
        version: '2.0.0',
      },
      colors: [
        new Color({
          id: 'T0',
          name: 'Blue PLA',
          hexValue: '#0000FF',
          firstLayer: 0,
          lastLayer: 50,
          layersUsed: new Set([0, 10, 20, 30, 40, 50]),
          partialLayers: new Set(),
          totalLayers: 100,
        }),
        new Color({
          id: 'T1',
          name: 'Red PLA',
          hexValue: '#FF0000',
          firstLayer: 20,
          lastLayer: 80,
          layersUsed: new Set([20, 30, 40, 50, 60, 70, 80]),
          partialLayers: new Set(),
          totalLayers: 100,
        }),
      ],
      toolChanges: [
        { layer: 20, fromTool: 'T0', toTool: 'T1', lineNumber: 200 },
        { layer: 50, fromTool: 'T1', toTool: 'T0', lineNumber: 500 },
      ],
      layerColorMap: new Map([
        [0, ['T0']],
        [10, ['T0']],
        [20, ['T0', 'T1']],
        [30, ['T0', 'T1']],
        [40, ['T0', 'T1']],
        [50, ['T0', 'T1']],
        [60, ['T1']],
        [70, ['T1']],
        [80, ['T1']],
      ]),
      colorUsageRanges: [
        { colorId: 'T0', startLayer: 0, endLayer: 50, continuous: true },
        { colorId: 'T1', startLayer: 20, endLayer: 80, continuous: true },
      ],
      filamentEstimates: [
        { colorId: 'T0', length: 800, weight: 3.2 }, // Blue PLA
        { colorId: 'T1', length: 1200, weight: 4.8 }, // Red PLA
      ],
      parserWarnings: [],
      parseTime: 100,
    };

    // User merges T1 (Red) into T0 (Blue) - T1 will be removed, T0 will contain combined stats
    const result = service.mergeColors(mockStats, 'T0', ['T1']);

    expect(result).toBeTruthy();
    const mergedStats = result!.mergedStats;

    // Verify merged filament estimates for UI display
    expect(mergedStats.filamentEstimates).toBeDefined();
    expect(mergedStats.filamentEstimates!.length).toBe(1); // Only T0 remains

    const t0Estimate = mergedStats.filamentEstimates!.find((est) => est.colorId === 'T0');
    expect(t0Estimate).toBeTruthy();
    expect(t0Estimate!.weight).toBe(8.0); // 3.2 + 4.8 = 8.0g
    expect(t0Estimate!.length).toBe(2000); // 800 + 1200 = 2000mm

    // Verify T1 estimate is removed (no orphaned data)
    const t1Estimate = mergedStats.filamentEstimates!.find((est) => est.colorId === 'T1');
    expect(t1Estimate).toBeUndefined();

    // Verify UI would show correct combined weight
    const totalWeight = mergedStats.filamentEstimates!.reduce(
      (sum, est) => sum + (est.weight || 0),
      0
    );
    expect(totalWeight).toBe(8.0); // Combined weight for progress bars

    // Verify color array is also correctly updated
    expect(mergedStats.colors.length).toBe(1); // Only T0 remains
    expect(mergedStats.colors[0].id).toBe('T0');
    expect(mergedStats.colors[0].name).toBe('Blue PLA');

    // Verify the merged color has absorbed T1's layer usage
    const mergedColor = mergedStats.colors[0];
    expect(mergedColor.firstLayer).toBe(0); // T0's original start
    expect(mergedColor.lastLayer).toBe(80); // Extended to T1's end
    expect(mergedColor.layersUsed.has(60)).toBe(true); // T1's layers absorbed
    expect(mergedColor.layersUsed.has(70)).toBe(true);
    expect(mergedColor.layersUsed.has(80)).toBe(true);
  });

  it('should handle UI scenarios with partial filament estimate data', () => {
    const service = new ColorMergeService();

    // Scenario: Only one color has filament estimate data
    const mockStats: GcodeStats = {
      fileName: 'test.gcode',
      fileSize: 1000000,
      totalLayers: 50,
      totalHeight: 10,
      slicerInfo: { software: 'Test', version: '1.0' },
      colors: [
        new Color({
          id: 'T0',
          name: 'Color 1',
          hexValue: '#FF0000',
          firstLayer: 0,
          lastLayer: 25,
          layersUsed: new Set([0, 10, 20]),
          partialLayers: new Set(),
          totalLayers: 50,
        }),
        new Color({
          id: 'T1',
          name: 'Color 2',
          hexValue: '#00FF00',
          firstLayer: 25,
          lastLayer: 50,
          layersUsed: new Set([25, 35, 45]),
          partialLayers: new Set(),
          totalLayers: 50,
        }),
      ],
      toolChanges: [],
      layerColorMap: new Map(),
      colorUsageRanges: [],
      filamentEstimates: [
        { colorId: 'T0', length: 500, weight: 2.0 },
        // T1 missing filament estimate (common in some G-code files)
      ],
      parserWarnings: [],
      parseTime: 100,
    };

    const result = service.mergeColors(mockStats, 'T0', ['T1']);

    expect(result).toBeTruthy();
    const mergedStats = result!.mergedStats;

    // Verify UI can still display weight for T0 (even though T1 had no estimate)
    const t0Estimate = mergedStats.filamentEstimates!.find((est) => est.colorId === 'T0');
    expect(t0Estimate).toBeTruthy();
    expect(t0Estimate!.weight).toBe(2.0); // Only T0's original weight
    expect(t0Estimate!.length).toBe(500); // Only T0's original length

    // Verify total weight calculation for UI still works
    const totalWeight = mergedStats.filamentEstimates!.reduce(
      (sum, est) => sum + (est.weight || 0),
      0
    );
    expect(totalWeight).toBe(2.0);
  });
});
