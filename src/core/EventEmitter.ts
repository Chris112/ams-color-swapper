export type EventHandler<T = any> = (data: T) => void;

export class EventEmitter {
  private events = new Map<string, Set<EventHandler>>();

  on<T = any>(event: string, handler: EventHandler<T>): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.events.delete(event);
      }
    }
  }

  emit<T = any>(event: string, data?: T): void {
    const handlers = this.events.get(event);
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