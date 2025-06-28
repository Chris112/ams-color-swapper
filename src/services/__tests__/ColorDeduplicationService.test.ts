import { describe, it, expect } from 'vitest';
import { ColorDeduplicationService } from '../ColorDeduplicationService';
import { Color } from '../../domain/models/Color';
import { ToolChange } from '../../types';

describe('ColorDeduplicationService', () => {
  const service = new ColorDeduplicationService();

  describe('deduplicateColors', () => {
    it('should combine colors with identical hex codes', () => {
      const colors = [
        new Color({
          id: 'T0',
          name: 'Red',
          hexValue: '#FF0000',
          firstLayer: 0,
          lastLayer: 10,
          layersUsed: new Set([0, 1, 2, 3, 4, 5]),
          totalLayers: 100,
        }),
        new Color({
          id: 'T1',
          name: 'Blue',
          hexValue: '#0000FF',
          firstLayer: 5,
          lastLayer: 15,
          layersUsed: new Set([5, 6, 7, 8, 9, 10]),
          totalLayers: 100,
        }),
        new Color({
          id: 'T2',
          name: 'Red Again',
          hexValue: '#FF0000', // Duplicate!
          firstLayer: 20,
          lastLayer: 30,
          layersUsed: new Set([20, 21, 22, 23, 24, 25]),
          totalLayers: 100,
        }),
        new Color({
          id: 'T3',
          name: 'Green',
          hexValue: '#00FF00',
          firstLayer: 15,
          lastLayer: 25,
          layersUsed: new Set([15, 16, 17, 18, 19, 20]),
          totalLayers: 100,
        }),
      ];

      const result = service.deduplicateColors(colors);

      // Should have 3 colors after deduplication
      expect(result.deduplicatedColors).toHaveLength(3);

      // T0 should contain combined usage from T0 and T2
      const redColor = result.deduplicatedColors.find((c) => c.hexValue === '#FF0000');
      expect(redColor).toBeDefined();
      expect(redColor!.id).toBe('T0');
      expect(redColor!.firstLayer).toBe(0); // Min of 0 and 20
      expect(redColor!.lastLayer).toBe(30); // Max of 10 and 30
      expect(redColor!.layersUsed.size).toBe(12); // Combined layers

      // Should have correct color mapping
      expect(result.colorMapping.get('T2')).toBe('T0');

      // Should have freed T2
      expect(result.freedSlots).toContain('T2');
      expect(result.freedSlots).toHaveLength(1);

      // Should have duplicate info
      expect(result.duplicatesFound).toHaveLength(1);
      expect(result.duplicatesFound[0].hexCode).toBe('#FF0000');
      expect(result.duplicatesFound[0].originalTools).toEqual(['T0', 'T2']);
      expect(result.duplicatesFound[0].assignedTo).toBe('T0');
    });

    it('should handle multiple duplicates of the same color', () => {
      const colors = [
        new Color({
          id: 'T0',
          name: 'Black',
          hexValue: '#000000',
          firstLayer: 0,
          lastLayer: 5,
          layersUsed: new Set([0, 1, 2]),
          totalLayers: 100,
        }),
        new Color({
          id: 'T1',
          name: 'Black Copy 1',
          hexValue: '#000000',
          firstLayer: 10,
          lastLayer: 15,
          layersUsed: new Set([10, 11, 12]),
          totalLayers: 100,
        }),
        new Color({
          id: 'T2',
          name: 'Black Copy 2',
          hexValue: '#000000',
          firstLayer: 20,
          lastLayer: 25,
          layersUsed: new Set([20, 21, 22]),
          totalLayers: 100,
        }),
      ];

      const result = service.deduplicateColors(colors);

      // Should have 1 color after deduplication
      expect(result.deduplicatedColors).toHaveLength(1);

      // All should map to T0
      const blackColor = result.deduplicatedColors[0];
      expect(blackColor.id).toBe('T0');
      expect(blackColor.layersUsed.size).toBe(9); // All layers combined

      // Mappings
      expect(result.colorMapping.get('T1')).toBe('T0');
      expect(result.colorMapping.get('T2')).toBe('T0');

      // Freed slots
      expect(result.freedSlots).toContain('T1');
      expect(result.freedSlots).toContain('T2');
      expect(result.freedSlots).toHaveLength(2);
    });

    it('should preserve colors without hex values', () => {
      const colors = [
        new Color({
          id: 'T0',
          name: 'Unknown Color',
          hexValue: undefined,
          firstLayer: 0,
          lastLayer: 10,
          layersUsed: new Set([0, 1, 2]),
          totalLayers: 100,
        }),
        new Color({
          id: 'T1',
          name: 'Red',
          hexValue: '#FF0000',
          firstLayer: 5,
          lastLayer: 15,
          layersUsed: new Set([5, 6, 7]),
          totalLayers: 100,
        }),
      ];

      const result = service.deduplicateColors(colors);

      // Both colors should be preserved
      expect(result.deduplicatedColors).toHaveLength(2);
      expect(result.freedSlots).toHaveLength(0);
      expect(result.duplicatesFound).toHaveLength(0);
    });
  });

  describe('updateToolChanges', () => {
    it('should update tool changes based on color mapping', () => {
      const toolChanges: ToolChange[] = [
        { layer: 5, fromTool: 'T0', toTool: 'T1', lineNumber: 100, zHeight: 1.0 },
        { layer: 10, fromTool: 'T1', toTool: 'T2', lineNumber: 200, zHeight: 2.0 }, // T2 mapped to T0
        { layer: 15, fromTool: 'T2', toTool: 'T1', lineNumber: 300, zHeight: 3.0 }, // T2 mapped to T0
        { layer: 20, fromTool: 'T1', toTool: 'T2', lineNumber: 400, zHeight: 4.0 }, // T2 mapped to T0
      ];

      const colorMapping = new Map([['T2', 'T0']]);

      const updated = service.updateToolChanges(toolChanges, colorMapping);

      expect(updated[0].toTool).toBe('T1');
      expect(updated[1].toTool).toBe('T0'); // Was T2
      expect(updated[2].fromTool).toBe('T0'); // Was T2
      expect(updated[3].toTool).toBe('T0'); // Was T2
    });
  });

  describe('updateLayerColorMap', () => {
    it('should update layer color map and remove duplicates within layers', () => {
      const layerColorMap = new Map<number, string[]>([
        [0, ['T0', 'T1', 'T2']], // T2 will map to T0
        [5, ['T1', 'T2', 'T3']], // T2 will map to T0
        [10, ['T0', 'T2']], // T2 will map to T0, resulting in duplicate T0
      ]);

      const colorMapping = new Map([['T2', 'T0']]);

      const updated = service.updateLayerColorMap(layerColorMap, colorMapping);

      expect(updated.get(0)).toEqual(['T0', 'T1']); // T2 became T0, duplicate removed
      expect(updated.get(5)).toEqual(['T1', 'T0', 'T3']); // T2 became T0
      expect(updated.get(10)).toEqual(['T0']); // Both were T0, duplicate removed
    });
  });

  describe('combined color naming', () => {
    it('should use enhanced name when deduplicating colors', () => {
      const colors = [
        new Color({
          id: 'T0',
          name: 'Color 1',
          hexValue: '#FF0000',
          firstLayer: 0,
          lastLayer: 10,
          layersUsed: new Set([0, 1, 2]),
          totalLayers: 100,
        }),
        new Color({
          id: 'T1',
          name: 'Prusament Lipstick Red', // Enhanced name
          hexValue: '#FF0000',
          firstLayer: 20,
          lastLayer: 30,
          layersUsed: new Set([20, 21, 22]),
          totalLayers: 100,
        }),
      ];

      const result = service.deduplicateColors(colors);

      // Should use the enhanced name
      const redColor = result.deduplicatedColors.find((c) => c.hexValue === '#FF0000');
      expect(redColor!.name).toBe('Prusament Lipstick Red');
    });

    it('should use first name when all names are the same', () => {
      const colors = [
        new Color({
          id: 'T0',
          name: 'Red',
          hexValue: '#FF0000',
          firstLayer: 0,
          lastLayer: 10,
          layersUsed: new Set([0, 1, 2]),
          totalLayers: 100,
        }),
        new Color({
          id: 'T1',
          name: 'Red',
          hexValue: '#FF0000',
          firstLayer: 20,
          lastLayer: 30,
          layersUsed: new Set([20, 21, 22]),
          totalLayers: 100,
        }),
      ];

      const result = service.deduplicateColors(colors);

      const redColor = result.deduplicatedColors.find((c) => c.hexValue === '#FF0000');
      expect(redColor!.name).toBe('Red');
    });
  });
});
