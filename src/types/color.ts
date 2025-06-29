/**
 * Centralized color-related type definitions
 */

/**
 * Represents a range where a color is used in the print
 * Unified from parser.ts and index.ts definitions
 */
export interface ColorRange {
  /** The ID of the color */
  colorId: string;

  /** The first layer where this color appears */
  startLayer: number;

  /** The last layer where this color appears */
  endLayer: number;

  /** Whether the color usage is continuous (no gaps) between start and end */
  continuous: boolean;

  /** The total number of layers where this color is used (can be computed from end-start+1 if continuous) */
  layerCount?: number;
}

/**
 * Represents a relationship between two colors
 * Used for overlap analysis and optimization
 */
export interface ColorPair {
  color1: string;
  color2: string;
  canShare?: boolean;
  reason?: string;
}

/**
 * Extended color pair with overlap information
 */
export interface ColorOverlap extends ColorPair {
  /** Layers where both colors appear */
  overlapLayers: number[];

  /** Severity of the conflict */
  conflictSeverity?: 'low' | 'medium' | 'high';
}

/**
 * Color usage statistics
 */
export interface ColorUsageStats {
  colorId: string;
  totalLayers: number;
  usagePercentage: number;
  firstLayer: number;
  lastLayer: number;
}

/**
 * Filament usage for a specific color
 */
export interface FilamentUsage {
  colorId: string;
  length: number;
  weight?: number;
  cost?: number;
}
