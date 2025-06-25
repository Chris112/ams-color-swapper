import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GcodeRepository } from '../GcodeRepository';
import { ValidationError, ParseError } from '../../types';

// Polyfill File.text() for test environment
if (!File.prototype.text) {
  File.prototype.text = function() {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(this);
    });
  };
}

// Mock the parsers
vi.mock('../../parser/gcodeParser', () => ({
  GcodeParser: vi.fn().mockImplementation(() => ({
    parse: vi.fn().mockImplementation(async (input, fileName) => {
      // Handle both string content and File objects
      let content = '';
      let fileSize = 1000;
      
      if (typeof input === 'string') {
        content = input;
        fileSize = input.length;
      } else if (input instanceof File) {
        content = await input.text();
        fileSize = input.size;
        fileName = input.name;
      }
      
      // Simulate some parsing time
      await new Promise(resolve => setTimeout(resolve, 10));
      return {
        fileName: fileName || 'unknown.gcode',
        fileSize,
        totalLayers: 100,
        totalHeight: 200,
        colors: [],
        toolChanges: [],
        layerColorMap: new Map(),
        colorUsageRanges: [],
        parserWarnings: [],
        parseTime: 0, // This will be set by the repository
      };
    }),
  })),
}));


describe('GcodeRepository', () => {
  let repository: GcodeRepository;

  beforeEach(() => {
    repository = new GcodeRepository();
  });

  describe('validateFile', () => {
    it('should accept valid G-code files', () => {
      const validFiles = [
        new File(['G1 X10'], 'test.gcode', { type: 'text/plain' }),
        new File(['G1 X10'], 'test.gco', { type: 'text/plain' }),
        new File(['G1 X10'], 'test.g', { type: 'text/plain' }),
        new File(['G1 X10'], 'test.nc', { type: 'text/plain' }),
      ];

      for (const file of validFiles) {
        const result = repository.validateFile(file);
        expect(result.ok).toBe(true);
      }
    });

    it('should reject invalid file extensions', () => {
      const file = new File([''], 'test.txt', { type: 'text/plain' });
      const result = repository.validateFile(file);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.field).toBe('fileExtension');
      }
    });

    it('should reject files that are too large', () => {
      // Create a mock file with large size without actually creating the content
      const file = new File(['small content'], 'test.gcode', { type: 'text/plain' });
      Object.defineProperty(file, 'size', { value: 501 * 1024 * 1024 });
      const result = repository.validateFile(file);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.field).toBe('fileSize');
      }
    });

    it('should reject empty files', () => {
      const file = new File([''], 'test.gcode', { type: 'text/plain' });
      // Override size to 0
      Object.defineProperty(file, 'size', { value: 0 });
      const result = repository.validateFile(file);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.field).toBe('fileSize');
      }
    });
  });

  describe('parseFile', () => {
    it('should parse small files with regular parser', async () => {
      const content = 'G1 X10 Y10';
      const file = new File([content], 'test.gcode', { type: 'text/plain' });
      
      const result = await repository.parseFile(file);
      
      if (!result.ok) {
        console.error('Parse failed:', result.error);
      }
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.fileName).toBe('test.gcode');
        expect(result.value.parseTime).toBeGreaterThan(0);
      }
    });

    it('should parse large files', async () => {
      // Create a test file
      const content = 'G1 X10 Y10\n'.repeat(100);
      const file = new File([content], 'large.gcode', { type: 'text/plain' });
      
      const result = await repository.parseFile(file);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.fileName).toBe('large.gcode');
      }
    });

    it('should return error for invalid files', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      
      const result = await repository.parseFile(file);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });
  });

  describe('parseContent', () => {
    it('should parse G-code content', async () => {
      const content = 'G1 X10 Y10\nG1 X20 Y20';
      
      const result = await repository.parseContent(content, 'test.gcode');
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.fileName).toBe('test.gcode');
        expect(result.value.parseTime).toBeGreaterThan(0);
      }
    });

    it('should handle parser errors', async () => {
      // Override the mock to throw an error
      const errorParser = {
        parse: vi.fn().mockRejectedValue(new Error('Parse failed')),
      };
      (repository as any).parser = errorParser;
      
      const result = await repository.parseContent('invalid', 'test.gcode');
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ParseError);
        expect(result.error.message).toContain('Parse failed');
      }
    });
  });
});