import { Logger } from '../utils/logger';
import { ParserAlgorithm } from '../domain/models/AmsConfiguration';
import { GcodeParser } from './gcodeParser';
import { GcodeParserBuffer } from './variants/GcodeParserBuffer';
import { GcodeParserStreams } from './variants/GcodeParserStreams';
import { GcodeParserRegex } from './variants/GcodeParserRegex';
import { GcodeParserFSM } from './variants/GcodeParserFSM';
import { GcodeParserWorker } from './variants/GcodeParserWorker';
import { GcodeParserLazy } from './variants/GcodeParserLazy';

export interface IGcodeParser {
  parse(file: File): Promise<any>;
}

export function createParser(
  algorithm: ParserAlgorithm = 'optimized',
  logger: Logger,
  onProgress?: (progress: number, message: string) => void
): IGcodeParser {
  switch (algorithm) {
    case 'optimized':
      return new GcodeParser(logger, onProgress);
    case 'buffer':
      return new GcodeParserBuffer(logger, onProgress);
    case 'streams':
      return new GcodeParserStreams(logger, onProgress);
    case 'regex':
      return new GcodeParserRegex(logger, onProgress);
    case 'fsm':
      return new GcodeParserFSM(logger, onProgress);
    case 'worker':
      return new GcodeParserWorker(logger, onProgress);
    case 'lazy':
      return new GcodeParserLazy(logger, onProgress);
    default:
      // Default to standard parser
      return new GcodeParser(logger, onProgress);
  }
}