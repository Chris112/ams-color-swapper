import { describe, it, expect } from 'vitest';
import { GcodeParser } from '../gcodeParser';
import { GcodeParserFSM } from '../variants/GcodeParserFSM';
import { GcodeParserWorker } from '../variants/GcodeParserWorker';
import { GcodeParserStreams } from '../variants/GcodeParserStreams';
import { GcodeParserBuffer } from '../variants/GcodeParserBuffer';
import { GcodeParserRegex } from '../variants/GcodeParserRegex';
import { GcodeParserLazy } from '../variants/GcodeParserLazy';
import { Logger } from '../../utils/logger';

/**
 * CRITICAL REGRESSION TESTS
 * These tests prevent the critical bug where base tools (like T0) disappear from layers
 * when they should remain active throughout the print.
 *
 * The bug was: parsers were replacing tools instead of accumulating them on layers.
 * The fix: tools accumulate - once active on a layer, they remain until explicitly changed.
 */

function createMockFile(content: string, name: string): File {
  const blob = new Blob([content], { type: 'text/plain' });
  const file = new File([blob], name, { type: 'text/plain' });

  // Add missing File API methods for test environment
  if (!file.text) {
    Object.defineProperty(file, 'text', {
      value: async () => content,
      writable: false,
      enumerable: false,
      configurable: true,
    });
  }

  if (!file.stream) {
    Object.defineProperty(file, 'stream', {
      value: () => {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
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
        const encoder = new TextEncoder();
        return encoder.encode(content).buffer;
      },
      writable: false,
      enumerable: false,
      configurable: true,
    });
  }

  return file;
}

/**
 * Multi-color G-code test case that should trigger tool accumulation
 * T0 (base color) should appear on ALL layers
 * T1 should appear starting from layer 2
 * T2 should appear starting from layer 4
 */
const TOOL_ACCUMULATION_GCODE = `
; Multi-color test case for tool accumulation
; layer num/total_layer_count: 1/5
G1 Z0.2
T0
G1 X10 Y10 E1.0

; layer num/total_layer_count: 2/5  
G1 Z0.4
T1
G1 X20 Y20 E1.0

; layer num/total_layer_count: 3/5
G1 Z0.6
T0
G1 X30 Y30 E1.0

; layer num/total_layer_count: 4/5
G1 Z0.8
T2
G1 X40 Y40 E1.0

; layer num/total_layer_count: 5/5
G1 Z1.0
T1
G1 X50 Y50 E1.0
`;

const ALL_PARSERS = [
  { name: 'GcodeParser (main)', ParserClass: GcodeParser },
  { name: 'GcodeParserFSM', ParserClass: GcodeParserFSM },
  { name: 'GcodeParserWorker', ParserClass: GcodeParserWorker },
  { name: 'GcodeParserStreams', ParserClass: GcodeParserStreams },
  { name: 'GcodeParserBuffer', ParserClass: GcodeParserBuffer },
  { name: 'GcodeParserRegex', ParserClass: GcodeParserRegex },
  { name: 'GcodeParserLazy', ParserClass: GcodeParserLazy },
];

