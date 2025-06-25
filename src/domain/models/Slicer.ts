/**
 * Slicer information for tracking which software was used to slice the model
 */
export interface Slicer {
  software: string;
  version?: string;
  profile?: string;
}

/**
 * Overall filament usage statistics from slicer analysis
 */
export interface FilamentUsageStats {
  total: number;
  model: number;
  support: number;
  flushed: number;
  tower: number;
}
