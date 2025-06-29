import { Result } from '../types/result';

/**
 * Base interface for all commands
 */
export interface ICommand<TResult = void> {
  /**
   * Execute the command
   */
  execute(): Promise<Result<TResult>>;

  /**
   * Optional: Undo the command if supported
   */
  undo?(): Promise<Result<void>>;

  /**
   * Get command description for logging/debugging
   */
  getDescription(): string;
}
