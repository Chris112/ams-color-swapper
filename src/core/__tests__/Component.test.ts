import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Component } from '../Component';
import { EventEmitter, AppEvents } from '../EventEmitter';
import { AppStateData } from '../../state/AppState';

// Mock AppState module
vi.mock('../../state/AppState', () => ({
  appState: {
    getState: vi.fn(() => ({
      view: 'upload',
      stats: null,
      optimization: null,
      preferences: {
        timelineView: 'color',
      },
    })),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  },
}));

// Create a concrete test component
class TestComponent extends Component {
  public renderCallCount = 0;
  public shouldUpdateCallCount = 0;
  public shouldUpdateResult = true;

  protected render(): void {
    this.renderCallCount++;
    if (this.element) {
      this.element.textContent = `Rendered ${this.renderCallCount} times`;
    }
  }

  protected shouldUpdate(oldState: AppStateData, newState: AppStateData): boolean {
    this.shouldUpdateCallCount++;
    return this.shouldUpdateResult;
  }

  // Expose protected methods for testing
  public testShow() {
    this.show();
  }

  public testHide() {
    this.hide();
  }

  public testToggle(show?: boolean) {
    this.toggle(show);
  }

  public testInitialize() {
    this.initialize();
  }

  public testStateChange(newState: AppStateData) {
    this.onStateChange(newState);
  }

  public testEmit(event: string, data?: any) {
    this.emit(event, data);
  }
}

