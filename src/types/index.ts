export interface GcodeStats {
  fileName: string;
  fileSize: number;
  rawContent?: string; // Add raw G-code content for geometry parsing
  slicerInfo?: {
    software: string;
    version: string;
    profile?: string;
    colorDefinitions?: string[];
  };

  totalLayers: number;
  totalHeight: number;
  estimatedPrintTime?: number;
  printTime?: string;
  printCost?: number;

  colors: Color[];
  toolChanges: ToolChange[];
  layerColorMap: Map<number, string[]>;
  colorUsageRanges: ColorRange[];
  layerDetails?: LayerColorInfo[];

  filamentEstimates?: FilamentUsage[];
  filamentUsageStats?: {
    total: number;
    model: number;
    support: number;
    flushed: number;
    tower: number;
  };

  parserWarnings: string[];
  parseTime: number;

  // Constraint validation
  constraintValidation?: ConstraintValidationResult;

  // Color deduplication info
  deduplicationInfo?: {
    duplicatesFound: Array<{
      hexCode: string;
      originalTools: string[];
      assignedTo: string;
      colorName: string;
    }>;
    freedSlots: string[];
    colorMapping: Map<string, string>;
  };
}

export interface ColorRange {
  colorId: string;
  startLayer: number;
  endLayer: number;
  continuous: boolean;
}

export interface ToolChange {
  fromTool: string;
  toTool: string;
  layer: number;
  lineNumber: number;
  zHeight?: number;
}

export interface FilamentUsage {
  colorId: string;
  length: number;
  weight?: number;
  cost?: number;
}

export interface LayerColorInfo {
  layer: number;
  colors: string[];
  primaryColor: string; // Most used color in layer
  toolChangeCount: number;
  toolChangesInLayer: ToolChange[];
}

import { Color } from '../domain/models/Color';
import type { ParserAlgorithm } from '../domain/models/AmsConfiguration';

// Re-export Color for analytics and other modules
export { Color } from '../domain/models/Color';

export interface SystemConfiguration {
  type: 'ams' | 'toolhead';
  unitCount: number;
  totalSlots: number;
  parserAlgorithm?: ParserAlgorithm;
}

export interface OptimizationResult {
  totalColors: number;
  requiredSlots: number;
  totalSlots?: number; // Total slots available in the configuration
  slotAssignments: SlotAssignment[];
  manualSwaps: ManualSwap[];
  estimatedTimeSaved: number;
  canShareSlots: ColorPair[];
  configuration?: SystemConfiguration;
}

export interface SlotAssignment {
  unit: number;
  slot: number;
  slotId: string;
  colors: string[];
  isPermanent: boolean;
}

export interface ManualSwap {
  unit: number;
  slot: number;
  fromColor: string;
  toColor: string;
  atLayer: number;
  pauseStartLayer: number;
  pauseEndLayer: number;
  zHeight?: number; // Make optional as it might not always be available
  reason: string;
  // Enhanced timing flexibility
  timingOptions: {
    earliest: number; // Earliest possible layer for this swap
    latest: number; // Latest possible layer for this swap
    optimal: number; // Recommended layer (same as atLayer)
    adjacentOnly: boolean; // If swap must be adjacent to color usage
    bufferLayers: number; // Buffer layers around color usage
  };
  swapWindow: {
    startLayer: number; // Start of valid swap window
    endLayer: number; // End of valid swap window
    flexibilityScore: number; // 0-100, how flexible this timing is
    constraints: string[]; // Reasons for timing constraints
  };
  confidence: {
    timing: number; // 0-100, confidence in timing recommendation
    necessity: number; // 0-100, how necessary this swap is
    userControl: number; // 0-100, how much user can adjust this
  };
}

export interface ColorPair {
  color1: string;
  color2: string;
  canShare: boolean;
  reason: string;
}

export interface DebugLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug' | 'silly';
  message: string;
  context?: unknown;
}

// Alias for consistency across the codebase
export type LogEntry = DebugLog;

// Constraint Validation Types
export interface LayerConstraintViolation {
  layer: number;
  requiredColors: number;
  availableSlots: number;
  colorsInLayer: string[];
  violationType: 'impossible' | 'suboptimal';
  severity: 'critical' | 'warning' | 'info';
}

export interface ConstraintViolationRange {
  startLayer: number;
  endLayer: number;
  maxColorsRequired: number;
  availableSlots: number;
  affectedLayers: LayerConstraintViolation[];
  suggestions: ColorConsolidationSuggestion[];
}

export interface ColorConsolidationSuggestion {
  type: 'merge' | 'remove' | 'replace';
  primaryColor: string;
  secondaryColor?: string;
  reason: string;
  impact: {
    visualImpact: 'minimal' | 'low' | 'medium' | 'high';
    usagePercentage: number;
    layersAffected: number[];
  };
  similarity?: {
    rgbDistance: number;
    hslSimilarity: number;
    visuallySimilar: boolean;
  };
  instruction: string; // Actionable instruction for the slicer
}

export interface ConstraintValidationResult {
  isValid: boolean;
  hasViolations: boolean;
  violations: ConstraintViolationRange[];
  totalImpossibleLayers: number;
  worstViolation?: ConstraintViolationRange;
  summary: {
    impossibleLayerCount: number;
    maxColorsRequired: number;
    availableSlots: number;
    suggestionsCount: number;
  };
}

export interface PrintConstraints {
  maxSimultaneousColors: number;
  printerType: 'ams' | 'toolhead';
  purgeRequirements?: {
    minimumPurgeVolume: number;
    wasteFactorPercentage: number;
  };
  timingConstraints?: {
    minimumSwapTime: number; // seconds
    pauseOverhead: number; // seconds per pause
  };
}

// Re-export error types
export * from './errors';

// Re-export Result type
export * from './result';
