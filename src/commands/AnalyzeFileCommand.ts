import { ICommand } from './ICommand';
import { Result, GcodeStats, OptimizationResult, SystemConfiguration } from '../types';
import { FileProcessingService } from '../services/FileProcessingService';
import { OptimizationService, OptimizationAlgorithm } from '../services/OptimizationService';
import { ICacheRepository } from '../repositories';
import { Logger } from '../utils/logger';
import { generateFileHash, getAlgorithmVersion } from '../utils/hash';
import { generateCacheKeyWithConfig } from '../utils/configurationHash';

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
      // Generate cache key with configuration
      const fileHash = await generateFileHash(this.file);
      const algorithmVersion = getAlgorithmVersion();
      const cacheKey = generateCacheKeyWithConfig(
        fileHash,
        algorithmVersion,
        this.options.configuration || { type: 'ams', unitCount: 1, totalSlots: 4 },
        this.options.optimizationAlgorithm || 'greedy'
      );

      // Check cache first if enabled
      if (this.options.useCache !== false) {
        const cacheResult = await this.cacheRepository.get(cacheKey);
        if (cacheResult.ok && cacheResult.value) {
          this.logger.info(`Cache hit for ${this.file.name}`);
          if (this.options.onProgress) {
            this.options.onProgress(100, 'Loaded from cache');
          }
          return Result.ok({
            stats: cacheResult.value.stats,
            optimization: cacheResult.value.optimization,
            fromCache: true,
          });
        }
        this.logger.info(`Cache miss for ${this.file.name}`);
      }

      // Process the file (no cache check needed here)
      const processingResult = await this.fileProcessingService.processFile(this.file, {
        useWebWorker: this.options.useWebWorker ?? true,
        useCache: false, // We already checked cache above
        onProgress: this.options.onProgress,
        parserAlgorithm: this.options.configuration?.parserAlgorithm || 'optimized',
      });

      if (!processingResult.ok) {
        return processingResult;
      }

      const { stats } = processingResult.value;

      // Generate optimization
      if (this.options.onProgress) {
        this.options.onProgress(95, 'Optimizing...');
      }

      const optimization = this.optimizationService.generateOptimization(
        stats,
        this.options.configuration,
        this.options.optimizationAlgorithm // Pass the algorithm
      );

      // Cache the results if caching is enabled
      if (this.options.useCache !== false) {
        await this.cacheRepository.set(
          cacheKey,
          this.file.name,
          this.file.size,
          stats,
          optimization,
          this.logger.getLogs()
        );
        this.logger.info(`Results cached for ${this.file.name} with key: ${cacheKey}`);
      }

      if (this.options.onProgress) {
        this.options.onProgress(100, 'Complete!');
      }

      return Result.ok({
        stats,
        optimization,
        fromCache: false,
      });
    } catch (error) {
      return Result.err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  getDescription(): string {
    return `Analyze G-code file: ${this.file.name} (${(this.file.size / 1024 / 1024).toFixed(2)} MB)`;
  }
}
