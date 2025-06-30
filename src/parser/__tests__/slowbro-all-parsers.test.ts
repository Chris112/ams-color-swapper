import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { GcodeParser } from '../gcodeParser';
import { GcodeParserFSM } from '../variants/GcodeParserFSM';
import { GcodeParserWorker } from '../variants/GcodeParserWorker';
import { GcodeParserStreams } from '../variants/GcodeParserStreams';
import { GcodeParserBuffer } from '../variants/GcodeParserBuffer';
import { GcodeParserRegex } from '../variants/GcodeParserRegex';
import { GcodeParserLazy } from '../variants/GcodeParserLazy';
import { Logger } from '../../utils/logger';

/**
 * CRITICAL REGRESSION TEST: Slowbro T0 Base Color Coverage
 *
 * This test ensures that ALL parser variants correctly identify T0 (base color)
 * as appearing on ALL 197 layers in the Slowbro model.
 *
 * This was the original issue reported by the user:
 * "T0 should appear on 100% of layers as the base color"
 */

const ALL_PARSERS = [
  { name: 'GcodeParser (main)', ParserClass: GcodeParser },
  { name: 'GcodeParserFSM', ParserClass: GcodeParserFSM },
  { name: 'GcodeParserWorker', ParserClass: GcodeParserWorker },
  { name: 'GcodeParserStreams', ParserClass: GcodeParserStreams },
  { name: 'GcodeParserBuffer', ParserClass: GcodeParserBuffer },
  { name: 'GcodeParserRegex', ParserClass: GcodeParserRegex },
  { name: 'GcodeParserLazy', ParserClass: GcodeParserLazy },
];

