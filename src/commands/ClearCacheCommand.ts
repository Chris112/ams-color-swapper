import { ICommand } from './ICommand';
import { Result } from '../types';
import { ICacheRepository } from '../repositories';
import { Logger } from '../utils/logger';

/**
 * Command to clear the application cache
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
      }

      return result;
    } catch (error) {
      return Result.err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  getDescription(): string {
    return 'Clear application cache';
  }
}
