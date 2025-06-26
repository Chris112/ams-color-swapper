import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../logger';

// Mock import.meta.env
vi.stubEnv('MODE', 'test');

describe('Logger', () => {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    debug: console.debug,
  };

  beforeEach(() => {
    // Mock all console methods
    console.log = vi.fn();
    console.error = vi.fn();
    console.warn = vi.fn();
    console.debug = vi.fn();
  });

  afterEach(() => {
    // Restore original console methods
    Object.assign(console, originalConsole);
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('Basic logging methods in development mode', () => {
    let logger: Logger;

    beforeEach(() => {
      vi.stubEnv('MODE', 'development');
      logger = new Logger('TestComponent');
    });

    it('should log info messages with correct format', () => {
      logger.info('test message', { data: 'value' });
      expect(console.log).toHaveBeenCalledWith('[INFO] [TestComponent] test message', { data: 'value' });
    });

    it('should log error messages with correct format', () => {
      const error = new Error('test error');
      logger.error('error message', error);
      expect(console.error).toHaveBeenCalledWith('[ERROR] [TestComponent] error message', error);
    });

    it('should log warn messages with correct format', () => {
      logger.warn('warning message');
      expect(console.warn).toHaveBeenCalledWith('[WARN] [TestComponent] warning message', '');
    });

    it('should log debug messages with correct format', () => {
      logger.debug('debug message', { debug: true });
      expect(console.debug).toHaveBeenCalledWith('[DEBUG] [TestComponent] debug message', { debug: true });
    });

    it('should log silly messages as debug with correct format', () => {
      logger.setLogLevel('silly'); // Need to set log level to silly to see silly messages
      logger.silly('silly message', { silly: true });
      expect(console.debug).toHaveBeenCalledWith('[SILLY] [TestComponent] silly message', { silly: true });
    });
  });

  describe('Basic logging methods in production mode', () => {
    let logger: Logger;

    beforeEach(() => {
      vi.stubEnv('MODE', 'production');
      logger = new Logger('TestComponent');
    });

    it('should not log in production mode', () => {
      logger.info('test message', { data: 'value' });
      logger.error('error message', new Error('test error'));
      logger.warn('warning message');
      logger.debug('debug message', { debug: true });
      logger.silly('silly message');

      expect(console.log).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.debug).not.toHaveBeenCalled();
    });
  });

  describe('Log level filtering', () => {
    let logger: Logger;

    beforeEach(() => {
      vi.stubEnv('MODE', 'development');
      logger = new Logger('TestComponent');
    });

    it('should respect log levels - only error and warn when level is warn', () => {
      logger.setLogLevel('warn');
      
      logger.silly('silly message');
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith('[WARN] [TestComponent] warn message', '');
      expect(console.error).toHaveBeenCalledWith('[ERROR] [TestComponent] error message', '');
    });

    it('should log all levels when level is silly', () => {
      logger.setLogLevel('silly');
      
      logger.silly('silly message');
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(console.debug).toHaveBeenCalledTimes(2); // silly and debug
      expect(console.log).toHaveBeenCalledTimes(1); // info
      expect(console.warn).toHaveBeenCalledTimes(1); // warn
      expect(console.error).toHaveBeenCalledTimes(1); // error
    });
  });

  describe('Logger without component name', () => {
    let logger: Logger;

    beforeEach(() => {
      vi.stubEnv('MODE', 'development');
      logger = new Logger();
    });

    it('should log without component name prefix', () => {
      logger.info('test message');
      expect(console.log).toHaveBeenCalledWith('[INFO] test message', '');
    });
  });

  describe('Log storage and retrieval', () => {
    let logger: Logger;

    beforeEach(() => {
      vi.stubEnv('MODE', 'development');
      logger = new Logger('TestComponent');
    });

    it('should store logs internally', () => {
      logger.info('message 1');
      logger.warn('message 2');
      logger.error('message 3');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0]).toMatchObject({
        level: 'info',
        message: 'message 1',
      });
      expect(logs[1]).toMatchObject({
        level: 'warn',
        message: 'message 2',
      });
      expect(logs[2]).toMatchObject({
        level: 'error',
        message: 'message 3',
      });
    });

    it('should clear logs', () => {
      logger.info('message 1');
      logger.warn('message 2');
      
      expect(logger.getLogs()).toHaveLength(2);
      
      logger.clearLogs();
      expect(logger.getLogs()).toHaveLength(0);
    });

    it('should store logs even in production mode', () => {
      vi.stubEnv('MODE', 'production');
      const prodLogger = new Logger('TestComponent');
      
      prodLogger.info('message 1');
      prodLogger.error('message 2');
      
      const logs = prodLogger.getLogs();
      expect(logs).toHaveLength(2);
      expect(console.log).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('Enable/disable functionality', () => {
    let logger: Logger;

    beforeEach(() => {
      vi.stubEnv('MODE', 'development');
      logger = new Logger('TestComponent');
    });

    it('should allow disabling logger in development', () => {
      logger.setEnabled(false);
      logger.info('test message');
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should allow enabling logger after disabling', () => {
      logger.setEnabled(false);
      logger.info('message 1');
      expect(console.log).not.toHaveBeenCalled();

      logger.setEnabled(true);
      logger.info('message 2');
      expect(console.log).toHaveBeenCalledWith('[INFO] [TestComponent] message 2', '');
    });
  });

  describe('getLogLevel method', () => {
    let logger: Logger;

    beforeEach(() => {
      vi.stubEnv('MODE', 'development');
      logger = new Logger('TestComponent');
    });

    it('should return current log level', () => {
      expect(logger.getLogLevel()).toBe('debug'); // default
      
      logger.setLogLevel('error');
      expect(logger.getLogLevel()).toBe('error');
      
      logger.setLogLevel('silly');
      expect(logger.getLogLevel()).toBe('silly');
    });
  });

  describe('Timestamps in logs', () => {
    let logger: Logger;

    beforeEach(() => {
      vi.stubEnv('MODE', 'development');
      logger = new Logger('TestComponent');
    });

    it('should include timestamps in stored logs', () => {
      const before = Date.now();
      logger.info('test message');
      const after = Date.now();

      const logs = logger.getLogs();
      expect(logs[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(logs[0].timestamp).toBeLessThanOrEqual(after);
    });
  });
});