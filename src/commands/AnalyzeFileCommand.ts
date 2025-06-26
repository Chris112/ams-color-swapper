import { ICommand } from './ICommand';
import { Result, GcodeStats, OptimizationResult, SystemConfiguration } from '../types';
import { FileProcessingService } from '../services/FileProcessingService';
import { OptimizationService, OptimizationAlgorithm } from '../services/OptimizationService';
import { ICacheRepository } from '../repositories';
import { Logger } from '../utils/logger';

export interface AnalyzeFileResult {
  stats: GcodeStats;
  optimization: OptimizationResult;
  fromCache: boolean;
}

/**
 * Command to analyze a G-code file
 */
export class AnalyzeFileCommand implements ICommand<AnalyzeFileResult> {
  constructor(
    private file: File,
    private fileProcessingService: FileProcessingService,
    private optimizationService: OptimizationService,
    private cacheRepository: ICacheRepository,
    private logger: Logger,
    private options: {
      useWebWorker?: boolean;
      useCache?: boolean;
      onProgress?: (progress: number, message: string) => void;
      configuration?: SystemConfiguration;
      optimizationAlgorithm?: OptimizationAlgorithm; // New option
    } = {}
  ) {}

  async execute(): Promise<Result<AnalyzeFileResult>> {
    try {
      // Process the file
      const processingResult = await this.fileProcessingService.processFile(this.file, {
        useWebWorker: this.options.useWebWorker ?? true,
        useCache: this.options.useCache ?? true,
        onProgress: this.options.onProgress,
      });

      if (!processingResult.ok) {
        return processingResult;
      }

      const { stats, fromCache } = processingResult.value;

      // If from cache, try to get cached optimization
      if (fromCache) {
        const cacheKey = (stats as any).__cacheKey;
        if (cacheKey) {
          const cacheResult = await this.cacheRepository.get(cacheKey);
          if (cacheResult.ok && cacheResult.value) {
            return Result.ok({
              stats,
              optimization: cacheResult.value.optimization,
              fromCache: true,
            });
          }
        }
      }

      // Generate optimization
      if (this.options.onProgress) {
        this.options.onProgress(95, 'Optimizing...');
      }

      const optimization = this.optimizationService.generateOptimization(
        stats,
        this.options.configuration,
        this.options.optimizationAlgorithm // Pass the algorithm
      );

      // Cache the results if not from cache
      if (!fromCache && this.options.useCache !== false) {
        const cacheKey = (stats as any).__cacheKey;
        if (cacheKey) {
          await this.cacheRepository.set(
            cacheKey,
            this.file.name,
            this.file.size,
            stats,
            optimization,
            this.logger.getLogs()
          );
          this.logger.info(`Results cached for ${this.file.name}`);
        }
      }

      if (this.options.onProgress) {
        this.options.onProgress(100, 'Complete!');
      }

      return Result.ok({
        stats,
        optimization,
        fromCache,
      });
    } catch (error) {
      return Result.err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  getDescription(): string {
    return `Analyze G-code file: ${this.file.name} (${(this.file.size / 1024 / 1024).toFixed(2)} MB)`;
  }
}
