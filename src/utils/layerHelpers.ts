/**
 * Layer numbering conversion utilities
 *
 * Core Principle:
 * - Internal storage is always 0-based (0, 1, 2, ...)
 * - User display is always 1-based (1, 2, 3, ...)
 * - G-code files may use either 0-based or 1-based numbering
 */

/**
 * Convert internal 0-based layer number to display 1-based
 */
export function toDisplayLayer(internalLayer: number): number {
  return internalLayer + 1;
}

/**
 * Convert display 1-based layer number to internal 0-based
 */
export function toInternalLayer(displayLayer: number): number {
  return displayLayer - 1;
}

/**
 * Convert internal 0-based layer range to display 1-based range
 */
export function toDisplayRange(
  startLayer: number,
  endLayer: number
): { start: number; end: number } {
  return {
    start: toDisplayLayer(startLayer),
    end: toDisplayLayer(endLayer),
  };
}

/**
 * Convert display 1-based layer range to internal 0-based range
 */
export function toInternalRange(
  startLayer: number,
  endLayer: number
): { start: number; end: number } {
  return {
    start: toInternalLayer(startLayer),
    end: toInternalLayer(endLayer),
  };
}

/**
 * Format layer number for display (always 1-based)
 */
export function formatDisplayLayer(internalLayer: number): string {
  return `Layer ${toDisplayLayer(internalLayer)}`;
}

/**
 * Format layer range for display (always 1-based)
 */
export function formatDisplayRange(startLayer: number, endLayer: number): string {
  const displayRange = toDisplayRange(startLayer, endLayer);
  return `${displayRange.start}-${displayRange.end}`;
}

/**
 * Format layer range with layer count for display
 */
export function formatDisplayRangeWithCount(startLayer: number, endLayer: number): string {
  const layerCount = endLayer - startLayer + 1;
  return `${formatDisplayRange(startLayer, endLayer)} (${layerCount} layers)`;
}

/**
 * Convert G-code layer number to internal layer number
 * Handles both 0-based and 1-based G-code files
 */
export function gcodeToInternalLayer(gcodeLayer: number, isGcodeOneBased: boolean): number {
  return isGcodeOneBased ? gcodeLayer - 1 : gcodeLayer;
}

/**
 * Convert internal layer number to G-code layer number
 * Handles both 0-based and 1-based G-code files
 */
export function internalToGcodeLayer(internalLayer: number, isGcodeOneBased: boolean): number {
  return isGcodeOneBased ? internalLayer + 1 : internalLayer;
}

/**
 * Detect if G-code uses 1-based numbering by examining the minimum layer number
 */
export function detectGcodeNumberingScheme(layerNumbers: number[]): boolean {
  if (layerNumbers.length === 0) return false;
  const minLayer = Math.min(...layerNumbers);
  return minLayer === 1; // If minimum is 1, it's 1-based numbering
}

/**
 * Calculate total layers from max layer, accounting for numbering scheme
 */
export function calculateTotalLayers(maxLayer: number, isGcodeOneBased: boolean): number {
  return isGcodeOneBased ? maxLayer : maxLayer + 1;
}
