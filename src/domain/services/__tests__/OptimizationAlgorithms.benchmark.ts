import { describe, it, expect, bench } from 'vitest';
import { OptimizationService, OptimizationAlgorithm } from '@/services/OptimizationService';
import { GcodeStats } from '../../../types';
import { Color } from '../../models/Color';

// Helper function to create a mock GcodeStats object for benchmarking
function createMockGcodeStats(
  numColors: number,
  overlapPattern: 'none' | 'some' | 'all'
): GcodeStats {
  const colors: Color[] = [];
  const totalLayers = 1000;
  const layerStep = Math.floor(totalLayers / numColors);

  for (let i = 0; i < numColors; i++) {
    let firstLayer: number;
    let lastLayer: number;

    if (overlapPattern === 'none') {
      firstLayer = i * layerStep;
      lastLayer = (i + 1) * layerStep - 1;
    } else if (overlapPattern === 'some') {
      firstLayer = i * layerStep;
      lastLayer = Math.min(totalLayers - 1, firstLayer + layerStep + Math.floor(layerStep / 2)); // Overlap with next
    } else {
      // 'all'
      firstLayer = 0;
      lastLayer = totalLayers - 1;
    }

    // Create layers used set
    const layersUsed = new Set<number>();
    for (let layer = firstLayer; layer <= lastLayer; layer++) {
      layersUsed.add(layer);
    }

    const color = new Color({
      id: `T${i}`,
      name: `Color ${i}`,
      hexValue: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
      firstLayer: firstLayer,
      lastLayer: lastLayer,
      layersUsed: layersUsed,
      partialLayers: new Set(),
      totalLayers: totalLayers,
    });

    colors.push(color);
  }

  return {
    fileName: `mock_print_${numColors}_colors_${overlapPattern}`,
    fileSize: 0,
    totalLayers: totalLayers,
    totalHeight: 0,
    toolChanges: [],
    parseTime: 0,
    layerColorMap: new Map(),
    colorUsageRanges: [],
    colors: colors,
    parserWarnings: [],
    slicerInfo: { software: 'MockSlicer', version: '1.0' },
    printTime: '0h 0m 0s',
    estimatedPrintTime: 0,
    printCost: 0,
    filamentUsageStats: { total: 0, model: 0, support: 0, flushed: 0, tower: 0 },
    filamentEstimates: [],
    rawContent: '',
  };
}

describe('Optimization Algorithm Benchmarks', () => {
  const optimizationService = new OptimizationService();

  // Scenario 1: 5 colors, no overlap (should be 0 swaps for both)
  const stats5NoOverlap = createMockGcodeStats(5, 'none');
  // Scenario 2: 5 colors, some overlap (should require some swaps)
  const stats5SomeOverlap = createMockGcodeStats(5, 'some');
  // Scenario 3: 8 colors, some overlap (more complex)
  const stats8SomeOverlap = createMockGcodeStats(8, 'some');
  // Scenario 4: 10 colors, all overlap (worst case for swaps)
  const stats10AllOverlap = createMockGcodeStats(10, 'all');

  bench('Greedy Algorithm - 5 Colors (No Overlap)', () => {
    optimizationService.generateOptimization(
      stats5NoOverlap,
      undefined,
      OptimizationAlgorithm.Greedy
    );
  });

  bench('Simulated Annealing - 5 Colors (No Overlap)', () => {
    optimizationService.generateOptimization(
      stats5NoOverlap,
      undefined,
      OptimizationAlgorithm.SimulatedAnnealing
    );
  });

  bench('Greedy Algorithm - 5 Colors (Some Overlap)', () => {
    optimizationService.generateOptimization(
      stats5SomeOverlap,
      undefined,
      OptimizationAlgorithm.Greedy
    );
  });

  bench('Simulated Annealing - 5 Colors (Some Overlap)', () => {
    optimizationService.generateOptimization(
      stats5SomeOverlap,
      undefined,
      OptimizationAlgorithm.SimulatedAnnealing
    );
  });

  bench('Greedy Algorithm - 8 Colors (Some Overlap)', () => {
    optimizationService.generateOptimization(
      stats8SomeOverlap,
      undefined,
      OptimizationAlgorithm.Greedy
    );
  });

  bench('Simulated Annealing - 8 Colors (Some Overlap)', () => {
    optimizationService.generateOptimization(
      stats8SomeOverlap,
      undefined,
      OptimizationAlgorithm.SimulatedAnnealing
    );
  });

  bench('Greedy Algorithm - 10 Colors (All Overlap)', () => {
    optimizationService.generateOptimization(
      stats10AllOverlap,
      undefined,
      OptimizationAlgorithm.Greedy
    );
  });

  bench('Simulated Annealing - 10 Colors (All Overlap)', () => {
    optimizationService.generateOptimization(
      stats10AllOverlap,
      undefined,
      OptimizationAlgorithm.SimulatedAnnealing
    );
  });

  // You can add assertions here to check the quality of the solution (number of swaps)
  // For example:
  it('Simulated Annealing should find optimal or near-optimal swaps for 5 colors (no overlap)', () => {
    const result = optimizationService.generateOptimization(
      stats5NoOverlap,
      undefined,
      OptimizationAlgorithm.SimulatedAnnealing
    );
    expect(result.manualSwaps.length).toBe(0);
  });

  it('Simulated Annealing should find fewer or equal swaps than Greedy for 10 colors (all overlap)', () => {
    const greedyResult = optimizationService.generateOptimization(
      stats10AllOverlap,
      undefined,
      OptimizationAlgorithm.Greedy
    );
    const saResult = optimizationService.generateOptimization(
      stats10AllOverlap,
      undefined,
      OptimizationAlgorithm.SimulatedAnnealing
    );
    expect(saResult.manualSwaps.length).toBeLessThanOrEqual(greedyResult.manualSwaps.length);
  });
});
