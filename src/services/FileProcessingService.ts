import { Result, GcodeStats, FileError } from '../types';
import { Logger } from '../utils/logger';
import { parserWorkerService } from './ParserWorkerService';
import { createParser } from '../parser/parserFactory';
import { ParserAlgorithm } from '../domain/models/AmsConfiguration';

export interface FileProcessingOptions {
  useWebWorker?: boolean;
  useCache?: boolean;
  onProgress?: (progress: number, message: string) => void;
  parserAlgorithm?: ParserAlgorithm;
}

export class FileProcessingService {
  constructor(
    private logger: Logger
  ) {}

  async processFile(
    file: File,
    options: FileProcessingOptions = {}
  ): Promise<Result<{ stats: GcodeStats; fromCache: boolean }>> {
    const { 
      useWebWorker = true, 
      onProgress = () => {},
      parserAlgorithm = 'optimized'
    } = options;

    try {
      // Note: Cache checking is now handled at the command level with full configuration context
      // This service only handles parsing

      // Parse file
      onProgress(10, 'Reading file...');
      let parseResult: Result<GcodeStats>;

      // Special handling for worker parser
      if (parserAlgorithm === 'worker' || (useWebWorker && file.size > 5 * 1024 * 1024)) {
        // Use Web Worker for files larger than 5MB or when explicitly requested
        try {
          const workerResult = await parserWorkerService.parse(file, onProgress);
          parseResult = Result.ok(workerResult.stats);
        } catch (error) {
          this.logger.warn('Web Worker failed, falling back to main thread', error);
          parseResult = await this.parseOnMainThread(file, onProgress, parserAlgorithm);
        }
      } else {
        parseResult = await this.parseOnMainThread(file, onProgress, parserAlgorithm);
      }

      if (!parseResult.ok) {
        return Result.err(parseResult.error);
      }

      const stats = parseResult.value;

      onProgress(100, 'Complete!');
      return Result.ok({ stats, fromCache: false });
    } catch (error) {
      return Result.err(
        new FileError(
          `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          file.name,
          error
        )
      );
    }
  }

  private async parseOnMainThread(
    file: File,
    onProgress: (progress: number, message: string) => void,
    parserAlgorithm: ParserAlgorithm = 'optimized'
  ): Promise<Result<GcodeStats>> {
    // Create a parser with progress callback using the factory
    const parser = createParser(parserAlgorithm, this.logger, onProgress);

    try {
      const stats = await parser.parse(file);
      return Result.ok(stats);
    } catch (error) {
      return Result.err(
        new FileError(
          `Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          file.name,
          error
        )
      );
    }
  }
}
