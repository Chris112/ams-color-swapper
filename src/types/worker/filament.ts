/**
 * Filament database worker-specific type definitions
 */

/**
 * Message types for filament database worker
 */
export interface FilamentWorkerMessage {
  type: 'START_SYNC' | 'STOP_SYNC' | 'GET_STATUS' | 'CLEAR_DATA';
  payload?: any;
}

/**
 * Filament worker response
 */
export interface FilamentWorkerResponse {
  type:
    | 'SYNC_STARTED'
    | 'SYNC_STOPPED'
    | 'SYNC_STATUS'
    | 'DATA_CLEARED'
    | 'ERROR'
    | 'WORKER_READY'
    | 'SYNC_ERROR'
    | 'SYNC_COMPLETE'
    | 'SYNC_PROGRESS'
    | 'STATUS';
  payload?: {
    status?: 'idle' | 'syncing' | 'error';
    progress?: number;
    message?: string;
    error?: string;
    initialized?: boolean;
    totalFilaments?: number;
    processedCount?: number;
    elapsedTime?: number;
    averageProcessingTime?: number;
    memoryUsage?: number;
    filamentCount?: number;
  };
}
