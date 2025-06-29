import { describe, it, expect, beforeEach } from 'vitest';
import { ColorMergeService } from '../ColorMergeService';
import { Color } from '../../domain/models/Color';
import { GcodeStats } from '../../types/gcode';

describe('ColorMergeService', () => {
  let service: ColorMergeService;
  let mockStats: GcodeStats;

  beforeEach(() => {
    service = new ColorMergeService();

    // Create mock stats with test data
    mockStats = {
      fileName: 'test.gcode',
      fileSize: 1000000,
      totalLayers: 100,
      totalHeight: 20,
      slicerInfo: {
        software: 'OrcaSlicer',
        version: '2.0.0',
      },
      colors: [
        new Color({
          id: 'T0',
          name: 'Red',
          hexValue: '#FF0000',
          firstLayer: 0,
          lastLayer: 50,
          layersUsed: new Set([0, 10, 20, 30, 40, 50]),
          partialLayers: new Set(),
          totalLayers: 100,
        }),
        new Color({
          id: 'T1',
          name: 'Pink',
          hexValue: '#FF69B4',
          firstLayer: 20,
          lastLayer: 80,
          layersUsed: new Set([20, 30, 40, 50, 60, 70, 80]),
          partialLayers: new Set(),
          totalLayers: 100,
        }),
        new Color({
          id: 'T2',
          name: 'Blue',
          hexValue: '#0000FF',
          firstLayer: 60,
          lastLayer: 90,
          layersUsed: new Set([60, 70, 80, 90]),
          partialLayers: new Set(),
          totalLayers: 100,
        }),
      ],
      toolChanges: [
        { layer: 10, fromTool: 'T0', toTool: 'T1', lineNumber: 100 },
        { layer: 30, fromTool: 'T1', toTool: 'T0', lineNumber: 300 },
        { layer: 60, fromTool: 'T0', toTool: 'T2', lineNumber: 600 },
      ],
      layerColorMap: new Map([
        [0, ['T0']],
        [10, ['T0']],
        [20, ['T0', 'T1']],
        [30, ['T0', 'T1']],
        [40, ['T0', 'T1']],
        [50, ['T0', 'T1']],
        [60, ['T1', 'T2']],
        [70, ['T1', 'T2']],
        [80, ['T1', 'T2']],
        [90, ['T2']],
      ]),
      colorUsageRanges: [
        { colorId: 'T0', startLayer: 0, endLayer: 50, continuous: true },
        { colorId: 'T1', startLayer: 20, endLayer: 80, continuous: true },
        { colorId: 'T2', startLayer: 60, endLayer: 90, continuous: true },
      ],
      parserWarnings: [],
      parseTime: 100,
    };
  });

  describe('previewMerge', () => {
    it('should preview merge of two colors', () => {
      const preview = service.previewMerge(mockStats, 'T0', ['T1']);

      expect(preview).toBeTruthy();
      expect(preview!.targetColor.id).toBe('T0');
      expect(preview!.sourceColors.length).toBe(1);
      expect(preview!.sourceColors[0].id).toBe('T1');
      expect(preview!.affectedLayers).toContain(20);
      expect(preview!.affectedLayers).toContain(30);
      expect(preview!.freedSlots).toEqual(['T1']);
      expect(preview!.newColorCount).toBe(2); // 3 colors - 1 merged
    });

    it('should return null for invalid color IDs', () => {
      const preview = service.previewMerge(mockStats, 'T99', ['T1']);
      expect(preview).toBeNull();
    });
  });

  describe('mergeColors', () => {
    it('should merge T1 into T0', () => {
      const result = service.mergeColors(mockStats, 'T0', ['T1']);

      expect(result).toBeTruthy();
      expect(result!.mergedStats.colors.length).toBe(2); // T0 and T2 remain
      expect(result!.mergedStats.colors.find((c) => c.id === 'T1')).toBeUndefined();

      // Check that T0 has absorbed T1's layers
      const mergedColor = result!.mergedStats.colors.find((c) => c.id === 'T0');
      expect(mergedColor).toBeTruthy();
      expect(mergedColor!.firstLayer).toBe(0);
      expect(mergedColor!.lastLayer).toBe(80); // Extended to include T1's range

      // Check layer color map updates
      expect(result!.mergedStats.layerColorMap.get(60)).toEqual(['T0', 'T2']);
      expect(result!.mergedStats.layerColorMap.get(70)).toEqual(['T0', 'T2']);
    });

    it('should update tool changes when merging', () => {
      const result = service.mergeColors(mockStats, 'T0', ['T1']);

      // T1 tool changes should now reference T0
      const toolChanges = result!.mergedStats.toolChanges;
      expect(toolChanges.find((tc) => tc.fromTool === 'T1')).toBeUndefined();
      expect(toolChanges.find((tc) => tc.toTool === 'T1')).toBeUndefined();
    });

    it('should merge color usage ranges', () => {
      const result = service.mergeColors(mockStats, 'T0', ['T1']);

      // Should have merged T1's range into T0
      const t0Ranges = result!.mergedStats.colorUsageRanges.filter((r) => r.colorId === 'T0');
      expect(t0Ranges.length).toBe(1);
      expect(t0Ranges[0].startLayer).toBe(0);
      expect(t0Ranges[0].endLayer).toBe(80);
    });

    it('should track merge history', () => {
      const result = service.mergeColors(mockStats, 'T0', ['T1']);

      expect(result!.mergeHistory.targetColorId).toBe('T0');
      expect(result!.mergeHistory.sourceColorIds).toEqual(['T1']);
      expect(result!.mergeHistory.freedSlots).toEqual(['T1']);
      expect(result!.mergeHistory.affectedLayers.length).toBeGreaterThan(0);
    });
  });

  describe('mergeOverlappingRanges', () => {
    it('should merge overlapping ranges', () => {
      const ranges = [
        { start: 0, end: 20 },
        { start: 15, end: 30 },
        { start: 40, end: 50 },
        { start: 45, end: 60 },
      ];

      const merged = service.mergeOverlappingRanges(ranges);

      expect(merged).toEqual([
        { start: 0, end: 30 },
        { start: 40, end: 60 },
      ]);
    });

    it('should merge adjacent ranges', () => {
      const ranges = [
        { start: 0, end: 20 },
        { start: 21, end: 30 },
        { start: 31, end: 40 },
      ];

      const merged = service.mergeOverlappingRanges(ranges);

      expect(merged).toEqual([{ start: 0, end: 40 }]);
    });
  });

  describe('getMergeHistory', () => {
    it('should return merge history', () => {
      service.mergeColors(mockStats, 'T0', ['T1']);
      const history = service.getMergeHistory();

      expect(history.length).toBe(1);
      expect(history[0].targetColorId).toBe('T0');
      expect(history[0].sourceColorIds).toEqual(['T1']);
    });
  });

  describe('clearHistory', () => {
    it('should clear merge history', () => {
      service.mergeColors(mockStats, 'T0', ['T1']);
      service.clearHistory();
      const history = service.getMergeHistory();

      expect(history.length).toBe(0);
    });
  });
});