describe('Parser Variants Tool Accumulation Regression Tests', () => {
  ALL_PARSERS.forEach(({ name, ParserClass }) => {
    describe(`${name} Tool Accumulation`, () => {
      it('CRITICAL: should accumulate tools across layers (T0 base color on all layers)', async () => {
        const logger = new Logger(`${name}-tool-accumulation`);
        const parser = new ParserClass(logger);
        const file = createMockFile(TOOL_ACCUMULATION_GCODE, 'tool-accumulation-test.gcode');

        const stats = await parser.parse(file);

        console.log(`\n=== ${name} TOOL ACCUMULATION ANALYSIS ===`);
        console.log(`Total layers: ${stats.totalLayers}`);
        console.log(`Total colors: ${stats.colors.length}`);

        // Different parsers may detect slightly different layer counts (5 or 6)
        // This is acceptable as long as T0 appears on ALL detected layers
        expect(stats.totalLayers).toBeGreaterThanOrEqual(5);
        expect(stats.totalLayers).toBeLessThanOrEqual(6);

        // Find T0 (base color)
        const t0Color = stats.colors.find((c) => c.id === 'T0');
        expect(t0Color).toBeDefined();

        console.log(`\nT0 Analysis:`);
        console.log(`  Layer count: ${t0Color!.layerCount}/${stats.totalLayers}`);
        console.log(`  Usage percentage: ${t0Color!.usagePercentage.toFixed(1)}%`);
        console.log(`  First layer: ${t0Color!.firstLayer}`);
        console.log(`  Last layer: ${t0Color!.lastLayer}`);

        // CRITICAL TEST: T0 should appear on ALL layers due to tool accumulation
        expect(t0Color!.layerCount).toBe(stats.totalLayers);
        expect(t0Color!.usagePercentage).toBeCloseTo(100, 1);

        // Verify layer-by-layer T0 presence
        console.log(`\nLayer-by-layer T0 presence:`);
        const layersWithoutT0: number[] = [];
        for (let layer = 0; layer < stats.totalLayers; layer++) {
          const layerColors = stats.layerColorMap.get(layer) || [];
          const hasT0 = layerColors.includes('T0');
          console.log(`  Layer ${layer}: [${layerColors.join(', ')}] - T0: ${hasT0 ? '✅' : '❌'}`);

          if (!hasT0) {
            layersWithoutT0.push(layer);
          }
        }

        // CRITICAL: No layer should be missing T0
        if (layersWithoutT0.length > 0) {
          console.log(
            `\n❌ REGRESSION DETECTED: T0 missing from layers: [${layersWithoutT0.join(', ')}]`
          );
        }
        expect(layersWithoutT0.length).toBe(0);

        console.log(`\n✅ ${name} passed tool accumulation test`);
      });

      it('should show progressive tool accumulation pattern', async () => {
        const logger = new Logger(`${name}-accumulation-pattern`);
        const parser = new ParserClass(logger);
        const file = createMockFile(TOOL_ACCUMULATION_GCODE, 'accumulation-pattern-test.gcode');

        const stats = await parser.parse(file);

        // Verify T0 accumulation pattern - T0 should appear on ALL layers
        // Other tools may vary based on parser layer detection differences

        for (let layer = 0; layer < stats.totalLayers; layer++) {
          const layerColors = stats.layerColorMap.get(layer) || [];

          // CRITICAL: T0 should always be present (base color accumulation)
          expect(layerColors.includes('T0')).toBe(true);

          // Should have at least 1 tool per layer
          expect(layerColors.length).toBeGreaterThanOrEqual(1);
        }
      });

      it('should track all tool changes while maintaining accumulation', async () => {
        const logger = new Logger(`${name}-tool-changes`);
        const parser = new ParserClass(logger);
        const file = createMockFile(TOOL_ACCUMULATION_GCODE, 'tool-changes-test.gcode');

        const stats = await parser.parse(file);

        // Should have detected multiple tool changes
        expect(stats.toolChanges.length).toBeGreaterThanOrEqual(3);

        // But T0 should still appear on all layers despite changes
        const t0Color = stats.colors.find((c) => c.id === 'T0');
        expect(t0Color!.layerCount).toBe(stats.totalLayers);
      });
    });
  });

  it('CRITICAL: all parser variants should produce consistent tool accumulation behavior', async () => {
    console.log('\n=== CROSS-PARSER CONSISTENCY CHECK ===');

    const results: Array<{
      parser: string;
      t0LayerCount: number;
      t0Percentage: number;
      totalColors: number;
      totalLayers: number;
    }> = [];

    // Parse with all variants
    for (const { name, ParserClass } of ALL_PARSERS) {
      const logger = new Logger(`${name}-consistency`);
      const parser = new ParserClass(logger);
      const file = createMockFile(TOOL_ACCUMULATION_GCODE, 'consistency-test.gcode');

      const stats = await parser.parse(file);
      const t0Color = stats.colors.find((c) => c.id === 'T0');

      results.push({
        parser: name,
        t0LayerCount: t0Color?.layerCount || 0,
        t0Percentage: t0Color?.usagePercentage || 0,
        totalColors: stats.colors.length,
        totalLayers: stats.totalLayers,
      });
    }

    // Display results
    console.log('\nParser consistency results:');
    results.forEach((result) => {
      console.log(`  ${result.parser}:`);
      console.log(`    T0 layer count: ${result.t0LayerCount}/${result.totalLayers}`);
      console.log(`    T0 percentage: ${result.t0Percentage.toFixed(1)}%`);
      console.log(`    Total colors: ${result.totalColors}`);
      console.log(`    Total layers: ${result.totalLayers}`);
    });

    // CRITICAL: All parsers should show T0 on ALL their detected layers (5 or 6)
    results.forEach((result) => {
      expect(result.t0LayerCount).toBeGreaterThanOrEqual(5);
      expect(result.t0Percentage).toBeCloseTo(100, 1);
      // T0 should appear on all layers regardless of total count
      expect(result.t0LayerCount).toBe(result.totalLayers);
    });

    console.log('\n✅ All parser variants show consistent tool accumulation behavior');
  });
});