describe('Slowbro Base Color Regression Test - All Parser Variants', () => {
  const filePath = resolve(__dirname, '../../../examples/6_color_Slowbro.gcode');

  ALL_PARSERS.forEach(({ name, ParserClass }) => {
    it(`CRITICAL: ${name} should show T0 on ALL 197 Slowbro layers`, async () => {
      // Read the file
      const fileContent = readFileSync(filePath);
      const blob = new Blob([fileContent], { type: 'text/plain' });
      const file = new File([blob], '6_color_Slowbro.gcode', { type: 'text/plain' });

      // Add missing File API methods for test environment
      if (!file.text) {
        Object.defineProperty(file, 'text', {
          value: async () => fileContent.toString(),
          writable: false,
          enumerable: false,
          configurable: true,
        });
      }

      if (!file.stream) {
        Object.defineProperty(file, 'stream', {
          value: () => {
            return new ReadableStream({
              start(controller) {
                controller.enqueue(fileContent);
                controller.close();
              },
            });
          },
          writable: false,
          enumerable: false,
          configurable: true,
        });
      }

      if (!file.arrayBuffer) {
        Object.defineProperty(file, 'arrayBuffer', {
          value: async () => fileContent.buffer,
          writable: false,
          enumerable: false,
          configurable: true,
        });
      }

      console.log(`\n=== ${name} SLOWBRO ANALYSIS ===`);
      console.log(`File size: ${file.size} bytes`);

      // Parse with specific variant
      const logger = new Logger(`${name}-slowbro`);
      const parser = new ParserClass(logger);

      const startTime = Date.now();
      const stats = await parser.parse(file);
      const parseTime = Date.now() - startTime;

      console.log(`Parse time: ${parseTime}ms`);
      console.log(`Total layers: ${stats.totalLayers}`);
      console.log(`Colors found: ${stats.colors.length}`);

      // Expected values for Slowbro
      expect(stats.totalLayers).toBe(197);
      expect(stats.colors.length).toBe(6);

      // Find T0 (base color)
      const t0Color = stats.colors.find((c) => c.id === 'T0');
      expect(t0Color).toBeDefined();

      console.log(`\nT0 COVERAGE ANALYSIS:`);
      console.log(`  Layer coverage: ${t0Color!.layerCount}/${stats.totalLayers} layers`);
      console.log(`  Usage percentage: ${t0Color!.usagePercentage.toFixed(1)}%`);
      console.log(`  Layer range: ${t0Color!.firstLayer}-${t0Color!.lastLayer}`);

      // CRITICAL TEST: T0 should appear on ALL 197 layers
      expect(t0Color!.layerCount).toBe(197);
      expect(t0Color!.usagePercentage).toBeCloseTo(100, 1);

      // Verify no layers are missing T0
      const layersWithoutT0: number[] = [];
      for (let layer = 0; layer < stats.totalLayers; layer++) {
        const layerColors = stats.layerColorMap.get(layer) || [];
        if (!layerColors.includes('T0')) {
          layersWithoutT0.push(layer);
        }
      }

      console.log(`  Layers without T0: ${layersWithoutT0.length}/${stats.totalLayers}`);

      if (layersWithoutT0.length > 0) {
        const sample = layersWithoutT0.slice(0, 10);
        console.log(
          `  Sample missing layers: [${sample.join(', ')}${layersWithoutT0.length > 10 ? '...' : ''}]`
        );
        console.log(`  ❌ REGRESSION: T0 base color missing from layers!`);
      } else {
        console.log(`  ✅ T0 appears on ALL layers - base color correctly identified`);
      }

      // CRITICAL: No layer should be missing T0
      expect(layersWithoutT0.length).toBe(0);
    });
  });

  it('CRITICAL: all parser variants should produce identical T0 coverage for Slowbro', async () => {
    console.log('\n=== SLOWBRO CROSS-PARSER CONSISTENCY ===');

    const results: Array<{
      parser: string;
      t0LayerCount: number;
      t0Percentage: number;
      totalLayers: number;
      missingLayers: number;
    }> = [];

    // Parse Slowbro with all variants
    for (const { name, ParserClass } of ALL_PARSERS) {
      const fileContent = readFileSync(filePath);
      const blob = new Blob([fileContent], { type: 'text/plain' });
      const file = new File([blob], '6_color_Slowbro.gcode', { type: 'text/plain' });

      // Add missing File API methods for test environment
      if (!file.text) {
        Object.defineProperty(file, 'text', {
          value: async () => fileContent.toString(),
          writable: false,
          enumerable: false,
          configurable: true,
        });
      }

      if (!file.stream) {
        Object.defineProperty(file, 'stream', {
          value: () => {
            return new ReadableStream({
              start(controller) {
                controller.enqueue(fileContent);
                controller.close();
              },
            });
          },
          writable: false,
          enumerable: false,
          configurable: true,
        });
      }

      if (!file.arrayBuffer) {
        Object.defineProperty(file, 'arrayBuffer', {
          value: async () => fileContent.buffer,
          writable: false,
          enumerable: false,
          configurable: true,
        });
      }

      const logger = new Logger(`${name}-slowbro-consistency`);
      const parser = new ParserClass(logger);
      const stats = await parser.parse(file);

      const t0Color = stats.colors.find((c) => c.id === 'T0');

      // Count missing T0 layers
      let missingT0Layers = 0;
      for (let layer = 0; layer < stats.totalLayers; layer++) {
        const layerColors = stats.layerColorMap.get(layer) || [];
        if (!layerColors.includes('T0')) {
          missingT0Layers++;
        }
      }

      results.push({
        parser: name,
        t0LayerCount: t0Color?.layerCount || 0,
        t0Percentage: t0Color?.usagePercentage || 0,
        totalLayers: stats.totalLayers,
        missingLayers: missingT0Layers,
      });
    }

    // Display consistency results
    console.log('\nSlowbro T0 coverage across all parsers:');
    results.forEach((result) => {
      const status = result.missingLayers === 0 ? '✅' : '❌';
      console.log(`  ${status} ${result.parser}:`);
      console.log(
        `    T0 coverage: ${result.t0LayerCount}/${result.totalLayers} layers (${result.t0Percentage.toFixed(1)}%)`
      );
      console.log(`    Missing T0: ${result.missingLayers} layers`);
    });

    // CRITICAL: All parsers must show perfect T0 coverage
    results.forEach((result) => {
      expect(result.t0LayerCount).toBe(197);
      expect(result.t0Percentage).toBeCloseTo(100, 1);
      expect(result.missingLayers).toBe(0);
      expect(result.totalLayers).toBe(197);
    });

    console.log('\n✅ All parser variants show perfect T0 base color coverage for Slowbro');
  });
});
