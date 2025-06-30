import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Gcode3mfParser } from '../Gcode3mfParser';
import { IGcodeParser } from '../parserFactory';
import { Logger } from '../../utils/logger';
import { GcodeStats } from '../../types/gcode';

// Mock the 3MF utilities
vi.mock('../../utils/3mfUtils', () => ({
  is3mfFile: vi.fn(),
  extractGcodeFrom3mf: vi.fn(),
  createVirtualGcodeFile: vi.fn(),
  validateThreeMfMetadata: vi.fn(),
}));

describe('Gcode3mfParser', () => {
  let mockBaseParser: IGcodeParser;
  let parser: Gcode3mfParser;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('test');
    mockBaseParser = {
      parse: vi.fn(),
    };
    parser = new Gcode3mfParser(mockBaseParser, logger);
  });

  describe('parse method', () => {
    it('should delegate to base parser for non-3MF files', async () => {
      const { is3mfFile } = await import('../../utils/3mfUtils');
      vi.mocked(is3mfFile).mockReturnValue(false);

      const mockFile = new File(['test content'], 'test.gcode', { type: 'text/plain' });
      const expectedStats: GcodeStats = {
        fileName: 'test.gcode',
        fileSize: 12,
        totalLayers: 10,
        totalHeight: 20,
        colors: [],
        toolChanges: [],
        layerColorMap: new Map(),
        colorUsageRanges: [],
        parserWarnings: [],
        parseTime: 100,
      };

      vi.mocked(mockBaseParser.parse).mockResolvedValue(expectedStats);

      const result = await parser.parse(mockFile);

      expect(is3mfFile).toHaveBeenCalledWith(mockFile);
      expect(mockBaseParser.parse).toHaveBeenCalledWith(mockFile);
      expect(result).toBe(expectedStats);
    });

    it('should process 3MF files and enhance with metadata', async () => {
      const { is3mfFile, extractGcodeFrom3mf, createVirtualGcodeFile, validateThreeMfMetadata } =
        await import('../../utils/3mfUtils');

      vi.mocked(is3mfFile).mockReturnValue(true);
      vi.mocked(validateThreeMfMetadata).mockReturnValue(true);

      const mockFile = new File(['3mf content'], 'test.gcode.3mf', { type: 'application/zip' });
      const mockVirtualFile = new File(['gcode content'], 'test.gcode', { type: 'text/plain' });

      const mockExtractionResult = {
        gcode: 'G1 X10 Y10',
        metadata: {
          filament_colors: ['#FF0000', '#00FF00'],
          filament_ids: [0, 1],
          first_extruder: 0,
          nozzle_diameter: 0.4,
          bed_type: 'textured',
          version: 2,
          is_seq_print: false,
          bbox_objects: [],
        },
        originalFileName: 'test.gcode.3mf',
      };

      const mockBaseStats: GcodeStats = {
        fileName: 'test.gcode',
        fileSize: 12,
        totalLayers: 10,
        totalHeight: 20,
        colors: [],
        toolChanges: [],
        layerColorMap: new Map(),
        colorUsageRanges: [],
        parserWarnings: [],
        parseTime: 100,
      };

      vi.mocked(extractGcodeFrom3mf).mockResolvedValue(mockExtractionResult);
      vi.mocked(createVirtualGcodeFile).mockReturnValue(mockVirtualFile);
      vi.mocked(mockBaseParser.parse).mockResolvedValue(mockBaseStats);

      const result = await parser.parse(mockFile);

      expect(is3mfFile).toHaveBeenCalledWith(mockFile);
      expect(extractGcodeFrom3mf).toHaveBeenCalledWith(mockFile);
      expect(createVirtualGcodeFile).toHaveBeenCalledWith(mockExtractionResult);
      expect(mockBaseParser.parse).toHaveBeenCalledWith(mockVirtualFile);

      // Check that the result is enhanced with 3MF data
      expect(result.fileName).toBe('test.gcode.3mf');
      expect(result.is3mfFile).toBe(true);
      expect(result.threeMfMetadata).toBe(mockExtractionResult.metadata);
    });

    it('should preserve print cost from base parser when processing 3MF files', async () => {
      const { is3mfFile, extractGcodeFrom3mf, createVirtualGcodeFile, validateThreeMfMetadata } =
        await import('../../utils/3mfUtils');

      vi.mocked(is3mfFile).mockReturnValue(true);
      vi.mocked(validateThreeMfMetadata).mockReturnValue(true);

      const mockFile = new File(['3mf content'], 'test.gcode.3mf', { type: 'application/zip' });
      const mockVirtualFile = new File(['gcode content'], 'test.gcode', { type: 'text/plain' });

      const mockExtractionResult = {
        gcode: 'G1 X10 Y10',
        metadata: {
          filament_colors: ['#FF0000', '#00FF00'],
          filament_ids: [0, 1],
          first_extruder: 0,
          nozzle_diameter: 0.4,
          bed_type: 'textured',
          version: 2,
          is_seq_print: false,
          bbox_objects: [],
        },
        originalFileName: 'test.gcode.3mf',
      };

      const mockBaseStats: GcodeStats = {
        fileName: 'test.gcode',
        fileSize: 12,
        totalLayers: 10,
        totalHeight: 20,
        colors: [],
        toolChanges: [],
        layerColorMap: new Map(),
        colorUsageRanges: [],
        parserWarnings: [],
        parseTime: 100,
        printCost: 42.5, // Important: base parser found print cost
        filamentEstimates: [
          { colorId: 'T0', length: 1000, weight: 25.5 },
          { colorId: 'T1', length: 800, weight: 20.3 },
        ],
        filamentUsageStats: {
          total: 45.8,
          model: 40.2,
          support: 3.6,
          flushed: 2.0,
          tower: 0,
        },
      };

      vi.mocked(extractGcodeFrom3mf).mockResolvedValue(mockExtractionResult);
      vi.mocked(createVirtualGcodeFile).mockReturnValue(mockVirtualFile);
      vi.mocked(mockBaseParser.parse).mockResolvedValue(mockBaseStats);

      const result = await parser.parse(mockFile);

      // Check that print cost is preserved from base parser
      expect(result.printCost).toBe(42.5);
      expect(result.fileName).toBe('test.gcode.3mf');
      expect(result.is3mfFile).toBe(true);
    });

    it('should preserve all filament statistics from base parser', async () => {
      const { is3mfFile, extractGcodeFrom3mf, createVirtualGcodeFile, validateThreeMfMetadata } =
        await import('../../utils/3mfUtils');

      vi.mocked(is3mfFile).mockReturnValue(true);
      vi.mocked(validateThreeMfMetadata).mockReturnValue(true);

      const mockFile = new File(['3mf content'], 'test.gcode.3mf', { type: 'application/zip' });
      const mockVirtualFile = new File(['gcode content'], 'test.gcode', { type: 'text/plain' });

      const mockExtractionResult = {
        gcode: 'G1 X10 Y10',
        metadata: {
          filament_colors: ['#FF0000', '#00FF00'],
          filament_ids: [0, 1],
          first_extruder: 0,
          nozzle_diameter: 0.4,
          bed_type: 'textured',
          version: 2,
          is_seq_print: false,
          bbox_objects: [],
        },
        originalFileName: 'test.gcode.3mf',
      };

      const mockBaseStats: GcodeStats = {
        fileName: 'test.gcode',
        fileSize: 12,
        totalLayers: 10,
        totalHeight: 20,
        colors: [],
        toolChanges: [],
        layerColorMap: new Map(),
        colorUsageRanges: [],
        parserWarnings: [],
        parseTime: 100,
        printCost: 42.5,
        filamentEstimates: [
          { colorId: 'T0', length: 1000, weight: 25.5 },
          { colorId: 'T1', length: 800, weight: 20.3 },
        ],
        filamentUsageStats: {
          total: 45.8,
          model: 40.2,
          support: 3.6,
          flushed: 2.0,
          tower: 0,
        },
      };

      vi.mocked(extractGcodeFrom3mf).mockResolvedValue(mockExtractionResult);
      vi.mocked(createVirtualGcodeFile).mockReturnValue(mockVirtualFile);
      vi.mocked(mockBaseParser.parse).mockResolvedValue(mockBaseStats);

      const result = await parser.parse(mockFile);

      // Check that all filament statistics are preserved
      expect(result.filamentEstimates).toEqual(mockBaseStats.filamentEstimates);
      expect(result.filamentUsageStats).toEqual(mockBaseStats.filamentUsageStats);
      expect(result.printCost).toBe(mockBaseStats.printCost);
    });

    it('should fallback to base parser when 3MF extraction fails', async () => {
      const { is3mfFile, extractGcodeFrom3mf } = await import('../../utils/3mfUtils');

      vi.mocked(is3mfFile).mockReturnValue(true);
      vi.mocked(extractGcodeFrom3mf).mockRejectedValue(new Error('Extraction failed'));

      const mockFile = new File(['corrupted 3mf'], 'test.gcode.3mf', { type: 'application/zip' });
      const expectedStats: GcodeStats = {
        fileName: 'test.gcode.3mf',
        fileSize: 14,
        totalLayers: 5,
        totalHeight: 10,
        colors: [],
        toolChanges: [],
        layerColorMap: new Map(),
        colorUsageRanges: [],
        parserWarnings: [],
        parseTime: 50,
      };

      vi.mocked(mockBaseParser.parse).mockResolvedValue(expectedStats);

      const result = await parser.parse(mockFile);

      expect(extractGcodeFrom3mf).toHaveBeenCalledWith(mockFile);
      expect(mockBaseParser.parse).toHaveBeenCalledWith(mockFile);
      expect(result).toBe(expectedStats);
    });

    it('should throw error when both 3MF and fallback parsing fail', async () => {
      const { is3mfFile, extractGcodeFrom3mf } = await import('../../utils/3mfUtils');

      vi.mocked(is3mfFile).mockReturnValue(true);
      vi.mocked(extractGcodeFrom3mf).mockRejectedValue(new Error('3MF extraction failed'));
      vi.mocked(mockBaseParser.parse).mockRejectedValue(new Error('Base parser failed'));

      const mockFile = new File(['corrupted file'], 'test.gcode.3mf', { type: 'application/zip' });

      await expect(parser.parse(mockFile)).rejects.toThrow('Failed to parse file test.gcode.3mf');
    });
  });
});
