import { DebugLog } from '../types';

export class Logger {
  private logs: DebugLog[] = [];
  private enabled: boolean;
  private logLevel: 'silly' | 'debug' | 'info' | 'warn' | 'error' = 'debug';
  private componentName?: string;

  constructor(componentName?: string) {
    this.componentName = componentName;
    this.enabled = import.meta.env.MODE === 'development';
  }

  private shouldLog(level: 'info' | 'warn' | 'error' | 'debug' | 'silly'): boolean {
    const levels = ['silly', 'debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private log(
    level: 'info' | 'warn' | 'error' | 'debug' | 'silly',
    message: string,
    context?: unknown
  ) {
    const log: DebugLog = {
      timestamp: Date.now(),
      level,
      message,
      context,
    };

    this.logs.push(log);

    if (this.enabled && this.shouldLog(level)) {
      const prefix = this.componentName
        ? `[${level.toUpperCase()}] [${this.componentName}]`
        : `[${level.toUpperCase()}]`;
      const formattedMessage = `${prefix} ${message}`;

      switch (level) {
        case 'info':
          console.log(formattedMessage, context || '');
          break;
        case 'warn':
          console.warn(formattedMessage, context || '');
          break;
        case 'error':
          console.error(formattedMessage, context || '');
          break;
        case 'debug':
          console.debug(formattedMessage, context || '');
          break;
        case 'silly':
          console.debug(formattedMessage, context || '');
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

  silly(message: string, context?: unknown) {
    this.log('silly', message, context);
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

  setLogLevel(level: 'silly' | 'debug' | 'info' | 'warn' | 'error') {
    this.logLevel = level;
  }

  getLogLevel(): string {
    return this.logLevel;
  }
}
