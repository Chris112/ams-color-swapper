import { DebugLog } from '../types';

export class Logger {
  private logs: DebugLog[] = [];
  private enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string, context?: unknown) {
    const log: DebugLog = {
      timestamp: Date.now(),
      level,
      message,
      context,
    };

    this.logs.push(log);

    if (this.enabled) {
      switch (level) {
        case 'info':
          console.log(`[INFO] ${message}`, context || '');
          break;
        case 'warn':
          console.warn(`[WARN] ${message}`, context || '');
          break;
        case 'error':
          console.error(`[ERROR] ${message}`, context || '');
          break;
        case 'debug':
          console.debug(`[DEBUG] ${message}`, context || '');
          break;
      }
    }
  }

  info(message: string, context?: unknown) {
    this.log('info', message, context);
  }

  warn(message: string, context?: unknown) {
    this.log('warn', message, context);
  }

  error(message: string, context?: unknown) {
    this.log('error', message, context);
  }

  debug(message: string, context?: unknown) {
    this.log('debug', message, context);
  }

  getLogs(): DebugLog[] {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}
