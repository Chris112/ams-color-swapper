import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { GcodeParser } from '../gcodeParser';
import { Logger } from '../../utils/logger';

describe('Slowking Layer Coverage Analysis', () => {
  const filePath = resolve(__dirname, '../../../examples/6_color_Slowking.gcode');

  it('should verify T0 appears on all 266 layers', async () => {
    // Read and parse the file
    const fileContent = readFileSync(filePath);
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const file = new File([blob], '6_color_Slowking.gcode', { type: 'text/plain' });

    const logger = new Logger('slowking-coverage-test');
    const parser = new GcodeParser(logger);
    const stats = await parser.parse(file);

    console.log('\n=== LAYER COVERAGE ANALYSIS ===');
    console.log(`Total layers: ${stats.totalLayers}`);
    console.log(`LayerColorMap size: ${stats.layerColorMap.size}`);

    // Check every single layer for T0 presence
    const layersWithoutT0: number[] = [];
    const layersWithT0: number[] = [];
    const layerBreakdown: { [layer: number]: string[] } = {};

    // Check all layers from 0 to 265 (0-based internal numbering)
    for (let layer = 0; layer < stats.totalLayers; layer++) {
      const colorsOnLayer = stats.layerColorMap.get(layer) || [];
      layerBreakdown[layer] = colorsOnLayer;

      if (colorsOnLayer.includes('T0')) {
        layersWithT0.push(layer);
      } else {
        layersWithoutT0.push(layer);
      }
    }

    console.log(`\nLayers WITH T0: ${layersWithT0.length}/${stats.totalLayers}`);
    console.log(`Layers WITHOUT T0: ${layersWithoutT0.length}/${stats.totalLayers}`);
    console.log(
      `T0 layer coverage: ${((layersWithT0.length / stats.totalLayers) * 100).toFixed(1)}%`
    );

    // Show detailed breakdown of missing T0 layers
    if (layersWithoutT0.length > 0) {
      console.log('\n=== LAYERS MISSING T0 ===');

      // Group consecutive missing layers for easier reading
      const missingRanges: string[] = [];
      let rangeStart = layersWithoutT0[0];
      let rangeEnd = layersWithoutT0[0];

      for (let i = 1; i < layersWithoutT0.length; i++) {
        const currentLayer = layersWithoutT0[i];
        const prevLayer = layersWithoutT0[i - 1];

        if (currentLayer === prevLayer + 1) {
          // Consecutive layer, extend range
          rangeEnd = currentLayer;
        } else {
          // Gap found, close current range and start new one
          if (rangeStart === rangeEnd) {
            missingRanges.push(`${rangeStart}`);
          } else {
            missingRanges.push(`${rangeStart}-${rangeEnd}`);
          }
          rangeStart = currentLayer;
          rangeEnd = currentLayer;
        }
      }

      // Close final range
      if (rangeStart === rangeEnd) {
        missingRanges.push(`${rangeStart}`);
      } else {
        missingRanges.push(`${rangeStart}-${rangeEnd}`);
      }

      console.log(`Missing T0 on layers: ${missingRanges.join(', ')}`);

      // Show what colors ARE on those missing layers
      console.log('\n=== COLORS ON T0-MISSING LAYERS ===');
      layersWithoutT0.slice(0, 20).forEach((layer) => {
        const colors = layerBreakdown[layer];
        console.log(`Layer ${layer}: [${colors.join(', ')}]`);
      });
      if (layersWithoutT0.length > 20) {
        console.log(`... (showing first 20 of ${layersWithoutT0.length} missing layers)`);
      }
    }

    // Show sample layers WITH T0 to verify multi-tool detection
    console.log('\n=== SAMPLE LAYERS WITH T0 ===');
    layersWithT0.slice(0, 20).forEach((layer) => {
      const colors = layerBreakdown[layer];
      console.log(`Layer ${layer}: [${colors.join(', ')}]`);
    });

    // Color usage analysis - distinguish between layer coverage vs volume
    console.log('\n=== COLOR USAGE BREAKDOWN ===');
    stats.colors.forEach((color) => {
      const layerCoverage = ((color.layerCount / stats.totalLayers) * 100).toFixed(1);
      console.log(`${color.name} (${color.id}):`);
      console.log(
        `  Layer coverage: ${layerCoverage}% (${color.layerCount}/${stats.totalLayers} layers)`
      );
      console.log(`  Volume percentage: ${color.usagePercentage.toFixed(1)}%`);
      console.log(`  Layer range: ${color.firstLayer}-${color.lastLayer}`);
    });

    // The critical test: if this is a multi-color print with pink base, T0 should be on ALL layers
    console.log('\n=== CRITICAL VALIDATION ===');
    if (layersWithoutT0.length === 0) {
      console.log('✅ T0 appears on ALL 266 layers - parser working correctly');
      console.log('✅ Issue likely in layer timeline visualization rendering');
    } else {
      console.log(`❌ T0 missing from ${layersWithoutT0.length} layers - parser issue detected`);
      console.log('❌ Issue is in G-code parsing logic, not visualization');
    }

    // For the user's expectation: T0 should be on 100% of layers
    expect(layersWithoutT0.length).toBe(0); // T0 should be on every single layer
    expect(layersWithT0.length).toBe(stats.totalLayers); // 266 layers with T0
  });

  it('should analyze tool change patterns to understand layer assignment', async () => {
    const fileContent = readFileSync(filePath);
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const file = new File([blob], '6_color_Slowking.gcode', { type: 'text/plain' });

    const logger = new Logger('slowking-toolchange-test');
    const parser = new GcodeParser(logger);
    const stats = await parser.parse(file);

    console.log('\n=== TOOL CHANGE PATTERN ANALYSIS ===');
    console.log(`Total tool changes: ${stats.toolChanges.length}`);

    // Group tool changes by layer to understand the pattern
    const toolChangesByLayer = new Map<number, string[]>();
    stats.toolChanges.forEach((change) => {
      if (!toolChangesByLayer.has(change.layer)) {
        toolChangesByLayer.set(change.layer, []);
      }
      toolChangesByLayer.get(change.layer)!.push(`${change.fromTool}→${change.toTool}`);
    });

    console.log(`Layers with tool changes: ${toolChangesByLayer.size}`);

    // Show tool change pattern for first 20 layers
    console.log('\n=== TOOL CHANGES BY LAYER (First 20) ===');
    for (let layer = 0; layer < Math.min(20, stats.totalLayers); layer++) {
      const changes = toolChangesByLayer.get(layer) || [];
      const colors = stats.layerColorMap.get(layer) || [];
      console.log(`Layer ${layer}: Changes=[${changes.join(', ')}] Colors=[${colors.join(', ')}]`);
    }

    // Analyze if tool changes correlate with missing T0
    console.log('\n=== TOOL CHANGE CORRELATION ===');
    let layersWithChanges = 0;
    let layersWithT0AfterChanges = 0;

    for (let layer = 0; layer < stats.totalLayers; layer++) {
      const hasChanges = toolChangesByLayer.has(layer);
      const hasT0 = (stats.layerColorMap.get(layer) || []).includes('T0');

      if (hasChanges) {
        layersWithChanges++;
        if (hasT0) {
          layersWithT0AfterChanges++;
        }
      }
    }

    console.log(`Layers with tool changes: ${layersWithChanges}`);
    console.log(`Of those, layers with T0: ${layersWithT0AfterChanges}`);
    console.log(
      `T0 retention after tool changes: ${((layersWithT0AfterChanges / layersWithChanges) * 100).toFixed(1)}%`
    );
  });
});
