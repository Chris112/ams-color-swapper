import { describe, it, expect, bench } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { GcodeParser } from '../gcodeParser'; // Original unoptimized version
import { GcodeParserOptimized } from '../gcodeParserOptimized'; // Optimized version
import { GcodeParserStreams } from '../variants/GcodeParserStreams';
import { GcodeParserWorker } from '../variants/GcodeParserWorker';
import { GcodeParserRegex } from '../variants/GcodeParserRegex';
import { GcodeParserFSM } from '../variants/GcodeParserFSM';
import { GcodeParserBuffer } from '../variants/GcodeParserBuffer';
import { GcodeParserLazy } from '../variants/GcodeParserLazy';
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

  // Add stream() method for Streams parser
  stream(): ReadableStream<Uint8Array> {
    const buffer = this.buffer;
    return new ReadableStream({
      start(controller) {
        controller.enqueue(buffer);
        controller.close();
      },
    });
  }

  // Add arrayBuffer() method for Buffer parser
  arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(
      this.buffer.buffer.slice(
        this.buffer.byteOffset,
        this.buffer.byteOffset + this.buffer.byteLength
      )
    );
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
  // First, verify all parsers produce similar results
  it('ensures all parsers produce the same result', async () => {
    const file = mockFile as unknown as File;

    // Get reference result from original parser
    const originalParser = new GcodeParser(silentLogger);
    const originalResult = await originalParser.parse(file);

    // Test all variants
    const parsers = [
      { name: 'Optimized', parser: new GcodeParserOptimized(silentLogger) },
      { name: 'Streams', parser: new GcodeParserStreams(silentLogger) },
      { name: 'Worker', parser: new GcodeParserWorker(silentLogger) },
      { name: 'Regex', parser: new GcodeParserRegex(silentLogger) },
      { name: 'FSM', parser: new GcodeParserFSM(silentLogger) },
      { name: 'Buffer', parser: new GcodeParserBuffer(silentLogger) },
      { name: 'Lazy', parser: new GcodeParserLazy(silentLogger) },
    ];

    for (const { name, parser } of parsers) {
      const result = await parser.parse(file);

      // Compare key properties (excluding parseTime and rawContent)
      expect(result.fileName).toBe(originalResult.fileName);
      expect(result.fileSize).toBe(originalResult.fileSize);
      expect(result.totalLayers).toBe(originalResult.totalLayers);
      expect(result.totalHeight).toBeCloseTo(originalResult.totalHeight || 0, 2);
      expect(result.colors.length).toBe(originalResult.colors.length);
      expect(result.toolChanges?.length).toBe(originalResult.toolChanges?.length);

      console.log(`✓ ${name} parser produces correct results`);
    }
  });

  // Benchmark each parser
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

  bench('Streams GcodeParser', async () => {
    const streamsParser = new GcodeParserStreams(silentLogger);
    const file = mockFile as unknown as File;
    await streamsParser.parse(file);
  });

  bench('Worker GcodeParser', async () => {
    const workerParser = new GcodeParserWorker(silentLogger);
    const file = mockFile as unknown as File;
    await workerParser.parse(file);
  });

  bench('Regex GcodeParser', async () => {
    const regexParser = new GcodeParserRegex(silentLogger);
    const file = mockFile as unknown as File;
    await regexParser.parse(file);
  });

  bench('FSM GcodeParser', async () => {
    const fsmParser = new GcodeParserFSM(silentLogger);
    const file = mockFile as unknown as File;
    await fsmParser.parse(file);
  });

  bench('Buffer GcodeParser', async () => {
    const bufferParser = new GcodeParserBuffer(silentLogger);
    const file = mockFile as unknown as File;
    await bufferParser.parse(file);
  });

  bench('Lazy GcodeParser', async () => {
    const lazyParser = new GcodeParserLazy(silentLogger);
    const file = mockFile as unknown as File;
    await lazyParser.parse(file);
  });
});
