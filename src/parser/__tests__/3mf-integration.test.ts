import { describe, it, expect } from 'vitest';
import { is3mfFile } from '../../utils/3mfUtils';
import { unzipSync } from 'fflate';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('3MF Integration Test', () => {
  it('should detect 3MF files correctly', () => {
    const mockFile3mf = { name: 'test.gcode.3mf' } as File;
    const mockFileGcode = { name: 'test.gcode' } as File;

    expect(is3mfFile(mockFile3mf)).toBe(true);
    expect(is3mfFile(mockFileGcode)).toBe(false);
  });

  it('should extract content from real 3MF file using fflate', () => {
    // Check if the sample file exists
    const samplePath = resolve(__dirname, '../../../examples/2_color_cube.gcode.3mf');

    try {
      const fileBuffer = readFileSync(samplePath);
      const zipData = new Uint8Array(fileBuffer);

      // Test that fflate can extract the ZIP
      const files = unzipSync(zipData);

      expect(files).toBeDefined();
      expect(Object.keys(files).length).toBeGreaterThan(0);

      // Log all files in the ZIP for debugging
      console.log('Files in 3MF:', Object.keys(files));

      // Check for expected files
      const hasGcode = Object.keys(files).some(
        (path) => path.includes('.gcode') && !path.includes('.md5')
      );
      const hasMetadata = Object.keys(files).some((path) => path.includes('.json'));

      expect(hasGcode).toBe(true);
      expect(hasMetadata).toBe(true);

      // Try to extract G-code content (exclude .md5 files)
      const gcodeFile = Object.keys(files).find(
        (path) => path.includes('.gcode') && !path.includes('.md5')
      );
      if (gcodeFile) {
        const gcodeContent = new TextDecoder().decode(files[gcodeFile]);
        expect(gcodeContent).toBeDefined();
        expect(gcodeContent.length).toBeGreaterThan(0);
        expect(gcodeContent).toContain('BambuStudio');

        console.log('G-code file:', gcodeFile);
        console.log('G-code preview:', gcodeContent.substring(0, 200));
      }

      // Try to extract metadata
      const metadataFile = Object.keys(files).find((path) => path.includes('.json'));
      if (metadataFile) {
        const metadataContent = new TextDecoder().decode(files[metadataFile]);
        const metadata = JSON.parse(metadataContent);

        expect(metadata).toBeDefined();
        expect(metadata.filament_colors).toBeDefined();
        expect(Array.isArray(metadata.filament_colors)).toBe(true);

        console.log('Sample 3MF metadata:', {
          colors: metadata.filament_colors,
          filamentIds: metadata.filament_ids,
          bedType: metadata.bed_type,
          nozzleDiameter: metadata.nozzle_diameter,
        });
      }
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        console.warn('Sample 3MF file not found, skipping integration test');
        return;
      }
      throw error;
    }
  });
});
