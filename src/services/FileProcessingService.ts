import { Result, GcodeStats, FileError } from '../types';
import { IGcodeRepository, IFileRepository, ICacheRepository } from '../repositories';
import { Logger } from '../utils/logger';
import { parserWorkerService } from './ParserWorkerService';
import { appState } from '../state/AppState';

export interface FileProcessingOptions {
  useWebWorker?: boolean;
  useCache?: boolean;
  onProgress?: (progress: number, message: string) => void;
}

export class FileProcessingService {
  constructor(
    private gcodeRepository: IGcodeRepository,
    private fileRepository: IFileRepository,
    private cacheRepository: ICacheRepository,
    private logger: Logger
  ) {}

  async processFile(
    file: File,
    options: FileProcessingOptions = {}
  ): Promise<Result<{ stats: GcodeStats; fromCache: boolean }>> {
    const { 
      useWebWorker = true, 
      useCache = true, 
      onProgress = () => {} 
    } = options;

    try {
      // Generate cache key
      const hashResult = await this.fileRepository.calculateHash(file);
      if (!hashResult.ok) {
        return Result.err(hashResult.error);
      }
      const cacheKey = hashResult.value;

      // Check cache if enabled
      if (useCache) {
        onProgress(5, 'Checking cache...');
        const cacheResult = await this.cacheRepository.get(cacheKey);
        
        if (cacheResult.ok && cacheResult.value) {
          this.logger.info(`Cache hit for ${file.name}`);
          onProgress(100, 'Loaded from cache');
          return Result.ok({ 
            stats: cacheResult.value.stats, 
            fromCache: true 
          });
        }
        
        this.logger.info(`Cache miss for ${file.name}`);
      }

      // Parse file
      onProgress(10, 'Reading file...');
      let parseResult: Result<GcodeStats>;

      if (useWebWorker && file.size > 5 * 1024 * 1024) {
        // Use Web Worker for files larger than 5MB
        try {
          const workerResult = await parserWorkerService.parse(file, onProgress);
          parseResult = Result.ok(workerResult.stats);
        } catch (error) {
          this.logger.warn('Web Worker failed, falling back to main thread', error);
          parseResult = await this.parseOnMainThread(file, onProgress);
        }
      } else {
        parseResult = await this.parseOnMainThread(file, onProgress);
      }

      if (!parseResult.ok) {
        return Result.err(parseResult.error);
      }

      const stats = parseResult.value;

      // Cache the results if caching is enabled
      if (useCache) {
        // We'll cache this after optimization in the main App
        // Just store the cache key in stats for later use
        (stats as any).__cacheKey = cacheKey;
      }

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
    onProgress: (progress: number, message: string) => void
  ): Promise<Result<GcodeStats>> {
    // Simulate progress for UI feedback
    const progressInterval = setInterval(() => {
      const state = appState.getState();
      if (state.loadingProgress < 90) {
        const newProgress = Math.min(state.loadingProgress + 5, 90);
        const message = newProgress < 30 ? 'Reading file...' : 
                       newProgress < 60 ? 'Parsing G-code...' : 
                       'Analyzing colors...';
        onProgress(newProgress, message);
      }
    }, 100);

    try {
      const result = await this.gcodeRepository.parseFile(file);
      clearInterval(progressInterval);
      return result;
    } catch (error) {
      clearInterval(progressInterval);
      throw error;
    }
  }
}