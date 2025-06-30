import { describe, it, expect, beforeEach } from 'vitest';
import { Color } from '../Color';

describe('Color', () => {
  describe('Constructor and Basic Properties', () => {
    it('should create a Color with all required properties', () => {
      const color = new Color({
        id: 'T0',
        name: 'Red PLA',
        hexValue: '#FF0000',
        firstLayer: 1,
        lastLayer: 100,
        layersUsed: new Set([1, 2, 3, 50, 100]),
        partialLayers: new Set([2, 3]),
        totalLayers: 150,
      });

      expect(color.id).toBe('T0');
      expect(color.name).toBe('Red PLA');
      expect(color.hexValue).toBe('#FF0000');
      expect(color.firstLayer).toBe(1);
      expect(color.lastLayer).toBe(100);
      expect(color.layersUsed).toEqual(new Set([1, 2, 3, 50, 100]));
      expect(color.partialLayers).toEqual(new Set([2, 3]));
      expect(color.usagePercentage).toBeCloseTo(3.33, 2); // 5 layers out of 150
    });

    it('should create a Color with minimal properties', () => {
      const color = new Color({
        id: 'T1',
        name: undefined,
        hexValue: undefined,
        firstLayer: 0,
        lastLayer: 0,
      });

      expect(color.id).toBe('T1');
      expect(color.name).toBeUndefined();
      expect(color.hexValue).toBeUndefined();
      expect(color.firstLayer).toBe(0);
      expect(color.lastLayer).toBe(0);
      expect(color.layersUsed).toEqual(new Set());
      expect(color.partialLayers).toEqual(new Set());
      expect(color.usagePercentage).toBe(0);
    });

    it('should calculate usage percentage correctly', () => {
      const color = new Color({
        id: 'T0',
        name: 'Test Color',
        hexValue: '#FF0000',
        firstLayer: 1,
        lastLayer: 10,
        layersUsed: new Set([1, 3, 5, 7, 9]), // 5 layers
        totalLayers: 50, // out of 50 total
      });

      expect(color.usagePercentage).toBe(10); // 5/50 * 100 = 10%
    });

    it('should handle zero total layers gracefully', () => {
      const color = new Color({
        id: 'T0',
        name: 'Test Color',
        hexValue: '#FF0000',
        firstLayer: 1,
        lastLayer: 10,
        layersUsed: new Set([1, 2, 3]),
        totalLayers: 0,
      });

      expect(color.usagePercentage).toBe(0);
    });
  });

  describe('Validation', () => {
    it('should throw error for missing ID', () => {
      expect(() => {
        new Color({
          id: '',
          name: 'Test',
          hexValue: '#FF0000',
          firstLayer: 1,
          lastLayer: 10,
        });
      }).toThrow('Color ID is required');
    });

    it('should throw error for negative first layer', () => {
      expect(() => {
        new Color({
          id: 'T0',
          name: 'Test',
          hexValue: '#FF0000',
          firstLayer: -1,
          lastLayer: 10,
        });
      }).toThrow('First layer must be non-negative');
    });

    it('should throw error when last layer is before first layer', () => {
      expect(() => {
        new Color({
          id: 'T0',
          name: 'Test',
          hexValue: '#FF0000',
          firstLayer: 10,
          lastLayer: 5,
        });
      }).toThrow('Last layer must be greater than or equal to first layer');
    });

    it('should throw error for invalid hex color format', () => {
      expect(() => {
        new Color({
          id: 'T0',
          name: 'Test',
          hexValue: 'invalid-color',
          firstLayer: 1,
          lastLayer: 10,
        });
      }).toThrow('Invalid hex color format');
    });

    it('should accept valid hex color formats', () => {
      const validColors = ['#FF0000', '#00ff00', '#0000FF', '#123ABC', '#abcdef'];

      validColors.forEach((hexValue) => {
        expect(() => {
          new Color({
            id: 'T0',
            name: 'Test',
            hexValue,
            firstLayer: 1,
            lastLayer: 10,
          });
        }).not.toThrow();
      });
    });

    it('should reject invalid hex color formats', () => {
      const invalidColors = ['FF0000', '#FF00', '#GGGGGG', 'red', '#FF00001', '#'];

      invalidColors.forEach((hexValue) => {
        expect(() => {
          new Color({
            id: 'T0',
            name: 'Test',
            hexValue,
            firstLayer: 1,
            lastLayer: 10,
          });
        }).toThrow('Invalid hex color format');
      });
    });
  });

  describe('Layer Usage Methods', () => {
    let color: Color;

    beforeEach(() => {
      color = new Color({
        id: 'T0',
        name: 'Test Color',
        hexValue: '#FF0000',
        firstLayer: 1,
        lastLayer: 100,
        layersUsed: new Set([1, 5, 10, 20, 50, 75, 100]),
        partialLayers: new Set([5, 20, 75]),
      });
    });

    describe('isUsedInLayer', () => {
      it('should return true for layers where color is used', () => {
        expect(color.isUsedInLayer(1)).toBe(true);
        expect(color.isUsedInLayer(10)).toBe(true);
        expect(color.isUsedInLayer(100)).toBe(true);
      });

      it('should return false for layers where color is not used', () => {
        expect(color.isUsedInLayer(2)).toBe(false);
        expect(color.isUsedInLayer(99)).toBe(false);
        expect(color.isUsedInLayer(200)).toBe(false);
      });
    });

    describe('isPartialInLayer', () => {
      it('should return true for partial layers', () => {
        expect(color.isPartialInLayer(5)).toBe(true);
        expect(color.isPartialInLayer(20)).toBe(true);
        expect(color.isPartialInLayer(75)).toBe(true);
      });

      it('should return false for non-partial layers', () => {
        expect(color.isPartialInLayer(1)).toBe(false);
        expect(color.isPartialInLayer(10)).toBe(false);
        expect(color.isPartialInLayer(2)).toBe(false); // Not used at all
      });
    });

    describe('isPrimaryInLayer', () => {
      it('should return true for primary layers (used but not partial)', () => {
        expect(color.isPrimaryInLayer(1)).toBe(true);
        expect(color.isPrimaryInLayer(10)).toBe(true);
        expect(color.isPrimaryInLayer(50)).toBe(true);
        expect(color.isPrimaryInLayer(100)).toBe(true);
      });

      it('should return false for partial layers', () => {
        expect(color.isPrimaryInLayer(5)).toBe(false);
        expect(color.isPrimaryInLayer(20)).toBe(false);
        expect(color.isPrimaryInLayer(75)).toBe(false);
      });

      it('should return false for unused layers', () => {
        expect(color.isPrimaryInLayer(2)).toBe(false);
        expect(color.isPrimaryInLayer(99)).toBe(false);
      });
    });

    describe('getLayerUsage', () => {
      it('should return "primary" for primary layers', () => {
        expect(color.getLayerUsage(1)).toBe('primary');
        expect(color.getLayerUsage(10)).toBe('primary');
        expect(color.getLayerUsage(50)).toBe('primary');
      });

      it('should return "partial" for partial layers', () => {
        expect(color.getLayerUsage(5)).toBe('partial');
        expect(color.getLayerUsage(20)).toBe('partial');
        expect(color.getLayerUsage(75)).toBe('partial');
      });

      it('should return "none" for unused layers', () => {
        expect(color.getLayerUsage(2)).toBe('none');
        expect(color.getLayerUsage(99)).toBe('none');
        expect(color.getLayerUsage(200)).toBe('none');
      });
    });
  });

  describe('Color Overlap Detection', () => {
    it('should detect overlapping colors', () => {
      const color1 = new Color({
        id: 'T0',
        name: 'Color 1',
        hexValue: '#FF0000',
        firstLayer: 1,
        lastLayer: 50,
        layersUsed: new Set([1, 10, 20, 30, 40, 50]),
      });

      const color2 = new Color({
        id: 'T1',
        name: 'Color 2',
        hexValue: '#00FF00',
        firstLayer: 25,
        lastLayer: 75,
        layersUsed: new Set([25, 30, 35, 40, 45, 50, 60, 70]),
      });

      expect(color1.overlapsWith(color2)).toBe(true);
      expect(color2.overlapsWith(color1)).toBe(true);
    });

    it('should detect non-overlapping colors', () => {
      const color1 = new Color({
        id: 'T0',
        name: 'Color 1',
        hexValue: '#FF0000',
        firstLayer: 1,
        lastLayer: 50,
        layersUsed: new Set([1, 10, 20, 30, 40, 50]),
      });

      const color2 = new Color({
        id: 'T1',
        name: 'Color 2',
        hexValue: '#00FF00',
        firstLayer: 60,
        lastLayer: 100,
        layersUsed: new Set([60, 70, 80, 90, 100]),
      });

      expect(color1.overlapsWith(color2)).toBe(false);
      expect(color2.overlapsWith(color1)).toBe(false);
    });

    it('should handle edge case overlaps', () => {
      const color1 = new Color({
        id: 'T0',
        name: 'Color 1',
        hexValue: '#FF0000',
        firstLayer: 1,
        lastLayer: 50,
        layersUsed: new Set([50]),
      });

      const color2 = new Color({
        id: 'T1',
        name: 'Color 2',
        hexValue: '#00FF00',
        firstLayer: 50,
        lastLayer: 100,
        layersUsed: new Set([50]),
      });

      expect(color1.overlapsWith(color2)).toBe(true);
    });
  });

  describe('Display Name', () => {
    it('should use name if available', () => {
      const color = new Color({
        id: 'T0',
        name: 'Red PLA',
        hexValue: '#FF0000',
        firstLayer: 1,
        lastLayer: 10,
      });

      expect(color.displayName).toBe('Red PLA');
    });

    it('should fall back to hexValue if name is not available', () => {
      const color = new Color({
        id: 'T0',
        name: undefined,
        hexValue: '#FF0000',
        firstLayer: 1,
        lastLayer: 10,
      });

      expect(color.displayName).toBe('#FF0000');
    });

    it('should fall back to id if neither name nor hexValue is available', () => {
      const color = new Color({
        id: 'T0',
        name: undefined,
        hexValue: undefined,
        firstLayer: 1,
        lastLayer: 10,
      });

      expect(color.displayName).toBe('T0');
    });
  });

  describe('Computed Properties', () => {
    it('should calculate layerCount correctly', () => {
      const color = new Color({
        id: 'T0',
        name: 'Test',
        hexValue: '#FF0000',
        firstLayer: 1,
        lastLayer: 100,
        layersUsed: new Set([1, 5, 10, 50, 100]),
      });

      expect(color.layerCount).toBe(5);
    });

    it('should calculate partialLayerCount correctly', () => {
      const color = new Color({
        id: 'T0',
        name: 'Test',
        hexValue: '#FF0000',
        firstLayer: 1,
        lastLayer: 100,
        layersUsed: new Set([1, 5, 10, 50, 100]),
        partialLayers: new Set([5, 50]),
      });

      expect(color.partialLayerCount).toBe(2);
    });
  });

  describe('Static Factory Methods', () => {
    it('should create Color from data using fromData', () => {
      const data = {
        id: 'T0',
        name: 'Red PLA',
        hexColor: '#FF0000',
        firstLayer: 1,
        lastLayer: 100,
        layersUsed: [1, 5, 10, 50, 100],
        partialLayers: [5, 50],
        totalLayers: 150,
      };

      const color = Color.fromData(data);

      expect(color.id).toBe('T0');
      expect(color.name).toBe('Red PLA');
      expect(color.hexValue).toBe('#FF0000');
      expect(color.firstLayer).toBe(1);
      expect(color.lastLayer).toBe(100);
      expect(color.layersUsed).toEqual(new Set([1, 5, 10, 50, 100]));
      expect(color.partialLayers).toEqual(new Set([5, 50]));
    });

    it('should handle optional fields in fromData', () => {
      const data = {
        id: 'T1',
        firstLayer: 0,
        lastLayer: 0,
      };

      const color = Color.fromData(data);

      expect(color.id).toBe('T1');
      expect(color.name).toBeUndefined();
      expect(color.hexValue).toBeUndefined();
      expect(color.layersUsed).toEqual(new Set());
      expect(color.partialLayers).toEqual(new Set());
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const color = new Color({
        id: 'T0',
        name: 'Red PLA',
        hexValue: '#FF0000',
        firstLayer: 1,
        lastLayer: 100,
        layersUsed: new Set([1, 5, 10, 50, 100]),
        partialLayers: new Set([5, 50]),
        totalLayers: 150,
      });

      const json = color.toJSON();

      expect(json).toEqual({
        id: 'T0',
        name: 'Red PLA',
        hexColor: '#FF0000',
        firstLayer: 1,
        lastLayer: 100,
        layerCount: 5,
        partialLayerCount: 2,
        usagePercentage: color.usagePercentage,
        layersUsed: [1, 5, 10, 50, 100],
        partialLayers: [5, 50],
      });
    });

    it('should handle undefined optional fields in serialization', () => {
      const color = new Color({
        id: 'T0',
        name: undefined,
        hexValue: undefined,
        firstLayer: 1,
        lastLayer: 10,
      });

      const json = color.toJSON();

      expect(json.name).toBeUndefined();
      expect(json.hexColor).toBeUndefined();
      expect(json.layersUsed).toEqual([]);
      expect(json.partialLayers).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle same first and last layer', () => {
      const color = new Color({
        id: 'T0',
        name: 'Single Layer',
        hexValue: '#FF0000',
        firstLayer: 5,
        lastLayer: 5,
        layersUsed: new Set([5]),
      });

      expect(color.firstLayer).toBe(5);
      expect(color.lastLayer).toBe(5);
      expect(color.isUsedInLayer(5)).toBe(true);
      expect(color.layerCount).toBe(1);
    });

    it('should handle empty layer sets', () => {
      const color = new Color({
        id: 'T0',
        name: 'Empty',
        hexValue: '#FF0000',
        firstLayer: 1,
        lastLayer: 100,
        layersUsed: new Set(),
        partialLayers: new Set(),
      });

      expect(color.layerCount).toBe(0);
      expect(color.partialLayerCount).toBe(0);
      expect(color.isUsedInLayer(50)).toBe(false);
      expect(color.getLayerUsage(50)).toBe('none');
    });

    it('should handle large layer numbers', () => {
      const color = new Color({
        id: 'T0',
        name: 'Large',
        hexValue: '#FF0000',
        firstLayer: 1000000,
        lastLayer: 2000000,
        layersUsed: new Set([1000000, 1500000, 2000000]),
      });

      expect(color.firstLayer).toBe(1000000);
      expect(color.lastLayer).toBe(2000000);
      expect(color.isUsedInLayer(1500000)).toBe(true);
      expect(color.layerCount).toBe(3);
    });
  });
});
