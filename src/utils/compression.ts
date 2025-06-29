import LZString from 'lz-string';

export interface CompressionResult {
  compressed: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

/**
 * Compress a JavaScript object to a string
 */
export function compressObject(obj: any): CompressionResult {
  const jsonString = JSON.stringify(obj);
  const originalSize = jsonString.length;
  const compressed = LZString.compressToUTF16(jsonString);
  const compressedSize = compressed.length * 2; // UTF-16 characters are 2 bytes
  
  return {
    compressed,
    originalSize,
    compressedSize,
    compressionRatio: originalSize / compressedSize,
  };
}

/**
 * Decompress a string back to a JavaScript object
 */
export function decompressObject<T = any>(compressed: string): T | null {
  try {
    const decompressed = LZString.decompressFromUTF16(compressed);
    if (!decompressed) {
      return null;
    }
    return JSON.parse(decompressed);
  } catch (error) {
    console.error('Failed to decompress object:', error);
    return null;
  }
}

/**
 * Calculate the size of an object in bytes
 */
export function getObjectSizeInBytes(obj: any): number {
  const jsonString = JSON.stringify(obj);
  return new Blob([jsonString]).size;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Create a diff between two objects (for incremental snapshots)
 */
export function createDiff(oldObj: any, newObj: any): any {
  const diff: any = {};
  
  // Find changed and new properties
  for (const key in newObj) {
    if (!(key in oldObj) || JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
      diff[key] = newObj[key];
    }
  }
  
  // Find deleted properties
  for (const key in oldObj) {
    if (!(key in newObj)) {
      diff[key] = undefined;
    }
  }
  
  return diff;
}

/**
 * Apply a diff to an object
 */
export function applyDiff(obj: any, diff: any): any {
  const result = { ...obj };
  
  for (const key in diff) {
    if (diff[key] === undefined) {
      delete result[key];
    } else {
      result[key] = diff[key];
    }
  }
  
  return result;
}

/**
 * Optimize snapshot for storage by removing redundant data
 */
export function optimizeSnapshot(snapshot: any): any {
  const optimized = { ...snapshot };
  
  // Remove large, reconstructable data
  if (optimized.stats) {
    delete optimized.stats.rawContent;
    delete optimized.stats.layerDetails;
    
    // Convert Sets to Arrays for better compression
    if (optimized.stats.colors) {
      optimized.stats.colors = optimized.stats.colors.map((color: any) => ({
        ...color,
        layersUsed: color.layersUsed ? Array.from(color.layersUsed) : [],
        partialLayers: color.partialLayers ? Array.from(color.partialLayers) : [],
      }));
    }
  }
  
  // Simplify optimization data
  if (optimized.optimization?.manualSwaps) {
    optimized.optimization.manualSwaps = optimized.optimization.manualSwaps.map((swap: any) => ({
      unit: swap.unit,
      slot: swap.slot,
      fromColor: swap.fromColor,
      toColor: swap.toColor,
      atLayer: swap.atLayer,
      zHeight: swap.zHeight,
    }));
  }
  
  return optimized;
}