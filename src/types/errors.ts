/**
 * Base error class for application-specific errors
 */
export abstract class AppError extends Error {
  abstract readonly code: string;

  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
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

  constructor(
    message: string,
    public readonly line?: number,
    cause?: unknown
  ) {
    super(message, cause);
  }
}

/**
 * Error thrown when file validation fails
 */
export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';

  constructor(
    message: string,
    public readonly field?: string,
    cause?: unknown
  ) {
    super(message, cause);
  }
}

/**
 * Error thrown when cache operations fail
 */
export class CacheError extends AppError {
  readonly code = 'CACHE_ERROR';

  constructor(
    message: string,
    public readonly operation?: string,
    cause?: unknown
  ) {
    super(message, cause);
  }
}

/**
 * Error thrown when file operations fail
 */
export class FileError extends AppError {
  readonly code = 'FILE_ERROR';

  constructor(
    message: string,
    public readonly fileName?: string,
    cause?: unknown
  ) {
    super(message, cause);
  }
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
