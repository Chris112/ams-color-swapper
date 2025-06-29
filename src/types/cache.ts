/**
 * Centralized cache-related type definitions
 */

import { GcodeStats } from './gcode';
import { OptimizationResult } from './optimization';
import { DebugLog } from './logging';

/**
 * Represents a cached analysis result
 * Unified from CacheEntry and CachedAnalysis
 */
export interface CachedAnalysis {
  /** SHA-256 hash of file content */
  key: string;

  /** Original file name */
  fileName: string;

  /** File size in bytes */
  fileSize: number;

  /** Parsed statistics */
  stats: GcodeStats;

  /** Optimization results */
  optimization: OptimizationResult;

  /** Debug logs from parsing */
  logs?: DebugLog[];

  /** Timestamp when cached */
  timestamp: number;
}

/**
 * Cache metadata information
 * Single source of truth (was duplicated)
 */
export interface CacheMetadata {
  /** Total number of entries in cache */
  totalEntries: number;

  /** Total size in bytes (approximate) */
  totalSize: number;

  /** Timestamp of oldest entry */
  oldestEntry: number;

  /** Timestamp of newest entry */
  newestEntry: number;
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /** Maximum number of entries */
  maxEntries?: number;

  /** Maximum total size in bytes */
  maxSize?: number;

  /** TTL in milliseconds */
  ttl?: number;
}
