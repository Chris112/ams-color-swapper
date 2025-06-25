/**
 * Base error class for application-specific errors
 */
export abstract class AppError extends Error {
  abstract readonly code: string;
  
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when file parsing fails
 */
export class ParseError extends AppError {
  readonly code = 'PARSE_ERROR';
  
  constructor(message: string, public readonly line?: number, cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Error thrown when file validation fails
 */
export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  
  constructor(message: string, public readonly field?: string, cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Error thrown when cache operations fail
 */
export class CacheError extends AppError {
  readonly code = 'CACHE_ERROR';
  
  constructor(message: string, public readonly operation?: string, cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Error thrown when file operations fail
 */
export class FileError extends AppError {
  readonly code = 'FILE_ERROR';
  
  constructor(message: string, public readonly fileName?: string, cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Error thrown when worker operations fail
 */
export class WorkerError extends AppError {
  readonly code = 'WORKER_ERROR';
  
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if an error has a specific code
 */
export function hasErrorCode<T extends string>(
  error: unknown,
  code: T
): error is AppError & { code: T } {
  return isAppError(error) && error.code === code;
}

/**
 * Helper to create a user-friendly error message
 */
export function getUserMessage(error: unknown): string {
  if (isAppError(error)) {
    switch (error.code) {
      case 'PARSE_ERROR':
        return `Failed to parse G-code file${(error as ParseError).line ? ` at line ${(error as ParseError).line}` : ''}`;
      case 'VALIDATION_ERROR':
        return `Invalid file format${(error as ValidationError).field ? ` (${(error as ValidationError).field})` : ''}`;
      case 'CACHE_ERROR':
        return 'Failed to access cached data';
      case 'FILE_ERROR':
        return `Failed to read file${(error as FileError).fileName ? ` "${(error as FileError).fileName}"` : ''}`;
      case 'WORKER_ERROR':
        return 'Background processing failed';
      default:
        return error.message;
    }
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
}