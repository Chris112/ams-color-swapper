import { describe, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { GcodeParser } from '../gcodeParser';
import { Logger } from '../../utils/logger';

describe('Slowbro Layer Coverage Analysis', () => {
  const filePath = resolve(__dirname, '../../../examples/6_color_Slowbro.gcode');

  it('should analyze T0 coverage in Slowbro model', async () => {
    // Read and parse the file
    const fileContent = readFileSync(filePath);
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const file = new File([blob], '6_color_Slowbro.gcode', { type: 'text/plain' });

    console.log('\n=== SLOWBRO ANALYSIS ===');
    console.log(`File size: ${file.size} bytes`);

    const logger = new Logger('slowbro-test');
    const parser = new GcodeParser(logger);
    const stats = await parser.parse(file);

    console.log(`Total layers: ${stats.totalLayers}`);
    console.log(`Colors found: ${stats.colors.length}`);
    console.log(`Tool changes: ${stats.toolChanges.length}`);

    // Check every single layer for T0 presence
    const layersWithoutT0: number[] = [];
    const layersWithT0: number[] = [];

    for (let layer = 0; layer < stats.totalLayers; layer++) {
      const colorsOnLayer = stats.layerColorMap.get(layer) || [];
      if (colorsOnLayer.includes('T0')) {
        layersWithT0.push(layer);
      } else {
        layersWithoutT0.push(layer);
      }
    }

    console.log(`\nT0 COVERAGE ANALYSIS:`);
    console.log(`Layers WITH T0: ${layersWithT0.length}/${stats.totalLayers}`);
    console.log(`Layers WITHOUT T0: ${layersWithoutT0.length}/${stats.totalLayers}`);
    console.log(
      `T0 layer coverage: ${((layersWithT0.length / stats.totalLayers) * 100).toFixed(1)}%`
    );

    // Color breakdown
    console.log('\n=== COLOR BREAKDOWN ===');
    stats.colors.forEach((color) => {
      console.log(`${color.name} (${color.id}):`);
      console.log(
        `  Layer coverage: ${((color.layerCount / stats.totalLayers) * 100).toFixed(1)}% (${color.layerCount}/${stats.totalLayers} layers)`
      );
      console.log(`  Volume percentage: ${color.usagePercentage.toFixed(1)}%`);
      console.log(`  Layer range: ${color.firstLayer}-${color.lastLayer}`);
    });

    // If T0 is missing from layers, show where
    if (layersWithoutT0.length > 0) {
      console.log('\n=== LAYERS MISSING T0 ===');
      const missingRanges: string[] = [];
      let rangeStart = layersWithoutT0[0];
      let rangeEnd = layersWithoutT0[0];

      for (let i = 1; i < layersWithoutT0.length; i++) {
        const currentLayer = layersWithoutT0[i];
        const prevLayer = layersWithoutT0[i - 1];

        if (currentLayer === prevLayer + 1) {
          rangeEnd = currentLayer;
        } else {
          if (rangeStart === rangeEnd) {
            missingRanges.push(`${rangeStart}`);
          } else {
            missingRanges.push(`${rangeStart}-${rangeEnd}`);
          }
          rangeStart = currentLayer;
          rangeEnd = currentLayer;
        }
      }

      if (rangeStart === rangeEnd) {
        missingRanges.push(`${rangeStart}`);
      } else {
        missingRanges.push(`${rangeStart}-${rangeEnd}`);
      }

      console.log(`Missing T0 on layers: ${missingRanges.join(', ')}`);

      // Show what colors ARE on the first few missing layers
      console.log('\nColors on T0-missing layers (first 10):');
      layersWithoutT0.slice(0, 10).forEach((layer) => {
        const colors = stats.layerColorMap.get(layer) || [];
        console.log(`  Layer ${layer}: [${colors.join(', ')}]`);
      });
    }

    // Check if T0 should be expected on all layers
    console.log('\n=== EXPECTATION CHECK ===');
    if (layersWithoutT0.length === 0) {
      console.log('✅ T0 appears on ALL layers - matches expectation for base color');
    } else {
      console.log(`❌ T0 missing from ${layersWithoutT0.length} layers`);

      // Check if T0 disappears permanently at some point
      const lastT0Layer = Math.max(...layersWithT0);
      const finalLayersWithoutT0 = layersWithoutT0.filter((layer) => layer > lastT0Layer);

      if (finalLayersWithoutT0.length > 0) {
        console.log(`📍 T0 permanently stops after layer ${lastT0Layer}`);
        console.log(`📍 Final ${finalLayersWithoutT0.length} layers don't use T0`);
      } else {
        console.log('📍 T0 appears sporadically throughout the print');
      }
    }

    // Check tool changes pattern
    console.log('\n=== TOOL CHANGE PATTERN ===');
    const toolChangesByLayer = new Map<number, string[]>();
    stats.toolChanges.forEach((change) => {
      if (!toolChangesByLayer.has(change.layer)) {
        toolChangesByLayer.set(change.layer, []);
      }
      toolChangesByLayer.get(change.layer)!.push(`${change.fromTool}→${change.toTool}`);
    });

    // Show first 10 layers with tool changes
    console.log('First 10 layers with tool changes:');
    let count = 0;
    for (let layer = 0; layer < stats.totalLayers && count < 10; layer++) {
      const changes = toolChangesByLayer.get(layer) || [];
      const colors = stats.layerColorMap.get(layer) || [];
      if (changes.length > 0) {
        console.log(
          `  Layer ${layer}: Changes=[${changes.join(', ')}] Colors=[${colors.join(', ')}]`
        );
        count++;
      }
    }
  });

  it('should check color definitions in Slowbro G-code', async () => {
    const fileContent = readFileSync(filePath, 'utf-8');

    console.log('\n=== SLOWBRO COLOR DEFINITIONS ===');

    // Look for color definitions
    const colorLines = fileContent
      .split('\n')
      .filter((line) => line.includes('extruder_colour') || line.includes('filament_colour'));

    colorLines.forEach((line) => {
      console.log(line.trim());
    });

    // Look for slicer info
    const slicerLines = fileContent
      .split('\n')
      .filter((line) => line.includes('generated by') || line.includes('Slicer'));

    console.log('\nSlicer information:');
    slicerLines.forEach((line) => {
      console.log(line.trim());
    });

    // Look for total layer count
    const layerLines = fileContent
      .split('\n')
      .filter((line) => line.includes('total layer number') || line.includes('layer_count'));

    console.log('\nLayer count information:');
    layerLines.forEach((line) => {
      console.log(line.trim());
    });
  });
});
