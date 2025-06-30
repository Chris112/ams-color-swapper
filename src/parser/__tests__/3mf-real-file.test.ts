import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Gcode3mfParser } from '../Gcode3mfParser';
import { GcodeParser } from '../gcodeParser';
import { extractGcodeFrom3mf } from '../../utils/3mfUtils';
import { Logger } from '../../utils/logger';

describe('3MF Real File Integration Test', () => {
  let fileContent: Buffer;
  let file: File;

  beforeAll(() => {
    // Load the actual 3MF file
    const filePath = resolve(__dirname, '../../../examples/2_color_cube.gcode.3mf');
    fileContent = readFileSync(filePath);

    // Create a File-like object with the methods we need
    const blob = new Blob([fileContent], { type: 'application/zip' });
    file = new File([blob], '2_color_cube.gcode.3mf', { type: 'application/zip' });

    // Add arrayBuffer method if it doesn't exist (for Node.js environment)
    if (!file.arrayBuffer) {
      (file as any).arrayBuffer = async () =>
        fileContent.buffer.slice(
          fileContent.byteOffset,
          fileContent.byteOffset + fileContent.byteLength
        );
    }
  });

  it('should extract and parse 2_color_cube.gcode.3mf with all metadata preserved', async () => {
    const logger = new Logger('test');
    const baseParser = new GcodeParser(logger);
    const parser = new Gcode3mfParser(baseParser, logger);

    // Parse the 3MF file
    const stats = await parser.parse(file);

    // Basic file info
    expect(stats.fileName).toBe('2_color_cube.gcode.3mf');
    expect(stats.is3mfFile).toBe(true);

    // Check that we have colors
    expect(stats.colors).toBeDefined();
    expect(stats.colors.length).toBeGreaterThan(0);
    console.log(`Found ${stats.colors.length} colors in the print`);

    // Check for print cost
    if (stats.printCost !== undefined) {
      console.log(`Print cost: $${stats.printCost}`);
      expect(stats.printCost).toBeGreaterThan(0);
    }

    // Check for filament estimates
    expect(stats.filamentEstimates).toBeDefined();
    if (stats.filamentEstimates) {
      console.log(`Filament estimates:`, stats.filamentEstimates);
      expect(stats.filamentEstimates.length).toBeGreaterThan(0);

      // Each estimate should have weight
      stats.filamentEstimates.forEach((est) => {
        expect(est.weight).toBeDefined();
        expect(est.weight).toBeGreaterThan(0);
      });
    }

    // Check for filament usage stats
    expect(stats.filamentUsageStats).toBeDefined();
    if (stats.filamentUsageStats) {
      console.log('Filament usage stats:', stats.filamentUsageStats);
      expect(stats.filamentUsageStats.total).toBeGreaterThan(0);

      // For this particular file, model/support breakdown might not be available
      // Just check that we have the total
      expect(stats.filamentUsageStats.total).toBeGreaterThan(0);
    }

    // Check 3MF metadata
    expect(stats.threeMfMetadata).toBeDefined();
    if (stats.threeMfMetadata) {
      console.log('3MF metadata:', {
        colors: stats.threeMfMetadata.filament_colors,
        bedType: stats.threeMfMetadata.bed_type,
        nozzleDiameter: stats.threeMfMetadata.nozzle_diameter,
      });
    }

    // Check slicer info
    expect(stats.slicerInfo).toBeDefined();
    if (stats.slicerInfo) {
      console.log('Slicer info:', stats.slicerInfo);
    }

    // Print time should be available
    expect(stats.printTime).toBeDefined();
    console.log(`Print time: ${stats.printTime}`);
  });

  it('should compare 3MF parsing with direct G-code parsing', async () => {
    // First, extract the G-code from the 3MF
    const extractionResult = await extractGcodeFrom3mf(file);
    expect(extractionResult.gcode).toBeDefined();

    // Parse the extracted G-code directly
    const gcodeFile = new File([extractionResult.gcode], 'extracted.gcode', { type: 'text/plain' });
    const logger = new Logger('test');
    const directParser = new GcodeParser(logger);
    const directStats = await directParser.parse(gcodeFile);

    // Parse via 3MF parser
    const baseParser = new GcodeParser(logger);
    const threeMfParser = new Gcode3mfParser(baseParser, logger);
    const threeMfStats = await threeMfParser.parse(file);

    // Compare key statistics
    console.log('\n=== Comparison ===');
    console.log('Direct G-code stats:');
    console.log('- Colors:', directStats.colors.length);
    console.log('- Print cost:', directStats.printCost);
    console.log('- Filament total:', directStats.filamentUsageStats?.total);
    console.log('- Filament estimates:', directStats.filamentEstimates?.length);

    console.log('\n3MF parsed stats:');
    console.log('- Colors:', threeMfStats.colors.length);
    console.log('- Print cost:', threeMfStats.printCost);
    console.log('- Filament total:', threeMfStats.filamentUsageStats?.total);
    console.log('- Filament estimates:', threeMfStats.filamentEstimates?.length);

    // The 3MF parser should preserve all the base statistics
    expect(threeMfStats.totalLayers).toBe(directStats.totalLayers);
    expect(threeMfStats.totalHeight).toBeCloseTo(directStats.totalHeight, 2);
    expect(threeMfStats.printCost).toBe(directStats.printCost);
    expect(threeMfStats.filamentUsageStats).toEqual(directStats.filamentUsageStats);
    expect(threeMfStats.filamentEstimates?.length).toBe(directStats.filamentEstimates?.length);

    // But should have enhanced color information
    expect(threeMfStats.colors.length).toBe(directStats.colors.length);

    // And additional 3MF metadata
    expect(threeMfStats.is3mfFile).toBe(true);
    expect(threeMfStats.threeMfMetadata).toBeDefined();
  });

  it('should display all required UI fields from 3MF parsing', async () => {
    const logger = new Logger('test');
    const baseParser = new GcodeParser(logger);
    const parser = new Gcode3mfParser(baseParser, logger);

    const stats = await parser.parse(file);

    // Check all fields that the UI needs
    // From fileStatsTemplate in ui/templates/index.ts
    expect(stats.colors).toBeDefined();
    expect(stats.colors.length).toBeGreaterThan(0);

    // Total weight calculation needs filamentEstimates
    expect(stats.filamentEstimates).toBeDefined();
    const totalWeight =
      stats.filamentEstimates?.reduce((sum, est) => sum + (est.weight || 0), 0) || 0;
    expect(totalWeight).toBeGreaterThan(0);
    console.log(`Total filament weight for UI: ${totalWeight.toFixed(1)}g`);

    // Print cost display
    if (stats.printCost) {
      const costDisplay = `$${stats.printCost.toFixed(2)}`;
      console.log(`Print cost for UI: ${costDisplay}`);
    } else {
      console.log('Print cost for UI: N/A');
    }

    // Print time
    expect(stats.printTime).toBeDefined();
    console.log(`Print time for UI: ${stats.printTime || 'N/A'}`);

    // Tool changes
    expect(stats.toolChanges).toBeDefined();
    console.log(`Tool changes for UI: ${stats.toolChanges.length}`);

    // For filament usage by color chart
    if (stats.filamentEstimates) {
      console.log('\nFilament usage by color for UI:');
      stats.filamentEstimates.forEach((est) => {
        const percentage = totalWeight > 0 ? ((est.weight || 0) / totalWeight) * 100 : 0;
        console.log(
          `- ${est.colorId}: ${(est.weight || 0).toFixed(1)}g (${percentage.toFixed(1)}%)`
        );
      });
    }
  });
});
