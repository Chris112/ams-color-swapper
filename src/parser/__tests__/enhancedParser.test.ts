import { describe, it, expect } from 'vitest';
import { parseLine, LineMode } from '../enhancedParser';

describe('Enhanced Parser - Line Parsing', () => {
  describe('parseLine', () => {
    it('should parse basic G-code commands', () => {
      const result = parseLine('G0 X10.5 Y20.0 Z5.25 F3000');
      expect(result.words).toEqual([
        ['G', 0],
        ['X', 10.5],
        ['Y', 20],
        ['Z', 5.25],
        ['F', 3000],
      ]);
    });

    it('should parse with flatten option', () => {
      const result = parseLine('G0 X10 Y20', { flatten: true });
      expect(result.words).toEqual(['G0', 'X10', 'Y20']);
    });

    it('should handle comments correctly', () => {
      const result = parseLine('G0 X10 Y20 ; Move to position');
      expect(result.comments).toEqual(['Move to position']);

      const result2 = parseLine('G0 X10 (temporary position) Y20');
      expect(result2.comments).toEqual(['temporary position']);
    });

    it('should handle nested parentheses comments', () => {
      const result = parseLine('G0 X10 (outer (inner) comment) Y20');
      expect(result.comments).toEqual(['outer (inner) comment']);
    });

    it('should handle line modes correctly', () => {
      const line = 'G0 X10 Y20 ; comment';

      const original = parseLine(line, { lineMode: LineMode.ORIGINAL });
      expect(original.line).toBe('G0 X10 Y20 ; comment');

      const stripped = parseLine(line, { lineMode: LineMode.STRIPPED });
      expect(stripped.line).toBe('G0 X10 Y20');

      const compact = parseLine(line, { lineMode: LineMode.COMPACT });
      expect(compact.line).toBe('G0X10Y20');
    });

    it('should parse line numbers and checksums', () => {
      const result = parseLine('N123 G0 X10 Y20 *45');
      expect(result.ln).toBe(123);
      expect(result.cs).toBe(45);
    });

    it('should detect checksum errors', () => {
      const result = parseLine('N123 G0 X10 Y20 *999');
      expect(result.cs).toBe(999);
      expect(result.err).toBe(true);
    });

    it('should handle special commands', () => {
      const result1 = parseLine('$H');
      expect(result1.cmds).toEqual(['$H']);

      const result2 = parseLine('%wait');
      expect(result2.cmds).toEqual(['%wait']);

      const result3 = parseLine('{"sr":null}');
      expect(result3.cmds).toEqual(['{"sr":null}']);
    });

    it('should handle tool changes', () => {
      const result = parseLine('T2');
      expect(result.words).toEqual([['T', 2]]);
    });

    it('should handle M600 filament change', () => {
      const result = parseLine('M600');
      expect(result.words).toEqual([['M', 600]]);
    });

    it('should handle decimal values correctly', () => {
      const result = parseLine('G1 X10.123 Y-5.678 E0.0123');
      expect(result.words).toEqual([
        ['G', 1],
        ['X', 10.123],
        ['Y', -5.678],
        ['E', 0.0123],
      ]);
    });

    it('should handle multiple comments in one line', () => {
      const result = parseLine('G0 (first comment) X10 (second comment) Y20');
      expect(result.comments).toEqual(['first comment', 'second comment']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty lines', () => {
      const result = parseLine('');
      expect(result.line).toBe('');
      expect(result.words).toEqual([]);
    });

    it('should handle lines with only comments', () => {
      const result = parseLine('; Just a comment');
      expect(result.line).toBe('; Just a comment');
      expect(result.comments).toEqual(['Just a comment']);
      expect(result.words).toEqual([]);
    });

    it('should handle lines with only whitespace', () => {
      const result = parseLine('   \t   ');
      expect(result.words).toEqual([]);
    });

    it('should handle malformed commands gracefully', () => {
      const result = parseLine('GINVALID X10');
      expect(result.words.length).toBeGreaterThan(0);
    });
  });
});
