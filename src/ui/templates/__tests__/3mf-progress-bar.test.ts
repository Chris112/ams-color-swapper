import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Gcode3mfParser } from '../../../parser/Gcode3mfParser';
import { GcodeParser } from '../../../parser/gcodeParser';
import { Logger } from '../../../utils/logger';
import { colorStatsTemplate } from '../index';

describe('3MF Progress Bar Integration', () => {
  it('should show correct progress bar percentages for real 3MF file', async () => {
    const filePath = resolve(__dirname, '../../../../examples/2_color_cube.gcode.3mf');
    const fileContent = readFileSync(filePath);
    const blob = new Blob([fileContent], { type: 'application/zip' });
    const file = new File([blob], '2_color_cube.gcode.3mf', { type: 'application/zip' });

    if (!file.arrayBuffer) {
      (file as any).arrayBuffer = async () =>
        fileContent.buffer.slice(
          fileContent.byteOffset,
          fileContent.byteOffset + fileContent.byteLength
        );
    }

    const logger = new Logger('3mf-progress-test');
    const baseParser = new GcodeParser(logger);
    const parser = new Gcode3mfParser(baseParser, logger);

    const stats = await parser.parse(file);

    // Generate HTML template
    const html = colorStatsTemplate(stats.colors, stats.filamentEstimates);

    console.log('\n=== Progress Bar Validation ===');
    console.log(`Total colors: ${stats.colors.length}`);
    console.log(`Filament estimates: ${stats.filamentEstimates?.length || 0}`);

    if (stats.filamentEstimates) {
      const totalWeight = stats.filamentEstimates.reduce((sum, est) => sum + (est.weight || 0), 0);
      console.log(`Total weight: ${totalWeight}g`);

      stats.filamentEstimates.forEach((est) => {
        const percentage = (est.weight! / totalWeight) * 100;
        console.log(`${est.colorId}: ${est.weight}g (${percentage.toFixed(1)}%)`);
      });
    }

    // Verify progress bars are NOT showing 0%
    expect(html).not.toContain('width: 0%');
    expect(html).not.toContain('0.0%');

    // Should show the correct percentages based on real data
    // T0: 2.32g / 6.07g = 38.2%
    // T5: 3.75g / 6.07g = 61.8%
    expect(html).toContain('38.2%');
    expect(html).toContain('61.8%');

    // Should show progress bars with actual width
    expect(html).toMatch(/width: 38\.\d+%/); // T0 progress bar
    expect(html).toMatch(/width: 61\.\d+%/); // T5 progress bar

    console.log('✅ Progress bars showing correct weight-based percentages');
  });
});
