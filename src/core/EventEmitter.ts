import type { GcodeStats, OptimizationResult } from '../types';

export type EventHandler<T = unknown> = (data: T) => void;

// Define event data types
export interface AppEventMap {
  'file:selected': File;
  'analysis:start': void;
  'analysis:complete': { stats: GcodeStats; optimization: OptimizationResult };
  'analysis:error': Error;
  'export:requested': void;
  'reset:requested': void;
  'debug:toggle': void;
  'tab:change': 'logs' | 'performance' | 'raw';
  'cache:clear': void;
}

export type AppEventKey = keyof AppEventMap;

export class EventEmitter<TEventMap = AppEventMap> {
  private events = new Map<string, Set<EventHandler<any>>>();

  on<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): () => void {
    if (!this.events.has(event as string)) {
      this.events.set(event as string, new Set());
    }
    this.events.get(event as string)!.add(handler as EventHandler<any>);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  off<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): void {
    const handlers = this.events.get(event as string);
    if (handlers) {
      handlers.delete(handler as EventHandler<any>);
      if (handlers.size === 0) {
        this.events.delete(event as string);
      }
    }
  }

  emit<K extends keyof TEventMap>(event: K, data?: TEventMap[K]): void {
    const handlers = this.events.get(event as string);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}

// Global event bus for app-wide events
export const eventBus = new EventEmitter();

// Event types
export const AppEvents = {
  FILE_SELECTED: 'file:selected',
  ANALYSIS_START: 'analysis:start',
  ANALYSIS_COMPLETE: 'analysis:complete',
  ANALYSIS_ERROR: 'analysis:error',
  EXPORT_REQUESTED: 'export:requested',
  RESET_REQUESTED: 'reset:requested',
  DEBUG_TOGGLE: 'debug:toggle',
  TAB_CHANGE: 'tab:change',
  CLEAR_CACHE: 'cache:clear',
} as const;