import { ICommand } from './ICommand';
import { Result } from '../types';
import { Logger } from '../utils/logger';

/**
 * Executes commands and manages command history
 */
export class CommandExecutor {
  private history: ICommand<any>[] = [];
  private currentIndex: number = -1;

  constructor(private logger: Logger) {}

  /**
   * Execute a command
   */
  async execute<T>(command: ICommand<T>): Promise<Result<T>> {
    this.logger.info(`Executing command: ${command.getDescription()}`);

    try {
      const result = await command.execute();

      if (result.ok) {
        // Add to history if successful
        this.addToHistory(command);
        this.logger.info(`Command completed successfully: ${command.getDescription()}`);
      } else {
        this.logger.error(`Command failed: ${command.getDescription()}`, result.error);
      }

      return result;
    } catch (error) {
      this.logger.error(`Command threw error: ${command.getDescription()}`, error);
      return Result.err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Undo the last command if supported
   */
  async undo(): Promise<Result<void>> {
    if (this.currentIndex < 0) {
      return Result.err(new Error('No commands to undo'));
    }

    const command = this.history[this.currentIndex];

    if (!command.undo) {
      return Result.err(new Error(`Command does not support undo: ${command.getDescription()}`));
    }

    this.logger.info(`Undoing command: ${command.getDescription()}`);

    try {
      const result = await command.undo();

      if (result.ok) {
        this.currentIndex--;
        this.logger.info(`Command undone successfully: ${command.getDescription()}`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Undo failed: ${command.getDescription()}`, error);
      return Result.err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get command history
   */
  getHistory(): ReadonlyArray<ICommand<any>> {
    return [...this.history];
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.history = [];
    this.currentIndex = -1;
    this.logger.info('Command history cleared');
  }

  private addToHistory(command: ICommand<any>): void {
    // Remove any commands after current index
    this.history = this.history.slice(0, this.currentIndex + 1);

    // Add new command
    this.history.push(command);
    this.currentIndex++;

    // Limit history size
    const maxHistorySize = 50;
    if (this.history.length > maxHistorySize) {
      this.history = this.history.slice(-maxHistorySize);
      this.currentIndex = this.history.length - 1;
    }
  }
}
