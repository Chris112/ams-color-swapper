import { describe, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Gcode3mfParser } from '../Gcode3mfParser';
import { GcodeParser } from '../gcodeParser';
import { Logger } from '../../utils/logger';

describe('Debug Color Mapping', () => {
  it('should show color IDs and filament estimates mapping', async () => {
    const filePath = resolve(__dirname, '../../../examples/2_color_cube.gcode.3mf');
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

    const logger = new Logger('debug');
    const baseParser = new GcodeParser(logger);
    const parser = new Gcode3mfParser(baseParser, logger);

    const stats = await parser.parse(file);

    console.log('\n=== Color Objects ===');
    stats.colors.forEach((color, index) => {
      console.log(`Index ${index}: ID=${color.id}, Name=${color.name}, Hex=${color.hexValue}`);
    });

    console.log('\n=== Filament Estimates ===');
    stats.filamentEstimates?.forEach((est, index) => {
      console.log(`Index ${index}: colorId=${est.colorId}, weight=${est.weight}g`);
    });

    console.log('\n=== Mapping Check ===');
    stats.colors.forEach((color) => {
      const filamentEstimate = stats.filamentEstimates?.find((est) => est.colorId === color.id);
      console.log(
        `Color ${color.id} -> FilamentEstimate: ${filamentEstimate ? filamentEstimate.weight + 'g' : 'NOT FOUND'}`
      );
    });

    console.log('\n=== Raw Color Definitions ===');
    if (stats.slicerInfo?.colorDefinitions) {
      stats.slicerInfo.colorDefinitions.forEach((color, index) => {
        console.log(`Index ${index}: ${color}`);
      });
    }
  });
});
