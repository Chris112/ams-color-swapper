import { Logger } from '../utils/logger';
import { ParserAlgorithm } from '../domain/models/AmsConfiguration';
import { GcodeParser } from './gcodeParser';
import { GcodeParserBuffer } from './variants/GcodeParserBuffer';
import { GcodeParserStreams } from './variants/GcodeParserStreams';
import { GcodeParserRegex } from './variants/GcodeParserRegex';
import { GcodeParserFSM } from './variants/GcodeParserFSM';
import { GcodeParserWorker } from './variants/GcodeParserWorker';
import { GcodeParserLazy } from './variants/GcodeParserLazy';
// Note: Gcode3mfParser is now imported dynamically in FileProcessingService when needed

export interface IGcodeParser {
  parse(file: File): Promise<any>;
}

export function createParser(
  algorithm: ParserAlgorithm = 'optimized',
  logger: Logger,
  onProgress?: (progress: number, message: string) => void
): IGcodeParser {
  // Create the base parser according to the selected algorithm
  let baseParser: IGcodeParser;

  switch (algorithm) {
    case 'optimized':
      baseParser = new GcodeParser(logger, onProgress);
      break;
    case 'buffer':
      baseParser = new GcodeParserBuffer(logger, onProgress);
      break;
    case 'streams':
      baseParser = new GcodeParserStreams(logger, onProgress);
      break;
    case 'regex':
      baseParser = new GcodeParserRegex(logger, onProgress);
      break;
    case 'fsm':
      baseParser = new GcodeParserFSM(logger, onProgress);
      break;
    case 'worker':
      baseParser = new GcodeParserWorker(logger, onProgress);
      break;
    case 'lazy':
      baseParser = new GcodeParserLazy(logger, onProgress);
      break;
    default:
      baseParser = new GcodeParser(logger, onProgress);
      break;
  }

  // Return the base parser directly - 3MF support will be handled at a higher level
  return baseParser;
}
