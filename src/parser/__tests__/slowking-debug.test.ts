import { describe, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { GcodeParser } from '../gcodeParser';
import { Logger } from '../../utils/logger';

describe('Slowking Debug Test', () => {
  it('should debug layer detection and color assignment', async () => {
    const filePath = resolve(__dirname, '../../../examples/6_color_Slowking.gcode');
    const fileContent = readFileSync(filePath);
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const file = new File([blob], '6_color_Slowking.gcode', { type: 'text/plain' });

    console.log('\n=== SLOWKING DEBUG ANALYSIS ===');

    // Create logger with debug level
    const logger = new Logger('slowking-debug');
    const parser = new GcodeParser(logger);

    const stats = await parser.parse(file);

    console.log('\n=== LAYER DISTRIBUTION ===');

    // Check layer distribution for each color
    stats.colors.forEach((color) => {
      console.log(`\n${color.name} (${color.id}):`);
      console.log(`  First layer: ${color.firstLayer}`);
      console.log(`  Last layer: ${color.lastLayer}`);
      console.log(`  Layer count: ${color.layerCount}`);
      console.log(`  Usage percentage: ${color.usagePercentage.toFixed(1)}%`);

      // Sample some layers to see the distribution
      const sampleLayers = Array.from(color.layersUsed).slice(0, 10);
      console.log(
        `  Sample layers: [${sampleLayers.join(', ')}${color.layersUsed.size > 10 ? '...' : ''}]`
      );
    });

    console.log('\n=== LAYER MAP ANALYSIS ===');

    // Count colors per layer range
    const layerRanges = [
      { name: 'Layers 0-50', start: 0, end: 50 },
      { name: 'Layers 51-100', start: 51, end: 100 },
      { name: 'Layers 101-150', start: 101, end: 150 },
      { name: 'Layers 151-200', start: 151, end: 200 },
      { name: 'Layers 201-266', start: 201, end: 266 },
    ];

    layerRanges.forEach((range) => {
      const layersInRange = [];
      const colorCount = new Map<string, number>();

      for (let layer = range.start; layer <= range.end; layer++) {
        const colors = stats.layerColorMap.get(layer);
        if (colors && colors.length > 0) {
          layersInRange.push(layer);
          colors.forEach((color) => {
            colorCount.set(color, (colorCount.get(color) || 0) + 1);
          });
        }
      }

      console.log(`\n${range.name}:`);
      console.log(`  Layers with colors: ${layersInRange.length}/${range.end - range.start + 1}`);
      colorCount.forEach((count, color) => {
        console.log(`  ${color}: ${count} layers`);
      });
    });

    console.log('\n=== TOOL CHANGES ANALYSIS ===');
    console.log(`Total tool changes: ${stats.toolChanges.length}`);

    // Sample first and last tool changes
    const firstChanges = stats.toolChanges.slice(0, 10);
    const lastChanges = stats.toolChanges.slice(-10);

    console.log('\nFirst 10 tool changes:');
    firstChanges.forEach((change, index) => {
      console.log(`  ${index + 1}. Layer ${change.layer}: ${change.fromTool} -> ${change.toTool}`);
    });

    console.log('\nLast 10 tool changes:');
    lastChanges.forEach((change, index) => {
      const changeNum = stats.toolChanges.length - 10 + index + 1;
      console.log(`  ${changeNum}. Layer ${change.layer}: ${change.fromTool} -> ${change.toTool}`);
    });

    console.log('\n=== ISSUE DETECTION ===');

    // Look for gaps in layer coverage
    const allLayersWithColors = new Set<number>();
    stats.layerColorMap.forEach((colors, layer) => {
      if (colors.length > 0) {
        allLayersWithColors.add(layer);
      }
    });

    const missingLayers: number[] = [];
    for (let layer = 0; layer < stats.totalLayers; layer++) {
      if (!allLayersWithColors.has(layer)) {
        missingLayers.push(layer);
      }
    }

    console.log(`Layers without any colors: ${missingLayers.length}`);
    if (missingLayers.length > 0) {
      console.log(
        `Sample missing layers: [${missingLayers.slice(0, 20).join(', ')}${missingLayers.length > 20 ? '...' : ''}]`
      );
    }

    // Check if T0 (Color 1) appears in early layers
    const t0InFirstTenLayers = [];
    for (let layer = 0; layer < 10; layer++) {
      const colors = stats.layerColorMap.get(layer) || [];
      if (colors.includes('T0')) {
        t0InFirstTenLayers.push(layer);
      }
    }
    console.log(`T0 appears in first 10 layers: [${t0InFirstTenLayers.join(', ')}]`);

    // Check if T0 appears in last ten layers
    const t0InLastTenLayers = [];
    for (let layer = stats.totalLayers - 10; layer < stats.totalLayers; layer++) {
      const colors = stats.layerColorMap.get(layer) || [];
      if (colors.includes('T0')) {
        t0InLastTenLayers.push(layer);
      }
    }
    console.log(`T0 appears in last 10 layers: [${t0InLastTenLayers.join(', ')}]`);

    // Identify the real issue
    if (missingLayers.length > 0) {
      console.log('\n❌ ISSUE: Some layers have no colors assigned');
    }

    if (t0InFirstTenLayers.length === 0) {
      console.log('\n❌ ISSUE: T0 missing from early layers');
    }

    if (t0InLastTenLayers.length === 0) {
      console.log('\n❌ ISSUE: T0 missing from late layers');
    }
  });
});
