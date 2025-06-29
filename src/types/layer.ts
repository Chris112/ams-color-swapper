/**
 * Layer-related type definitions
 */

import { ToolChange } from './tool';

/**
 * Basic layer color information
 * Base type that can be extended
 */
export interface LayerColorData {
  /** Layer number */
  layer: number;

  /** Array of color IDs present in this layer */
  colors: string[];

  /** Tool index (if applicable) */
  toolIndex?: number;
}

/**
 * Extended layer color information with analysis data
 * Extends LayerColorData with additional computed properties
 */
export interface LayerColorInfo extends LayerColorData {
  /** Most used color in the layer */
  primaryColor: string;

  /** Number of tool changes in this layer */
  toolChangeCount: number;

  /** Tool changes that occur in this layer */
  toolChangesInLayer: ToolChange[];
}

/**
 * Layer statistics
 */
export interface LayerStats {
  layer: number;
  height: number;
  printTime?: number;
  materialUsed?: number;
}
