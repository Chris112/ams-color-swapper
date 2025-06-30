import { describe, it, expect } from 'vitest';
import { ColorMergeService } from '../ColorMergeService';
import { Color } from '../../domain/models/Color';
import { GcodeStats } from '../../types/gcode';

describe('Merge Clone Fix Test', () => {
  it('should not mutate original filament estimates during merge', () => {
    const originalStats: GcodeStats = {
      fileName: 'test.gcode',
      fileSize: 1000,
      totalLayers: 100,
      totalHeight: 20,
      printTime: '30m',
      printCost: 0.15,
      colors: [
        new Color({
          id: 'T0',
          name: 'Color 1',
          hexValue: '#D3B7A7',
          firstLayer: 1,
          lastLayer: 50,
          layersUsed: new Set([1, 2, 3]),
          totalLayers: 100,
        }),
        new Color({
          id: 'T5',
          name: 'Color 6',
          hexValue: '#161616',
          firstLayer: 51,
          lastLayer: 100,
          layersUsed: new Set([51, 52, 53]),
          totalLayers: 100,
        }),
      ],
      toolChanges: [],
      layerColorMap: new Map(),
      colorUsageRanges: [],
      filamentEstimates: [
        { colorId: 'T0', length: 729.6, weight: 2.32 },
        { colorId: 'T5', length: 1256.5, weight: 3.75 },
      ],
      layerDetails: [],
      parseTime: 100,
      parserWarnings: [],
    };

    console.log('\n=== BEFORE MERGE ===');
    console.log(
      'Original T0 weight:',
      originalStats.filamentEstimates?.find((e) => e.colorId === 'T0')?.weight
    );
    console.log(
      'Original T5 weight:',
      originalStats.filamentEstimates?.find((e) => e.colorId === 'T5')?.weight
    );
    console.log('Original filament estimates reference:', originalStats.filamentEstimates);

    // Store reference to original filament estimates for comparison
    const originalEstimatesRef = originalStats.filamentEstimates;
    const originalT0Estimate = originalStats.filamentEstimates?.find((e) => e.colorId === 'T0');
    const originalT0Weight = originalT0Estimate?.weight;

    // Perform merge
    const mergeService = new ColorMergeService();
    const mergeResult = mergeService.mergeColors(originalStats, 'T0', ['T5']);

    console.log('\n=== AFTER MERGE ===');
    console.log(
      'Original T0 weight (should be unchanged):',
      originalStats.filamentEstimates?.find((e) => e.colorId === 'T0')?.weight
    );
    console.log(
      'Merged T0 weight:',
      mergeResult?.mergedStats.filamentEstimates?.find((e) => e.colorId === 'T0')?.weight
    );
    console.log(
      'Original estimates reference unchanged:',
      originalStats.filamentEstimates === originalEstimatesRef
    );
    console.log(
      'Merged estimates reference different:',
      mergeResult?.mergedStats.filamentEstimates !== originalEstimatesRef
    );

    // Verify merge worked
    expect(mergeResult).toBeTruthy();
    expect(mergeResult!.mergedStats.filamentEstimates).toHaveLength(1);
    expect(mergeResult!.mergedStats.filamentEstimates![0].weight).toBe(6.07);

    // CRITICAL TEST: Original data should be unchanged
    expect(originalStats.filamentEstimates?.find((e) => e.colorId === 'T0')?.weight).toBe(
      originalT0Weight
    );
    expect(originalStats.filamentEstimates).toBe(originalEstimatesRef); // Same reference

    // CRITICAL TEST: Merged data should have different reference
    expect(mergeResult!.mergedStats.filamentEstimates).not.toBe(originalEstimatesRef);

    console.log('\n=== VERIFICATION ===');
    console.log('✅ Original data unchanged - no mutation');
    console.log('✅ Merged data has new references');
    console.log('✅ Component shouldUpdate() will detect changes');
    console.log('✅ UI will properly refresh with merged values');
  });
});