describe('Component', () => {
  let component: TestComponent;
  let mockElement: HTMLElement;

  beforeEach(() => {
    // Create mock DOM element
    mockElement = document.createElement('div');
    mockElement.id = 'test-component';
    document.body.appendChild(mockElement);

    // Create component instance
    component = new TestComponent('#test-component');
    // Manually initialize to trigger first render
    component.testInitialize();
  });

  afterEach(() => {
    // Clean up DOM
    document.body.innerHTML = '';
  });

  describe('Constructor and Initialization', () => {
    it('should create component with valid selector', () => {
      expect(component).toBeInstanceOf(Component);
      expect(component.element).toBe(mockElement);
    });

    it('should throw error for invalid selector', () => {
      expect(() => {
        new TestComponent('#non-existent');
      }).toThrow('Required element not found: #non-existent');
    });

    it('should initialize without throwing', () => {
      expect(component).toBeInstanceOf(Component);
      expect(component.element).toBe(mockElement);
    });
  });

  describe('Visibility Management', () => {
    it('should show component', () => {
      component.testHide(); // Hide first
      expect(mockElement.classList.contains('hidden')).toBe(true);
      expect(mockElement.hasAttribute('hidden')).toBe(true);

      component.testShow();
      expect(mockElement.classList.contains('hidden')).toBe(false);
      expect(mockElement.hasAttribute('hidden')).toBe(false);
    });

    it('should hide component', () => {
      component.testHide();
      expect(mockElement.classList.contains('hidden')).toBe(true);
      expect(mockElement.hasAttribute('hidden')).toBe(true);
    });

    it('should toggle component visibility', () => {
      // Toggle to hide
      component.testToggle(false);
      expect(mockElement.classList.contains('hidden')).toBe(true);
      expect(mockElement.hasAttribute('hidden')).toBe(true);

      // Toggle to show
      component.testToggle(true);
      expect(mockElement.classList.contains('hidden')).toBe(false);
      expect(mockElement.hasAttribute('hidden')).toBe(false);

      // Toggle without parameter (should hide if visible)
      component.testToggle();
      expect(mockElement.classList.contains('hidden')).toBe(true);

      // Toggle again (should show if hidden)
      component.testToggle();
      expect(mockElement.classList.contains('hidden')).toBe(false);
    });
  });

  describe('State Management', () => {
    it('should handle state changes and trigger render', () => {
      const initialRenderCount = component.renderCallCount;
      const newState = {
        view: 'results' as const,
        stats: null,
        optimization: null,
        preferences: {
          timelineView: 'slot' as const,
        },
      };

      component.testStateChange(newState);

      expect(component.shouldUpdateCallCount).toBe(1);
      expect(component.renderCallCount).toBe(initialRenderCount + 1);
    });

    it('should not render when shouldUpdate returns false', () => {
      component.shouldUpdateResult = false;
      const initialRenderCount = component.renderCallCount;

      const newState = {
        view: 'results' as const,
        stats: null,
        optimization: null,
        preferences: {
          timelineView: 'slot' as const,
        },
      };

      component.testStateChange(newState);

      expect(component.shouldUpdateCallCount).toBe(1);
      expect(component.renderCallCount).toBe(initialRenderCount); // No additional render
    });

    it('should update state property when handling state changes', () => {
      const newState = {
        view: 'results' as const,
        stats: null,
        optimization: null,
        preferences: {
          timelineView: 'slot' as const,
        },
      };

      component.testStateChange(newState);
      expect(component.state).toEqual(newState);
    });
  });

  describe('Event Emission', () => {
    it('should emit events through global event bus', () => {
      // We can't easily test the global eventBus without mocking it
      // This test just ensures the emit method doesn't throw
      const testData = { filename: 'test.gcode' };
      expect(() => {
        component.testEmit(AppEvents.FILE_LOADED, testData);
      }).not.toThrow();
    });

    it('should emit events without data', () => {
      expect(() => {
        component.testEmit(AppEvents.RESET_REQUESTED);
      }).not.toThrow();
    });
  });

  describe('Lifecycle Management', () => {
    it('should handle initialization', () => {
      const initialRenderCount = component.renderCallCount;
      component.testInitialize();

      // Initialize should trigger a render
      expect(component.renderCallCount).toBe(initialRenderCount + 1);
    });

    it('should maintain element reference throughout lifecycle', () => {
      const originalElement = component.element;

      component.testHide();
      component.testShow();
      component.testInitialize();

      expect(component.element).toBe(originalElement);
    });
  });

  describe('Render Behavior', () => {
    it('should update element content when rendering', () => {
      const initialContent = mockElement.textContent;
      component.testInitialize(); // Trigger another render

      expect(mockElement.textContent).not.toBe(initialContent);
      expect(mockElement.textContent).toContain('Rendered');
    });

    it('should handle multiple renders correctly', () => {
      const initialRenderCount = component.renderCallCount;

      // Trigger multiple renders
      component.testInitialize();
      component.testInitialize();
      component.testInitialize();

      expect(component.renderCallCount).toBe(initialRenderCount + 3);
      expect(mockElement.textContent).toContain(`Rendered ${component.renderCallCount} times`);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing element gracefully in visibility methods', () => {
      // Remove element from DOM
      document.body.removeChild(mockElement);

      // These should not throw
      expect(() => component.testShow()).not.toThrow();
      expect(() => component.testHide()).not.toThrow();
      expect(() => component.testToggle()).not.toThrow();
    });

    it('should handle render errors gracefully', () => {
      // Create a component that throws during render
      class ErrorComponent extends Component {
        protected render(): void {
          throw new Error('Render error');
        }

        protected shouldUpdate(): boolean {
          return true;
        }
      }

      const errorElement = document.createElement('div');
      errorElement.id = 'error-component';
      document.body.appendChild(errorElement);

      // Should not throw during construction despite render error
      expect(() => {
        new ErrorComponent('#error-component');
      }).not.toThrow();

      document.body.removeChild(errorElement);
    });
  });

  describe('State Comparison', () => {
    it('should provide old and new state to shouldUpdate', () => {
      let capturedOldState: AppStateData | null = null;
      let capturedNewState: AppStateData | null = null;

      class StateTrackingComponent extends Component {
        protected render(): void {}

        protected shouldUpdate(oldState: AppStateData, newState: AppStateData): boolean {
          capturedOldState = oldState;
          capturedNewState = newState;
          return true;
        }

        public testInitialize() {
          this.initialize();
        }
      }

      const stateElement = document.createElement('div');
      stateElement.id = 'state-component';
      document.body.appendChild(stateElement);

      const stateComponent = new StateTrackingComponent('#state-component');
      // Initialize to set the initial state
      (stateComponent as any).testInitialize();

      const newState = {
        view: 'results' as const,
        stats: null,
        optimization: null,
        preferences: {
          timelineView: 'slot' as const,
        },
      };

      // Simulate state change
      (stateComponent as any).onStateChange(newState);

      expect(capturedOldState).toEqual({
        view: 'upload',
        stats: null,
        optimization: null,
        preferences: {
          timelineView: 'color',
        },
      });
      expect(capturedNewState).toEqual(newState);

      document.body.removeChild(stateElement);
    });
  });
});
