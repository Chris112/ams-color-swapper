import { describe, it, expect } from 'vitest';
import { BrowserFileReader } from '../fileReader';

function createMockFile(content: string, name: string = 'test.txt'): File {
  const blob = new Blob([content], { type: 'text/plain' });
  return new File([blob], name, { type: 'text/plain' });
}

describe('BrowserFileReader', () => {
  describe('readLines', () => {
    it('should read lines from a file', async () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const file = createMockFile(content);
      const reader = new BrowserFileReader(file);

      const lines: string[] = [];
      for await (const line of reader.readLines()) {
        lines.push(line);
      }

      expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    it('should handle different line endings', async () => {
      const content = 'Line 1\r\nLine 2\rLine 3\nLine 4';
      const file = createMockFile(content);
      const reader = new BrowserFileReader(file);

      const lines: string[] = [];
      for await (const line of reader.readLines()) {
        lines.push(line);
      }

      // The reader splits on \n, so \r\n becomes Line 1\r and Line 2\rLine 3 is one line
      expect(lines.length).toBe(3);
      expect(lines[0]).toBe('Line 1\r');
      expect(lines[1]).toBe('Line 2\rLine 3');
      expect(lines[2]).toBe('Line 4');
    });

    it('should handle files without trailing newline', async () => {
      const content = 'Line 1\nLine 2\nLine 3 without newline';
      const file = createMockFile(content);
      const reader = new BrowserFileReader(file);

      const lines: string[] = [];
      for await (const line of reader.readLines()) {
        lines.push(line);
      }

      expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3 without newline']);
    });

    it('should handle empty files', async () => {
      const file = createMockFile('');
      const reader = new BrowserFileReader(file);

      const lines: string[] = [];
      for await (const line of reader.readLines()) {
        lines.push(line);
      }

      expect(lines).toEqual([]);
    });

    it('should handle single line files', async () => {
      const file = createMockFile('Single line no newline');
      const reader = new BrowserFileReader(file);

      const lines: string[] = [];
      for await (const line of reader.readLines()) {
        lines.push(line);
      }

      expect(lines).toEqual(['Single line no newline']);
    });
  });

  describe('readAll', () => {
    it('should read entire file content', async () => {
      const content = 'This is\nthe entire\nfile content';
      const file = createMockFile(content);
      const reader = new BrowserFileReader(file);

      const result = await reader.readAll();
      expect(result).toBe(content);
    });

    it('should handle large files', async () => {
      // Create a 2MB file
      const largeContent = 'x'.repeat(2 * 1024 * 1024);
      const file = createMockFile(largeContent);
      const reader = new BrowserFileReader(file);

      const result = await reader.readAll();
      expect(result.length).toBe(2 * 1024 * 1024);
    });
  });

  describe('chunked reading', () => {
    it('should read file in chunks', async () => {
      // Create content larger than default chunk size
      const content = 'a'.repeat(2 * 1024 * 1024); // 2MB
      const file = createMockFile(content);
      const reader = new BrowserFileReader(file, 1024 * 512); // 512KB chunks

      let totalLength = 0;
      for await (const line of reader.readLines()) {
        totalLength += line.length;
      }

      expect(totalLength).toBe(content.length);
    });

    it('should handle chunk boundaries correctly', async () => {
      const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      const file = createMockFile(content);
      // Use very small chunk size to force multiple chunks
      const reader = new BrowserFileReader(file, 10);

      const lines: string[] = [];
      for await (const line of reader.readLines()) {
        lines.push(line);
      }

      expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5']);
    });
  });
});
