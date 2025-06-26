import { describe, it, expect, bench } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { GcodeParser } from '../gcodeParser'; // Original unoptimized version
import { GcodeParserOptimized } from '../gcodeParserOptimized'; // Optimized version
import { Logger } from '../../utils/logger';

// Mock the Browser File object for Node.js environment
class MockFile {
  private buffer: Buffer;
  name: string;
  size: number;

  constructor(filePath: string) {
    this.buffer = fs.readFileSync(filePath);
    this.name = path.basename(filePath);
    this.size = this.buffer.length;
  }

  text(): Promise<string> {
    return Promise.resolve(this.buffer.toString());
  }

  slice(start?: number, end?: number): Blob {
    return new Blob([this.buffer.slice(start, end)]);
  }
}

// Suppress console output from the parsers during tests
// NOTE: Second argument must be FALSE to silence the logger
const silentLogger = new Logger('SilentParserLogger');

// Path to the test G-code file
const gcodeFilePath = path.resolve(__dirname, '../../../public/examples/4_color_Slowpoke.gcode');

// Create a mock file instance
const mockFile = new MockFile(gcodeFilePath);

describe('GcodeParser Performance Comparison', () => {
  it('ensures both parsers produce the same result', async () => {
    const originalParser = new GcodeParser(silentLogger);
    const optimizedParser = new GcodeParserOptimized(silentLogger);
    const file = mockFile as unknown as File;

    const originalResult = await originalParser.parse(file);
    const optimizedResult = await optimizedParser.parse(file);

    // Create copies and remove parseTime for comparison
    const originalResultForComparison = { ...originalResult };
    delete originalResultForComparison.parseTime;
    const optimizedResultForComparison = { ...optimizedResult };
    delete optimizedResultForComparison.parseTime;

    expect(optimizedResultForComparison).toEqual(originalResultForComparison);
  });

  bench('Original GcodeParser', async () => {
    const originalParser = new GcodeParser(silentLogger);
    const file = mockFile as unknown as File;
    await originalParser.parse(file);
  });

  bench('Optimized GcodeParser', async () => {
    const optimizedParser = new GcodeParserOptimized(silentLogger);
    const file = mockFile as unknown as File;
    await optimizedParser.parse(file);
  });
});
