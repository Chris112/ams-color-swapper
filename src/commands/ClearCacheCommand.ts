import { ICommand } from './ICommand';
import { Result } from '../types/result';
import { ICacheRepository } from '../repositories';
import { Logger } from '../utils/logger';
import { hmrStateRepository } from '../repositories/HMRStateRepository';
import { gcodeCache } from '../services/GcodeCache';
import { appState } from '../state/AppState';

/**
 * Command to clear the application cache, IndexedDB databases, and development state
 */
export class ClearCacheCommand implements ICommand<void> {
  private static readonly INDEXED_DB_NAMES = ['ams-gcode-cache', 'ams-timeline-db'];

  constructor(
    private cacheRepository: ICacheRepository,
    private logger: Logger
  ) {}

  async execute(): Promise<Result<void>> {
    try {
      // Track all clearing operations
      const clearingTasks: Promise<void>[] = [];
      const errors: Error[] = [];

      // 1. Close database connections before deletion
      this.closeDatabaseConnections();

      // 2. Clear the main cache repository
      const cacheResult = await this.cacheRepository.clear();
      if (cacheResult.ok) {
        this.logger.info('Cache repository cleared successfully');
      } else {
        errors.push(new Error('Failed to clear cache repository'));
      }

      // 3. Clear IndexedDB databases
      for (const dbName of ClearCacheCommand.INDEXED_DB_NAMES) {
        clearingTasks.push(
          this.deleteIndexedDB(dbName).catch((error) => {
            errors.push(new Error(`Failed to delete ${dbName}: ${error.message}`));
          })
        );
      }

      // 4. Clear HMR state in development mode
      if (import.meta.env.DEV) {
        clearingTasks.push(
          hmrStateRepository
            .clear()
            .then(() => this.logger.info('Development state cleared'))
            .catch((error) => {
              errors.push(new Error(`Failed to clear HMR state: ${error.message}`));
            })
        );
      }

      // Wait for all clearing operations to complete
      await Promise.all(clearingTasks);

      // Return overall result
      if (errors.length > 0) {
        const errorMessage = errors.map((e) => e.message).join('; ');
        this.logger.error('Some cache clearing operations failed', errorMessage);
        return Result.err(new Error(`Cache clearing partially failed: ${errorMessage}`));
      }

      this.logger.info('All caches and databases cleared successfully');
      return Result.ok(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to clear caches', errorMessage);
      return Result.err(new Error(`Failed to clear caches: ${errorMessage}`));
    }
  }

  private closeDatabaseConnections(): void {
    try {
      // Close gcodeCache connection
      gcodeCache.close();
      this.logger.info('Closed gcodeCache database connection');

      // Close timeline repository connection
      const mergeHistoryManager = appState.getMergeHistoryManager();
      if (mergeHistoryManager) {
        // Access the private timelineRepository through reflection
        // This is safe since we're in the same module/package
        const timelineRepo = (mergeHistoryManager as any).timelineRepository;
        if (timelineRepo && typeof timelineRepo.close === 'function') {
          timelineRepo.close();
          this.logger.info('Closed timeline repository database connection');
        }
      }
    } catch (error) {
      this.logger.warn('Error closing database connections:', error);
    }
  }

  private async deleteIndexedDB(dbName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const deleteReq = indexedDB.deleteDatabase(dbName);

      deleteReq.onsuccess = () => {
        this.logger.info(`IndexedDB database '${dbName}' deleted successfully`);
        resolve();
      };

      deleteReq.onerror = () => {
        const error = new Error(`Failed to delete IndexedDB database '${dbName}'`);
        this.logger.error(error.message);
        reject(error);
      };

      deleteReq.onblocked = () => {
        const error = new Error(`Delete of IndexedDB database '${dbName}' was blocked`);
        this.logger.warn(error.message);
        // Still resolve as the database will be deleted when connections close
        resolve();
      };
    });
  }

  getDescription(): string {
    return import.meta.env.DEV
      ? 'Clear all caches, databases, and development state'
      : 'Clear all caches and databases';
  }
}
