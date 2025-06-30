import type { GcodeStats } from '../types/gcode';
import type { OptimizationResult } from '../types/optimization';
import type { SystemConfiguration } from '../types/configuration';
import type { StateSnapshot } from '../services/MergeHistoryManager';
import { getFromMap } from '../utils/typeGuards';

export type EventHandler<T = unknown> = (data: T) => void;

// Define event data types
export interface AppEventMap {
  // File operations
  'file:selected': File;

  // Analysis events
  'analysis:start': void;
  'analysis:complete': { stats: GcodeStats; optimization: OptimizationResult };
  'analysis:error': Error;

  // Export events
  'export:requested': void;
  'export:gcode:requested': void;

  // System events
  'reset:requested': void;
  'cache:clear': void;
  'configuration:changed': SystemConfiguration;

  // Timeline events
  'timeline:navigated': { snapshot: StateSnapshot };

  // View events
  'view:toggle': 'analysis' | 'timeline' | 'upload';
}

export type AppEventKey = keyof AppEventMap;

export class EventEmitter<TEventMap = AppEventMap> {
  private events = new Map<string, Set<EventHandler<any>>>();

  on<K extends keyof TEventMap>(event: K, handler: EventHandler<TEventMap[K]>): () => void {
    if (!this.events.has(event as string)) {
      this.events.set(event as string, new Set());
    }
    getFromMap(
      this.events,
      event as string,
      `Event handler set not found for event: ${String(event)}`
    ).add(handler as EventHandler<any>);

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
      handlers.forEach((handler) => handler(data));
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
  // File operations
  FILE_SELECTED: 'file:selected',

  // Analysis events
  ANALYSIS_START: 'analysis:start',
  ANALYSIS_COMPLETE: 'analysis:complete',
  ANALYSIS_ERROR: 'analysis:error',

  // Export events
  EXPORT_REQUESTED: 'export:requested',
  EXPORT_GCODE_REQUESTED: 'export:gcode:requested',

  // System events
  RESET_REQUESTED: 'reset:requested',
  CLEAR_CACHE: 'cache:clear',
  CONFIGURATION_CHANGED: 'configuration:changed',

  // Timeline events
  TIMELINE_NAVIGATED: 'timeline:navigated',

  // View events
  VIEW_TOGGLE: 'view:toggle',
} as const;
