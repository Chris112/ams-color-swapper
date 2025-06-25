import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../logger';

describe('Logger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log levels', () => {
    it('should respect log level hierarchy', () => {
      const logger = new Logger('TestComponent');

      // Default is debug level
      logger.silly('silly message');
      logger.debug('debug message');
      logger.info('info message');

      expect(consoleSpy.debug).not.toHaveBeenCalledWith(
        '[SILLY] [TestComponent] silly message',
        ''
      );
      expect(consoleSpy.debug).toHaveBeenCalledWith('[DEBUG] [TestComponent] debug message', '');
      expect(consoleSpy.log).toHaveBeenCalledWith('[INFO] [TestComponent] info message', '');
    });

    it('should show silly messages when log level is silly', () => {
      const logger = new Logger('TestComponent');
      logger.setLogLevel('silly');

      logger.silly('silly message');
      logger.debug('debug message');

      expect(consoleSpy.debug).toHaveBeenCalledWith('[SILLY] [TestComponent] silly message', '');
      expect(consoleSpy.debug).toHaveBeenCalledWith('[DEBUG] [TestComponent] debug message', '');
    });

    it('should hide debug and silly messages when log level is info', () => {
      const logger = new Logger('TestComponent');
      logger.setLogLevel('info');

      logger.silly('silly message');
      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith('[INFO] [TestComponent] info message', '');
      expect(consoleSpy.warn).toHaveBeenCalledWith('[WARN] [TestComponent] warn message', '');
    });
  });

  describe('component name', () => {
    it('should include component name in log output', () => {
      const logger = new Logger('MyComponent');
      logger.info('test message');

      expect(consoleSpy.log).toHaveBeenCalledWith('[INFO] [MyComponent] test message', '');
    });

    it('should work without component name', () => {
      const logger = new Logger();
      logger.info('test message');

      expect(consoleSpy.log).toHaveBeenCalledWith('[INFO] test message', '');
    });
  });

  describe('log storage', () => {
    it('should store all logs regardless of log level', () => {
      const logger = new Logger('TestComponent');
      logger.setLogLevel('error'); // Only show errors

      logger.silly('silly');
      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      const logs = logger.getLogs();
      expect(logs).toHaveLength(5);
      expect(logs[0].level).toBe('silly');
      expect(logs[1].level).toBe('debug');
      expect(logs[2].level).toBe('info');
      expect(logs[3].level).toBe('warn');
      expect(logs[4].level).toBe('error');
    });
  });
});
