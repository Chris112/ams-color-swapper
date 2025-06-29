import { GcodeStats } from './gcode';
import { DebugLog } from './logging';

/**
 * Worker message types
 */

// Parser Worker Messages
export interface ParserWorkerParseRequest {
  type: 'parse';
  payload: {
    fileContent: string;
    fileName: string;
  };
}

export interface ParserWorkerClearRequest {
  type: 'clear';
}

export interface ParserWorkerProgress {
  type: 'progress';
  payload: {
    progress: number;
    message: string;
  };
}

export interface ParserWorkerComplete {
  type: 'complete';
  payload: {
    stats: GcodeStats;
    logs: DebugLog[];
  };
}

export interface ParserWorkerError {
  type: 'error';
  payload: {
    error: string;
    stack?: string;
  };
}

export type ParserWorkerRequest = ParserWorkerParseRequest | ParserWorkerClearRequest;

export type ParserWorkerMessage =
  | ParserWorkerRequest
  | ParserWorkerProgress
  | ParserWorkerComplete
  | ParserWorkerError;

// Filament Database Worker Messages
export interface FilamentDatabaseWorkerRequest {
  type: 'SEARCH_FILAMENT' | 'GET_ENHANCED_NAME' | 'INIT' | 'SYNC' | 'UPDATE_FILAMENT';
  payload?: any; // TODO: Define specific payload types
}

export interface FilamentDatabaseWorkerResponse {
  type: string;
  payload?: any; // TODO: Define specific response types
  error?: string;
}

export type FilamentDatabaseWorkerMessage =
  | FilamentDatabaseWorkerRequest
  | FilamentDatabaseWorkerResponse;

// Generic Worker Message Handler Type
export type WorkerMessageHandler<T> = (event: MessageEvent<T>) => void | Promise<void>;
