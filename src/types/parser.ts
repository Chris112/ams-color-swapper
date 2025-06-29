/**
 * Parser-specific type definitions
 */

// Import consolidated ToolChange type
import type { ToolChange } from './tool';

// Re-export for backward compatibility
export type { ColorRange } from './color';

// Re-export as ToolChangeData for backward compatibility
export type ToolChangeData = ToolChange;

// Re-export for backward compatibility
export type { LayerColorData } from './layer';

/**
 * Worker parsing result
 */
export interface ParserWorkerResult {
  layers: Set<number>;
  tools: Set<string>;
  toolChanges: ToolChangeData[];
  maxZ: number;
  hasM600: boolean;
  colorDefs?: string[];
  slicerInfo?: { software: string; version: string };
  printTime?: string;
  estimatedPrintTime?: number;
  filamentWeights?: number[];
  layerColorMap: Array<[number, string[]]>;
  chunkIndex: number;
  error?: string;
  activeTools?: Set<string>;
  lineCount?: number;
}

/**
 * Merged parser data
 */
export interface MergedParserData {
  layers: Set<number>;
  tools: Set<string>;
  toolChanges: ToolChangeData[];
  maxZ: number;
  hasM600: boolean;
  colorDefs?: string[];
  slicerInfo?: { software: string; version: string };
  printTime?: string;
  estimatedPrintTime?: number;
  filamentWeights?: number[];
  layerColorMap: Map<number, string[]>;
  colorFirstSeen: Map<string, number>;
  colorLastSeen: Map<string, number>;
}

/**
 * Parser characteristics for analysis
 */
export interface ParserCharacteristics {
  avgColorsPerLayer: number;
  colorChangeFrequency: number;
  layerComplexity: number;
  spatialDistribution: number;
}

/**
 * Color similarity metrics
 */
export interface ColorSimilarity {
  colorDistance: number;
  nameDistance: number;
  usagePattern: number;
  overall: number;
}

/**
 * Optimization metrics
 */
export interface OptimizationMetrics {
  swapReduction: number;
  efficiencyGain: number;
  feasibilityScore: number;
  complexityRating: 'low' | 'medium' | 'high';
}

/**
 * Substitution impact analysis
 */
export interface SubstitutionImpact {
  affectedLayers: number[];
  totalSegments: number;
  criticalSegments: number;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Strategy analysis result
 */
export interface StrategyAnalysis {
  efficiency: number;
  swapCount: number;
  avgSwapsPerColor: number;
  hotspotCount: number;
  recommendation: string;
}

/**
 * Optimizer options
 */
export interface OptimizerOptions {
  strategy?: 'frequency' | 'proximity' | 'conflict' | 'hybrid';
  maxIterations?: number;
  temperature?: number;
  coolingRate?: number;
  minTemperature?: number;
}

/**
 * Color characteristics for optimization
 */
export interface ColorCharacteristics {
  frequency: number;
  avgProximity: number;
  conflictScore: number;
  clusterId?: number;
}
