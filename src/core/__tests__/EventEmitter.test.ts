import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter, AppEvents } from '../EventEmitter';

describe('EventEmitter', () => {
  let eventEmitter: EventEmitter;

  beforeEach(() => {
    eventEmitter = new EventEmitter();
  });

  describe('Basic Event Operations', () => {
    it('should create an EventEmitter instance', () => {
      expect(eventEmitter).toBeInstanceOf(EventEmitter);
    });

    it('should register and trigger event listeners', () => {
      const mockCallback = vi.fn();
      const testFile = new File(['test content'], 'test.gcode', { type: 'text/plain' });

      eventEmitter.on(AppEvents.FILE_SELECTED, mockCallback);
      eventEmitter.emit(AppEvents.FILE_SELECTED, testFile);

      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith(testFile);
    });

    it('should support multiple listeners for the same event', () => {
      const mockCallback1 = vi.fn();
      const mockCallback2 = vi.fn();
      const testFile = new File(['test content'], 'test.gcode', { type: 'text/plain' });

      eventEmitter.on(AppEvents.FILE_SELECTED, mockCallback1);
      eventEmitter.on(AppEvents.FILE_SELECTED, mockCallback2);
      eventEmitter.emit(AppEvents.FILE_SELECTED, testFile);

      expect(mockCallback1).toHaveBeenCalledTimes(1);
      expect(mockCallback2).toHaveBeenCalledTimes(1);
      expect(mockCallback1).toHaveBeenCalledWith(testFile);
      expect(mockCallback2).toHaveBeenCalledWith(testFile);
    });

    it('should allow removing event listeners', () => {
      const mockCallback = vi.fn();
      const testFile = new File(['test content'], 'test.gcode', { type: 'text/plain' });

      eventEmitter.on(AppEvents.FILE_SELECTED, mockCallback);
      eventEmitter.off(AppEvents.FILE_SELECTED, mockCallback);
      eventEmitter.emit(AppEvents.FILE_SELECTED, testFile);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle events with no listeners gracefully', () => {
      const testFile = new File(['test content'], 'test.gcode', { type: 'text/plain' });
      expect(() => {
        eventEmitter.emit(AppEvents.FILE_SELECTED, testFile);
      }).not.toThrow();
    });
  });

  describe('Event Types', () => {
    it('should support all defined AppEvents', () => {
      const mockCallback = vi.fn();
      const testFile = new File(['test'], 'test.gcode', { type: 'text/plain' });

      // Test FILE_SELECTED event
      eventEmitter.on(AppEvents.FILE_SELECTED, mockCallback);
      eventEmitter.emit(AppEvents.FILE_SELECTED, testFile);

      // Test ANALYSIS_COMPLETE event
      eventEmitter.on(AppEvents.ANALYSIS_COMPLETE, mockCallback);
      eventEmitter.emit(AppEvents.ANALYSIS_COMPLETE, { stats: {} as any, optimization: {} as any });

      // Test ANALYSIS_ERROR event
      eventEmitter.on(AppEvents.ANALYSIS_ERROR, mockCallback);
      eventEmitter.emit(AppEvents.ANALYSIS_ERROR, new Error('Test error'));

      // Test void events
      eventEmitter.on(AppEvents.EXPORT_REQUESTED, mockCallback);
      eventEmitter.emit(AppEvents.EXPORT_REQUESTED);

      eventEmitter.on(AppEvents.RESET_REQUESTED, mockCallback);
      eventEmitter.emit(AppEvents.RESET_REQUESTED);

      expect(mockCallback).toHaveBeenCalledTimes(5);
    });
  });

  describe('Error Handling', () => {
    it('should allow listeners to throw errors', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();

      eventEmitter.on(AppEvents.FILE_SELECTED, errorListener);
      eventEmitter.on(AppEvents.FILE_SELECTED, normalListener);

      const testFile = new File(['test'], 'test.gcode', { type: 'text/plain' });
      // Should throw if listener throws (EventEmitter doesn't catch errors)
      expect(() => {
        eventEmitter.emit(AppEvents.FILE_SELECTED, testFile);
      }).toThrow('Listener error');

      // Error listener should have been called
      expect(errorListener).toHaveBeenCalled();
    });

    it('should handle removing non-existent listeners', () => {
      const mockCallback = vi.fn();

      expect(() => {
        eventEmitter.off(AppEvents.FILE_SELECTED, mockCallback);
      }).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should properly clean up listeners', () => {
      const mockCallback = vi.fn();

      eventEmitter.on(AppEvents.FILE_SELECTED, mockCallback);
      eventEmitter.off(AppEvents.FILE_SELECTED, mockCallback);

      const testFile1 = new File(['test1'], 'test1.gcode', { type: 'text/plain' });
      const testFile2 = new File(['test2'], 'test2.gcode', { type: 'text/plain' });
      // Emit multiple times to ensure cleanup
      eventEmitter.emit(AppEvents.FILE_SELECTED, testFile1);
      eventEmitter.emit(AppEvents.FILE_SELECTED, testFile2);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle removing listeners while emitting', () => {
      const selfRemovingListener = vi.fn(() => {
        eventEmitter.off(AppEvents.FILE_SELECTED, selfRemovingListener);
      });
      const normalListener = vi.fn();

      eventEmitter.on(AppEvents.FILE_SELECTED, selfRemovingListener);
      eventEmitter.on(AppEvents.FILE_SELECTED, normalListener);

      const testFile1 = new File(['test1'], 'test1.gcode', { type: 'text/plain' });
      const testFile2 = new File(['test2'], 'test2.gcode', { type: 'text/plain' });

      eventEmitter.emit(AppEvents.FILE_SELECTED, testFile1);

      expect(selfRemovingListener).toHaveBeenCalledTimes(1);
      expect(normalListener).toHaveBeenCalledTimes(1);

      // Second emit should only call normalListener
      eventEmitter.emit(AppEvents.FILE_SELECTED, testFile2);
      expect(selfRemovingListener).toHaveBeenCalledTimes(1);
      expect(normalListener).toHaveBeenCalledTimes(2);
    });
  });

  describe('Data Passing', () => {
    it('should pass file data correctly', () => {
      const mockCallback = vi.fn();
      const testFile = new File(['test content'], 'test.gcode', { type: 'text/plain' });

      eventEmitter.on(AppEvents.FILE_SELECTED, mockCallback);
      eventEmitter.emit(AppEvents.FILE_SELECTED, testFile);

      expect(mockCallback).toHaveBeenCalledWith(testFile);
      expect(mockCallback.mock.calls[0][0]).toEqual(testFile);
      expect(mockCallback.mock.calls[0][0].name).toBe('test.gcode');
      expect(mockCallback.mock.calls[0][0].type).toBe('text/plain');
    });

    it('should handle events with optional data', () => {
      const mockCallback = vi.fn();

      // Test events that accept void/undefined
      eventEmitter.on(AppEvents.EXPORT_REQUESTED, mockCallback);
      eventEmitter.emit(AppEvents.EXPORT_REQUESTED, undefined);
      expect(mockCallback).toHaveBeenCalledWith(undefined);

      eventEmitter.on(AppEvents.RESET_REQUESTED, mockCallback);
      eventEmitter.emit(AppEvents.RESET_REQUESTED);
      expect(mockCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance', () => {
    it('should handle many listeners efficiently', () => {
      const listeners = Array.from({ length: 100 }, () => vi.fn());

      // Add many listeners
      listeners.forEach((listener) => {
        eventEmitter.on(AppEvents.FILE_SELECTED, listener);
      });

      const testFile = new File(['test'], 'test.gcode', { type: 'text/plain' });
      const startTime = performance.now();
      eventEmitter.emit(AppEvents.FILE_SELECTED, testFile);
      const endTime = performance.now();

      // Should complete quickly (less than 10ms for 100 listeners)
      expect(endTime - startTime).toBeLessThan(10);

      // All listeners should have been called
      listeners.forEach((listener) => {
        expect(listener).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle many events efficiently', () => {
      const mockCallback = vi.fn();
      eventEmitter.on(AppEvents.FILE_SELECTED, mockCallback);

      const startTime = performance.now();

      // Emit many events
      for (let i = 0; i < 1000; i++) {
        const testFile = new File([`test${i}`], `test${i}.gcode`, { type: 'text/plain' });
        eventEmitter.emit(AppEvents.FILE_SELECTED, testFile);
      }

      const endTime = performance.now();

      // Should complete quickly (less than 150ms for 1000 events)
      expect(endTime - startTime).toBeLessThan(150);
      expect(mockCallback).toHaveBeenCalledTimes(1000);
    });
  });
});
