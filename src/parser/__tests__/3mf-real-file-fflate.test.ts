import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { unzipSync } from 'fflate';
import { Gcode3mfParser } from '../Gcode3mfParser';
import { GcodeParser } from '../gcodeParser';
import { Logger } from '../../utils/logger';

describe('3MF Real File Test with fflate', () => {
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

  it('should extract G-code using fflate like the real app', async () => {
    // Use fflate to unzip just like the app does
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const unzipped = unzipSync(uint8Array);

    console.log('Files in 3MF archive:', Object.keys(unzipped));

    // Find the G-code file
    const gcodeEntry = Object.entries(unzipped).find(
      ([name]) => name.endsWith('.gcode') && !name.includes('thumbnail')
    );

    expect(gcodeEntry).toBeDefined();
    if (gcodeEntry) {
      const [gcodeName, gcodeData] = gcodeEntry;
      console.log(`Found G-code file: ${gcodeName}`);

      // Convert to string and check header
      const gcodeContent = new TextDecoder().decode(gcodeData);
      const lines = gcodeContent.split('\n').slice(0, 50);

      // Look for metadata in the G-code
      console.log('\nG-code metadata:');
      lines.forEach((line) => {
        if (line.includes('filament') || line.includes('cost') || line.includes('time')) {
          console.log(line.trim());
        }
      });
    }
  });

  it('should parse 3MF and extract all statistics correctly', async () => {
    const logger = new Logger('test');
    const baseParser = new GcodeParser(logger);
    const parser = new Gcode3mfParser(baseParser, logger);

    // Parse the 3MF file
    const stats = await parser.parse(file);

    console.log('\n=== Parsed Statistics ===');
    console.log('File name:', stats.fileName);
    console.log('Is 3MF:', stats.is3mfFile);
    console.log('Colors:', stats.colors.length);
    console.log('Print time:', stats.printTime);
    console.log('Print cost:', stats.printCost);
    console.log('Filament estimates:', stats.filamentEstimates);
    console.log('Filament usage stats:', stats.filamentUsageStats);

    // Verify essential fields
    expect(stats.fileName).toBe('2_color_cube.gcode.3mf');
    expect(stats.is3mfFile).toBe(true);
    expect(stats.colors.length).toBe(2);
    expect(stats.printTime).toBeDefined();

    // Check filament data
    expect(stats.filamentEstimates).toBeDefined();
    expect(stats.filamentEstimates?.length).toBe(2);

    expect(stats.filamentUsageStats).toBeDefined();
    expect(stats.filamentUsageStats?.total).toBeCloseTo(6.07, 1); // 2.32 + 3.75 = 6.07
  });

  it('should calculate print cost from filament cost and weight', async () => {
    // First extract the raw G-code to see what's in it
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const unzipped = unzipSync(uint8Array);

    const gcodeEntry = Object.entries(unzipped).find(
      ([name]) => name.endsWith('.gcode') && !name.includes('thumbnail')
    );

    if (gcodeEntry) {
      const [, gcodeData] = gcodeEntry;
      const gcodeContent = new TextDecoder().decode(gcodeData);

      // Look for cost-related metadata
      const lines = gcodeContent.split('\n');
      let filamentCostPerKg: number[] = [];
      let filamentWeights: number[] = [];
      let filamentIndices: number[] = [];
      let foundCostLine = false;

      // First check if filament_cost exists at all
      console.log('\nSearching for cost metadata in G-code:');
      lines.forEach((line, i) => {
        if (line.includes('filament_cost')) {
          console.log(`Line ${i + 1}: ${line.trim()}`);
          foundCostLine = true;
        }
      });

      if (!foundCostLine) {
        console.log('No filament_cost metadata found in G-code!');
        console.log('Checking first 50 lines for any metadata:');
        lines.slice(0, 50).forEach((line, i) => {
          if (line.startsWith(';') && line.length > 2) {
            console.log(`Line ${i + 1}: ${line.trim()}`);
          }
        });
      }

      lines.forEach((line) => {
        // Look for filament_cost (price per kg) - try multiple formats
        if (line.includes('filament_cost')) {
          console.log('Found filament_cost line:', line);
          const match = line.match(/filament_cost\s*[:=]\s*(.+)/);
          if (match) {
            filamentCostPerKg = match[1].split(',').map((c) => parseFloat(c.trim()));
            console.log('Parsed filament cost per kg:', filamentCostPerKg);
          }
        }

        // Look for filament indices
        if (line.includes('; filament:')) {
          const match = line.match(/; filament:\s*(.+)/);
          if (match) {
            filamentIndices = match[1].split(',').map((f) => parseInt(f.trim()));
            console.log('Filament indices:', filamentIndices);
          }
        }

        // Look for actual weights used
        if (line.includes('total filament weight [g]')) {
          const match = line.match(/total filament weight \[g\]\s*:\s*(.+)/);
          if (match) {
            filamentWeights = match[1].split(',').map((w) => parseFloat(w.trim()));
            console.log('Filament weights (g):', filamentWeights);
          }
        }
      });

      // Calculate expected cost
      if (
        filamentCostPerKg.length > 0 &&
        filamentWeights.length > 0 &&
        filamentIndices.length > 0
      ) {
        let totalCost = 0;

        filamentWeights.forEach((weight, idx) => {
          const filamentIdx = filamentIndices[idx];
          const costPerKg = filamentCostPerKg[filamentIdx];
          const costForThisFilament = (weight / 1000) * costPerKg; // convert g to kg
          totalCost += costForThisFilament;
          console.log(
            `T${idx} (filament ${filamentIdx}): ${weight}g @ $${costPerKg}/kg = $${costForThisFilament.toFixed(2)}`
          );
        });

        console.log(`Expected total cost: $${totalCost.toFixed(2)}`);
      } else {
        console.log('Missing metadata for cost calculation:');
        console.log('- filamentCostPerKg:', filamentCostPerKg.length > 0 ? 'found' : 'MISSING');
        console.log('- filamentWeights:', filamentWeights.length > 0 ? 'found' : 'MISSING');
        console.log('- filamentIndices:', filamentIndices.length > 0 ? 'found' : 'MISSING');
      }

      // Now parse with our parser and check if it calculates cost
      const logger = new Logger('test');
      const baseParser = new GcodeParser(logger);
      const parser = new Gcode3mfParser(baseParser, logger);

      const stats = await parser.parse(file);

      console.log(`Parser found cost: ${stats.printCost}`);

      // If no filament_cost metadata, we can't calculate cost
      if (!foundCostLine) {
        console.log(
          'Test file does not contain filament_cost metadata - cannot calculate print cost'
        );
        expect(stats.printCost).toBeUndefined();
      } else if (filamentCostPerKg.length > 0) {
        expect(stats.printCost).toBeDefined();
        expect(stats.printCost).toBeCloseTo(0.15, 2);
      }
    }
  });
});
