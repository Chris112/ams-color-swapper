import { SystemConfiguration } from '../types';

/**
 * Generate a deterministic hash for any configuration object
 * This will automatically handle new properties added to configuration
 */
export function generateConfigurationHash(config: SystemConfiguration): string {
  // Sort keys to ensure consistent ordering
  const sortedConfig = sortObjectKeys(config);
  
  // Convert to JSON string for hashing
  const configString = JSON.stringify(sortedConfig);
  
  // Simple hash function that's fast and deterministic
  let hash = 0;
  for (let i = 0; i < configString.length; i++) {
    const char = configString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * Recursively sort object keys to ensure consistent ordering
 */
function sortObjectKeys(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  
  if (typeof obj === 'object') {
    const sorted: any = {};
    const keys = Object.keys(obj).sort();
    
    for (const key of keys) {
      sorted[key] = sortObjectKeys(obj[key]);
    }
    
    return sorted;
  }
  
  return obj;
}

/**
 * Generate a cache key that includes file hash, algorithm version, and configuration
 */
export function generateCacheKeyWithConfig(
  fileHash: string,
  algorithmVersion: string,
  config: SystemConfiguration,
  optimizationAlgorithm: string
): string {
  const configHash = generateConfigurationHash(config);
  
  // Include all components that affect the optimization result
  return `${fileHash}-${algorithmVersion}-cfg${configHash}-opt${optimizationAlgorithm}`;
}