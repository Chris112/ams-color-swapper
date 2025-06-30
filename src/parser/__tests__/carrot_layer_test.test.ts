import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { GcodeParser } from '../gcodeParser';

function createMockFile(content: string, name: string): File {
  const blob = new Blob([content], { type: 'text/plain' });
  const file = new File([blob], name, { type: 'text/plain' });

  // Override text() method if not available (for test environments)
  if (!file.text) {
    Object.defineProperty(file, 'text', {
      value: async () => content,
      writable: false,
      enumerable: false,
      configurable: true,
    });
  }

  return file;
}

describe('Carrot Sign Layer Count Fix', () => {
  it('should correctly count 13 layers for carrot_sign.gcode', async () => {
    // Read the actual carrot_sign.gcode file
    const carrotPath = path.join(__dirname, '../../../examples/tests/carrot_sign.gcode');
    const carrotContent = fs.readFileSync(carrotPath, 'utf8');
    const carrotFile = createMockFile(carrotContent, 'carrot_sign.gcode');

    // Parse the file
    const parser = new GcodeParser();
    const stats = await parser.parse(carrotFile);

    // Log debug information
    console.log(`Total layers detected: ${stats.totalLayers}`);
    console.log(
      `Layer color map keys: [${Array.from(stats.layerColorMap.keys())
        .sort((a, b) => a - b)
        .join(', ')}]`
    );
    console.log(`Layer color map size: ${stats.layerColorMap.size}`);

    // Verify that we correctly detect 13 layers (not 14)
    expect(stats.totalLayers).toBe(13);

    // Verify that the layer map contains layers 0-12 (internal representation is 0-based)
    const layerKeys = Array.from(stats.layerColorMap.keys()).sort((a, b) => a - b);
    expect(layerKeys[0]).toBe(0); // First layer should be 0 (internal 0-based)
    expect(layerKeys[layerKeys.length - 1]).toBe(12); // Last layer should be 12 (internal 0-based)
    expect(layerKeys.length).toBe(13); // Should have exactly 13 layers
  });

  it('should handle files without layer comments by falling back to layer 0', async () => {
    // Test with a file that has no layer comments
    const basicGcode = `
; Basic G-code without layer comments
G1 X10 Y10 E1.0
T1
G1 X20 Y20 E1.0
`;
    const basicFile = createMockFile(basicGcode, 'basic.gcode');

    const parser = new GcodeParser();
    const stats = await parser.parse(basicFile);

    // Should fall back to 1 layer starting at layer 0
    expect(stats.totalLayers).toBe(1);
    expect(stats.layerColorMap.has(0)).toBe(true);
  });
});
