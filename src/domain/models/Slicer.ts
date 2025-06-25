/**
 * Slicer information for tracking which software was used to slice the model
 */
export interface Slicer {
  software: string;
  version?: string;
  profile?: string;
}

/**
 * Filament usage statistics from slicer analysis
 */
export interface FilamentUsage {
  total: number;
  model: number;
  support: number;
  flushed: number;
  tower: number;
}