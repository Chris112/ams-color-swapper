// Import types needed for GcodeStats
import type { ColorRange } from './color';
import type { ToolChange } from './tool';
import type { FilamentUsage } from './color';
import type { LayerColorInfo } from './layer';
import type { Color } from '../domain/models/Color';
import type { ConstraintValidationResult } from './constraints';

// Re-export types that are used externally
export type { FilamentUsage } from './color';

export interface GcodeStats {
  fileName: string;
  fileSize: number;
  rawContent?: string; // Add raw G-code content for geometry parsing
  slicerInfo?: {
    software: string;
    version: string;
    profile?: string;
    colorDefinitions?: string[];
    // 3MF specific fields
    threeMfVersion?: number;
    bedType?: string;
    nozzleDiameter?: number;
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

  // 3MF specific fields
  is3mfFile?: boolean;
  threeMfMetadata?: {
    filament_colors: string[];
    filament_ids: number[];
    first_extruder: number;
    nozzle_diameter: number;
    bed_type: string;
    version: number;
    is_seq_print: boolean;
  };
}
