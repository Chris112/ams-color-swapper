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
