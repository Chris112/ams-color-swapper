/**
 * Parser worker-specific type definitions
 */

/**
 * Message types for parser worker
 */
export interface ParserWorkerMessage {
  type: 'parse';
  chunk: string;
  chunkIndex: number;
  totalChunks: number;
}

/**
 * Parser worker result
 */
export interface ParserWorkerResult {
  layers: Set<number>;
  tools: Set<string>;
  toolChanges: Array<{
    layer: number;
    fromTool: string;
    toTool: string;
    lineNumber: number;
    zHeight?: number;
  }>;
  maxZ: number;
  hasM600: boolean;
  colorDefs?: string[];
  slicerInfo?: { software: string; version: string };
  printTime?: string;
  estimatedPrintTime?: number;
  filamentWeights?: number[];
  layerColorMap: Array<[number, string[]]>;
  error?: string;
}

/**
 * Parser worker error
 */
export interface ParserWorkerError {
  error: string;
  chunkIndex: number;
}
