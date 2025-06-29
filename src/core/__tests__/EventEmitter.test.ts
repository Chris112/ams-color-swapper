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
      const testData = { message: 'test' };

      eventEmitter.on(AppEvents.FILE_LOADED, mockCallback);
      eventEmitter.emit(AppEvents.FILE_LOADED, testData);

      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith(testData);
    });

    it('should support multiple listeners for the same event', () => {
      const mockCallback1 = vi.fn();
      const mockCallback2 = vi.fn();
      const testData = { message: 'test' };

      eventEmitter.on(AppEvents.FILE_LOADED, mockCallback1);
      eventEmitter.on(AppEvents.FILE_LOADED, mockCallback2);
      eventEmitter.emit(AppEvents.FILE_LOADED, testData);

      expect(mockCallback1).toHaveBeenCalledTimes(1);
      expect(mockCallback2).toHaveBeenCalledTimes(1);
      expect(mockCallback1).toHaveBeenCalledWith(testData);
      expect(mockCallback2).toHaveBeenCalledWith(testData);
    });

    it('should allow removing event listeners', () => {
      const mockCallback = vi.fn();
      const testData = { message: 'test' };

      eventEmitter.on(AppEvents.FILE_LOADED, mockCallback);
      eventEmitter.off(AppEvents.FILE_LOADED, mockCallback);
      eventEmitter.emit(AppEvents.FILE_LOADED, testData);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle events with no listeners gracefully', () => {
      expect(() => {
        eventEmitter.emit(AppEvents.FILE_LOADED, { data: 'test' });
      }).not.toThrow();
    });
  });

  describe('Event Types', () => {
    it('should support all defined AppEvents', () => {
      const mockCallback = vi.fn();

      // Test a selection of critical events
      const eventsToTest = [
        AppEvents.FILE_LOADED,
        AppEvents.OPTIMIZATION_COMPLETE,
        AppEvents.ERROR_OCCURRED,
        AppEvents.EXPORT_REQUESTED,
        AppEvents.RESET_REQUESTED,
      ];

      eventsToTest.forEach((event) => {
        eventEmitter.on(event, mockCallback);
        eventEmitter.emit(event, { test: true });
      });

      expect(mockCallback).toHaveBeenCalledTimes(eventsToTest.length);
    });
  });

  describe('Error Handling', () => {
    it('should allow listeners to throw errors', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();

      eventEmitter.on(AppEvents.FILE_LOADED, errorListener);
      eventEmitter.on(AppEvents.FILE_LOADED, normalListener);

      // Should throw if listener throws (EventEmitter doesn't catch errors)
      expect(() => {
        eventEmitter.emit(AppEvents.FILE_LOADED, { data: 'test' });
      }).toThrow('Listener error');

      // Error listener should have been called
      expect(errorListener).toHaveBeenCalled();
    });

    it('should handle removing non-existent listeners', () => {
      const mockCallback = vi.fn();

      expect(() => {
        eventEmitter.off(AppEvents.FILE_LOADED, mockCallback);
      }).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should properly clean up listeners', () => {
      const mockCallback = vi.fn();

      eventEmitter.on(AppEvents.FILE_LOADED, mockCallback);
      eventEmitter.off(AppEvents.FILE_LOADED, mockCallback);

      // Emit multiple times to ensure cleanup
      eventEmitter.emit(AppEvents.FILE_LOADED, { data: 'test1' });
      eventEmitter.emit(AppEvents.FILE_LOADED, { data: 'test2' });

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle removing listeners while emitting', () => {
      const selfRemovingListener = vi.fn(() => {
        eventEmitter.off(AppEvents.FILE_LOADED, selfRemovingListener);
      });
      const normalListener = vi.fn();

      eventEmitter.on(AppEvents.FILE_LOADED, selfRemovingListener);
      eventEmitter.on(AppEvents.FILE_LOADED, normalListener);

      eventEmitter.emit(AppEvents.FILE_LOADED, { data: 'test' });

      expect(selfRemovingListener).toHaveBeenCalledTimes(1);
      expect(normalListener).toHaveBeenCalledTimes(1);

      // Second emit should only call normalListener
      eventEmitter.emit(AppEvents.FILE_LOADED, { data: 'test2' });
      expect(selfRemovingListener).toHaveBeenCalledTimes(1);
      expect(normalListener).toHaveBeenCalledTimes(2);
    });
  });

  describe('Data Passing', () => {
    it('should pass complex data structures correctly', () => {
      const mockCallback = vi.fn();
      const complexData = {
        file: { name: 'test.gcode', size: 12345 },
        colors: ['#FF0000', '#00FF00', '#0000FF'],
        metadata: {
          layers: 100,
          printTime: '2h 30m',
          nested: {
            deep: true,
            value: 42,
          },
        },
      };

      eventEmitter.on(AppEvents.FILE_LOADED, mockCallback);
      eventEmitter.emit(AppEvents.FILE_LOADED, complexData);

      expect(mockCallback).toHaveBeenCalledWith(complexData);
      expect(mockCallback.mock.calls[0][0]).toEqual(complexData);
    });

    it('should handle undefined and null data', () => {
      const mockCallback = vi.fn();

      eventEmitter.on(AppEvents.FILE_LOADED, mockCallback);

      eventEmitter.emit(AppEvents.FILE_LOADED, undefined);
      expect(mockCallback).toHaveBeenCalledWith(undefined);

      eventEmitter.emit(AppEvents.FILE_LOADED, null);
      expect(mockCallback).toHaveBeenCalledWith(null);
    });
  });

  describe('Performance', () => {
    it('should handle many listeners efficiently', () => {
      const listeners = Array.from({ length: 100 }, () => vi.fn());

      // Add many listeners
      listeners.forEach((listener) => {
        eventEmitter.on(AppEvents.FILE_LOADED, listener);
      });

      const startTime = performance.now();
      eventEmitter.emit(AppEvents.FILE_LOADED, { data: 'test' });
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
      eventEmitter.on(AppEvents.FILE_LOADED, mockCallback);

      const startTime = performance.now();

      // Emit many events
      for (let i = 0; i < 1000; i++) {
        eventEmitter.emit(AppEvents.FILE_LOADED, { iteration: i });
      }

      const endTime = performance.now();

      // Should complete quickly (less than 50ms for 1000 events)
      expect(endTime - startTime).toBeLessThan(50);
      expect(mockCallback).toHaveBeenCalledTimes(1000);
    });
  });
});
