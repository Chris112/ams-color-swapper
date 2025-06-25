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

  colors: ColorInfo[];
  toolChanges: ToolChange[];
  layerColorMap: Map<number, string>;
  colorUsageRanges: ColorRange[];

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
}

export interface ColorInfo {
  id: string;
  name?: string;
  hexColor?: string;
  firstLayer: number;
  lastLayer: number;
  layerCount: number;
  usagePercentage: number;
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

export interface OptimizationResult {
  totalColors: number;
  requiredSlots: number;
  slotAssignments: SlotAssignment[];
  manualSwaps: ManualSwap[];
  estimatedTimeSaved: number;
  canShareSlots: ColorPair[];
}

export interface SlotAssignment {
  slot: number;
  colors: string[];
  isPermanent: boolean;
}

export interface ManualSwap {
  slot: number;
  fromColor: string;
  toColor: string;
  atLayer: number;
  pauseStartLayer: number;
  pauseEndLayer: number;
  zHeight: number;
  reason: string;
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

// Re-export error types
export * from './errors';

// Re-export Result type
export * from './result';
