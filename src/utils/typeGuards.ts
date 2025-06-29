/**
 * Type guard utilities for safe type assertions and array access
 */

/**
 * Assert that a value is defined (not undefined)
 * Throws an error with the provided message if undefined
 */
export function assertDefined<T>(value: T | undefined, message: string): asserts value is T {
  if (value === undefined) {
    throw new Error(message);
  }
}

/**
 * Assert that a value is not null or undefined
 * Throws an error with the provided message if null or undefined
 */
export function assertNotNull<T>(value: T | null | undefined, message: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

/**
 * Safely access an array element with a default value
 */
export function safeArrayAccess<T>(array: readonly T[], index: number, defaultValue: T): T {
  return array[index] ?? defaultValue;
}

/**
 * Safely access an array element, returns undefined if out of bounds
 */
export function safeGet<T>(array: readonly T[], index: number): T | undefined {
  return array[index];
}

/**
 * Get array element or throw with a descriptive error
 */
export function getOrThrow<T>(array: readonly T[], index: number, errorMessage: string): T {
  const item = array[index];
  if (item === undefined) {
    throw new Error(`${errorMessage} (index: ${index}, array length: ${array.length})`);
  }
  return item;
}

/**
 * Check if a value is defined (not undefined)
 */
export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * Check if a value is not null or undefined
 */
export function isNotNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Filter out undefined values from an array
 */
export function filterDefined<T>(array: (T | undefined)[]): T[] {
  return array.filter(isDefined);
}

/**
 * Get first element of array or undefined
 */
export function firstOrUndefined<T>(array: readonly T[]): T | undefined {
  return array[0];
}

/**
 * Get last element of array or undefined
 */
export function lastOrUndefined<T>(array: readonly T[]): T | undefined {
  return array[array.length - 1];
}

/**
 * Type guard for Map.get() results
 */
export function getFromMap<K, V>(map: Map<K, V>, key: K, errorMessage: string): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(errorMessage);
  }
  return value;
}

/**
 * Safe Map.get() with default value
 */
export function getFromMapOrDefault<K, V>(map: Map<K, V>, key: K, defaultValue: V): V {
  return map.get(key) ?? defaultValue;
}
