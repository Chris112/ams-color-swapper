export interface DebugLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug' | 'silly';
  message: string;
  context?: unknown;
}
