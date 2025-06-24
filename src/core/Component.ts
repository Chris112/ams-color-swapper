import { appState, AppStateData, StateListener } from '../state/AppState';
import { eventBus } from './EventEmitter';

export abstract class Component {
  protected element: HTMLElement;
  protected state: AppStateData;
  private unsubscribeState?: () => void;
  private initialized = false;

  constructor(protected selector: string) {
    const el = document.querySelector(selector);
    if (!el) {
      throw new Error(`Element not found: ${selector}`);
    }
    this.element = el as HTMLElement;
    this.state = appState.getState();
    
    // Subscribe to state changes
    this.unsubscribeState = appState.subscribe(this.onStateChange.bind(this));
  }

  protected initialize(): void {
    this.initialized = true;
    // Initial render after child class initialization
    this.render();
  }

  protected abstract render(): void;

  protected onStateChange(newState: AppStateData): void {
    const oldState = this.state;
    this.state = newState;
    
    // Only re-render if initialized and relevant state changed
    if (this.initialized && this.shouldUpdate(oldState, newState)) {
      this.render();
    }
  }

  protected shouldUpdate(oldState: AppStateData, newState: AppStateData): boolean {
    // By default, always update. Components can override for optimization
    return true;
  }

  protected emit(event: string, data?: any): void {
    eventBus.emit(event, data);
  }

  protected on(event: string, handler: (data: any) => void): () => void {
    return eventBus.on(event, handler);
  }

  public destroy(): void {
    if (this.unsubscribeState) {
      this.unsubscribeState();
    }
    this.cleanup();
  }

  protected cleanup(): void {
    // Override in subclasses for additional cleanup
  }

  // Utility methods
  protected show(): void {
    this.element.classList.remove('hidden');
    this.element.removeAttribute('hidden');
  }

  protected hide(): void {
    this.element.classList.add('hidden');
    this.element.setAttribute('hidden', '');
  }

  protected toggle(visible?: boolean): void {
    if (visible === undefined) {
      // Toggle both class and attribute
      const isHidden = this.element.classList.contains('hidden') || this.element.hasAttribute('hidden');
      if (isHidden) {
        this.show();
      } else {
        this.hide();
      }
    } else {
      if (visible) {
        this.show();
      } else {
        this.hide();
      }
    }
  }
}