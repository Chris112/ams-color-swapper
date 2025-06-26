import { ICommand } from './ICommand';
import { Result } from '../types';
import { ICacheRepository } from '../repositories';
import { Logger } from '../utils/logger';
import { hmrStateRepository } from '../repositories/HMRStateRepository';

/**
 * Command to clear the application cache and development state
 */
export class ClearCacheCommand implements ICommand<void> {
  constructor(
    private cacheRepository: ICacheRepository,
    private logger: Logger
  ) {}

  async execute(): Promise<Result<void>> {
    try {
      const result = await this.cacheRepository.clear();

      if (result.ok) {
        this.logger.info('Cache cleared successfully');

        // Also clear HMR state in development mode
        if (import.meta.env.DEV) {
          await hmrStateRepository.clear();
          this.logger.info('Development state cleared');
        }
      }

      return result;
    } catch (error) {
      return Result.err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  getDescription(): string {
    return import.meta.env.DEV
      ? 'Clear application cache and development state'
      : 'Clear application cache';
  }
}
