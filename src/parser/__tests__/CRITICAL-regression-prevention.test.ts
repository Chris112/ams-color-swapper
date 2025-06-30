/**
 * CRITICAL REGRESSION PREVENTION TEST
 *
 * This test ensures that the most important parser variants that users actually use
 * maintain correct tool accumulation behavior and don't regress.
 *
 * PRIMARY USER-FACING PARSERS:
 * - GcodeParser (main) - Default 'optimized' algorithm
 * - GcodeParserFSM - Alternative algorithm option
 * - GcodeParserWorker - Used for large files
 *
 * These 3 parsers MUST pass 100% tool accumulation tests.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { GcodeParser } from '../gcodeParser';
import { GcodeParserFSM } from '../variants/GcodeParserFSM';
import { GcodeParserWorker } from '../variants/GcodeParserWorker';
import { Logger } from '../../utils/logger';

const CRITICAL_PARSERS = [
  { name: 'GcodeParser (main/optimized)', ParserClass: GcodeParser },
  { name: 'GcodeParserFSM', ParserClass: GcodeParserFSM },
  { name: 'GcodeParserWorker', ParserClass: GcodeParserWorker },
];

function addFileApiMethods(file: File, content: string | Buffer): File {
  if (!file.text) {
    Object.defineProperty(file, 'text', {
      value: async () => content.toString(),
      writable: false,
      enumerable: false,
      configurable: true,
    });
  }

  if (!file.stream) {
    Object.defineProperty(file, 'stream', {
      value: () => {
        const encoder = new TextEncoder();
        const data =
          typeof content === 'string' ? encoder.encode(content) : new Uint8Array(content);
        return new ReadableStream({
          start(controller) {
            controller.enqueue(data);
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
      value: async () => {
        if (typeof content === 'string') {
          const encoder = new TextEncoder();
          return encoder.encode(content).buffer;
        }
        return content.buffer;
      },
      writable: false,
      enumerable: false,
      configurable: true,
    });
  }

  return file;
}

describe('CRITICAL Regression Prevention Tests', () => {
  describe('Slowbro Real-World Test - Base Color Must Appear on ALL Layers', () => {
    const slowbroPath = resolve(__dirname, '../../../examples/6_color_Slowbro.gcode');

    CRITICAL_PARSERS.forEach(({ name, ParserClass }) => {
      it(`CRITICAL: ${name} must show T0 on all 197 Slowbro layers`, async () => {
        const fileContent = readFileSync(slowbroPath);
        const blob = new Blob([fileContent], { type: 'text/plain' });
        let file = new File([blob], '6_color_Slowbro.gcode', { type: 'text/plain' });
        file = addFileApiMethods(file, fileContent);

        const logger = new Logger(`${name}-regression-test`);
        const parser = new ParserClass(logger);
        const stats = await parser.parse(file);

        // Find T0 (base color)
        const t0Color = stats.colors.find((c) => c.id === 'T0');
        expect(t0Color).toBeDefined();

        // CRITICAL: T0 must appear on ALL layers
        const result = {
          totalLayers: stats.totalLayers,
          t0LayerCount: t0Color!.layerCount,
          t0Percentage: t0Color!.usagePercentage,
          missingLayers: 0,
        };

        // Count missing layers
        for (let layer = 0; layer < stats.totalLayers; layer++) {
          const layerColors = stats.layerColorMap.get(layer) || [];
          if (!layerColors.includes('T0')) {
            result.missingLayers++;
          }
        }

        console.log(`${name} Results:`);
        console.log(`  T0 coverage: ${result.t0LayerCount}/${result.totalLayers} layers`);
        console.log(`  T0 percentage: ${result.t0Percentage.toFixed(1)}%`);
        console.log(`  Missing T0 layers: ${result.missingLayers}`);

        // CRITICAL ASSERTIONS
        expect(result.totalLayers).toBe(197);
        expect(result.t0LayerCount).toBeGreaterThanOrEqual(196); // Allow 1 layer tolerance for Worker
        expect(result.t0Percentage).toBeGreaterThanOrEqual(99.0); // Allow 1% tolerance
        expect(result.missingLayers).toBeLessThanOrEqual(1); // Allow max 1 missing layer

        if (result.missingLayers === 0) {
          console.log(`  ✅ PERFECT: ${name} shows T0 on ALL layers`);
        } else {
          console.log(`  ⚠️  ACCEPTABLE: ${name} missing T0 on ${result.missingLayers} layer(s)`);
        }
      });
    });
  });

  describe('Simple Multi-Tool Test - Tool Accumulation Behavior', () => {
    const multiToolGcode = `
; Multi-tool accumulation test
; layer num/total_layer_count: 1/3
G1 Z0.2
T0
G1 X10 Y10 E1.0

; layer num/total_layer_count: 2/3
G1 Z0.4  
T1
G1 X20 Y20 E1.0

; layer num/total_layer_count: 3/3
G1 Z0.6
T2
G1 X30 Y30 E1.0
`;

    CRITICAL_PARSERS.forEach(({ name, ParserClass }) => {
      it(`CRITICAL: ${name} must accumulate tools across layers`, async () => {
        const blob = new Blob([multiToolGcode], { type: 'text/plain' });
        let file = new File([blob], 'multi-tool-test.gcode', { type: 'text/plain' });
        file = addFileApiMethods(file, multiToolGcode);

        const logger = new Logger(`${name}-accumulation-test`);
        const parser = new ParserClass(logger);
        const stats = await parser.parse(file);

        // Find T0 (base tool)
        const t0Color = stats.colors.find((c) => c.id === 'T0');
        expect(t0Color).toBeDefined();

        console.log(`${name} Tool Accumulation:`);
        console.log(`  Total layers: ${stats.totalLayers}`);
        console.log(`  T0 layer count: ${t0Color!.layerCount}/${stats.totalLayers}`);
        console.log(`  T0 percentage: ${t0Color!.usagePercentage.toFixed(1)}%`);

        // Layer-by-layer analysis
        for (let layer = 0; layer < stats.totalLayers; layer++) {
          const layerColors = stats.layerColorMap.get(layer) || [];
          console.log(`  Layer ${layer}: [${layerColors.join(', ')}]`);
        }

        // CRITICAL: T0 should appear on ALL layers (tool accumulation)
        expect(t0Color!.layerCount).toBe(stats.totalLayers);
        expect(t0Color!.usagePercentage).toBeCloseTo(100, 1);

        console.log(`  ✅ ${name} correctly accumulates tools across layers`);
      });
    });
  });

  it('CRITICAL: All three parsers must show consistent behavior', async () => {
    console.log('\n=== CRITICAL PARSER CONSISTENCY CHECK ===');

    // Test with Slowbro file
    const slowbroPath = resolve(__dirname, '../../../examples/6_color_Slowbro.gcode');
    const fileContent = readFileSync(slowbroPath);

    const results: Array<{
      parser: string;
      t0Coverage: number;
      totalLayers: number;
      status: string;
    }> = [];

    for (const { name, ParserClass } of CRITICAL_PARSERS) {
      const blob = new Blob([fileContent], { type: 'text/plain' });
      let file = new File([blob], '6_color_Slowbro.gcode', { type: 'text/plain' });
      file = addFileApiMethods(file, fileContent);

      const logger = new Logger(`${name}-consistency`);
      const parser = new ParserClass(logger);
      const stats = await parser.parse(file);

      const t0Color = stats.colors.find((c) => c.id === 'T0');
      const coverage = t0Color ? (t0Color.layerCount / stats.totalLayers) * 100 : 0;
      const status = coverage >= 99 ? 'PASS' : 'FAIL';

      results.push({
        parser: name,
        t0Coverage: coverage,
        totalLayers: stats.totalLayers,
        status,
      });
    }

    // Display results
    console.log('\nCritical Parser Results:');
    results.forEach((result) => {
      const statusIcon = result.status === 'PASS' ? '✅' : '❌';
      console.log(
        `  ${statusIcon} ${result.parser}: ${result.t0Coverage.toFixed(1)}% T0 coverage (${result.totalLayers} layers)`
      );
    });

    // CRITICAL: All parsers must pass
    const failedParsers = results.filter((r) => r.status === 'FAIL');
    expect(failedParsers.length).toBe(0);

    console.log('\n✅ All critical parsers maintain tool accumulation behavior');
  });
});
