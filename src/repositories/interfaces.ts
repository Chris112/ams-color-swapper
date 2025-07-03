import { Result } from '../types/result';
import { GcodeStats } from '../types/gcode';
import { OptimizationResult } from '../types/optimization';
import { DebugLog } from '../types/logging';
import type { CachedAnalysis, CacheMetadata } from '../types/cache';

// Re-export cache types
export type { CachedAnalysis, CacheMetadata } from '../types/cache';

/**
 * Repository for G-code parsing operations
 */
export interface IGcodeRepository {
  /**
   * Parse a G-code file and extract statistics
   */
  parseFile(file: File): Promise<Result<GcodeStats>>;

  /**
   * Parse G-code content directly
   */
  parseContent(content: string, fileName: string): Promise<Result<GcodeStats>>;

  /**
   * Validate if a file is a valid G-code file
   */
  validateFile(file: File): Result<void>;
}

/**
 * Repository for cache operations
 */
export interface ICacheRepository {
  /**
   * Initialize the cache storage
   */
  initialize(): Promise<Result<void>>;

  /**
   * Get cached analysis results
   */
  get(key: string): Promise<Result<CachedAnalysis | null>>;

  /**
   * Store analysis results in cache
   */
  set(
    key: string,
    fileName: string,
    fileSize: number,
    stats: GcodeStats,
    optimization: OptimizationResult,
    logs: DebugLog[]
  ): Promise<Result<void>>;

  /**
   * Clear all cached data
   */
  clear(): Promise<Result<void>>;

  /**
   * Close the database connection
   */
  close(): void;

  /**
   * Get cache metadata
   */
  getMetadata(): Promise<Result<CacheMetadata>>;
}

/**
 * Repository for file operations
 */
export interface IFileRepository {
  /**
   * Read file content as text
   */
  readAsText(file: File): Promise<Result<string>>;

  /**
   * Calculate file hash for caching
   */
  calculateHash(file: File): Promise<Result<string>>;

  /**
   * Download content as a file
   */
  downloadFile(content: string, fileName: string, mimeType: string): Result<void>;
}
