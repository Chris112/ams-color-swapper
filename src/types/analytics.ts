/**
 * Minimal type definitions for analytics features that are actually used
 */

// ============================================================================
// Color Overlap Analysis (used by ColorOverlapAnalyzer)
// ============================================================================

export interface ColorOverlapStats {
  // Simultaneous usage
  colorPairs: Map<string, Map<string, number>>; // Color pairs that appear together
  conflictingColors: Array<{
    color1: string;
    color2: string;
    overlapLayers: number[];
    conflictSeverity: 'low' | 'medium' | 'high';
  }>;

  // AMS slot optimization insights
  suggestedGroupings: Array<{
    slot: number;
    colors: string[];
    reason: string;
    efficiency: number;
  }>;
}
