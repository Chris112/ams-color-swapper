import { describe, it, expect } from 'vitest';
import { colorStatsTemplate } from '../index';
import { Color } from '../../../domain/models/Color';
import { FilamentUsage } from '../../../types/gcode';

describe('Progress Bar Percentage Calculation', () => {
  it('should calculate correct weight-based percentages for progress bars', () => {
    // Create test colors (like from 3MF file)
    const colors = [
      new Color({
        id: 'T0',
        name: 'Color 1',
        hexValue: '#D3B7A7',
        firstLayer: 1,
        lastLayer: 50,
        layersUsed: new Set([1, 2, 3, 4, 5]),
        totalLayers: 100,
      }),
      new Color({
        id: 'T5',
        name: 'Color 6',
        hexValue: '#161616',
        firstLayer: 51,
        lastLayer: 100,
        layersUsed: new Set([51, 52, 53, 54, 55, 56, 57, 58, 59, 60]),
        totalLayers: 100,
      }),
    ];

    // Create filament estimates (like from 3MF parsing)
    const filamentEstimates: FilamentUsage[] = [
      { colorId: 'T0', length: 729.6, weight: 2.32 },
      { colorId: 'T5', length: 1256.5, weight: 3.75 },
    ];

    // Generate the template
    const html = colorStatsTemplate(colors, filamentEstimates);

    // Total weight: 2.32 + 3.75 = 6.07g
    // T0 percentage: (2.32 / 6.07) * 100 = 38.2%
    // T5 percentage: (3.75 / 6.07) * 100 = 61.8%

    // Check that progress bars show weight-based percentages, not layer-based
    expect(html).toContain('width: 38.22075782537067%'); // T0 weight percentage (precise)
    expect(html).toContain('width: 61.779242174629324%'); // T5 weight percentage (precise)
    expect(html).toContain('38.2%'); // T0 percentage text (rounded)
    expect(html).toContain('61.8%'); // T5 percentage text (rounded)

    // Verify it's NOT using layer-based percentages
    // T0 has 5 layers out of 100 = 5%
    // T5 has 10 layers out of 100 = 10%
    expect(html).not.toContain('width: 5.0%'); // Should NOT show layer percentage
    expect(html).not.toContain('width: 10.0%'); // Should NOT show layer percentage
  });

  it('should handle zero total weight gracefully', () => {
    const colors = [
      new Color({
        id: 'T0',
        name: 'Color 1',
        hexValue: '#D3B7A7',
        firstLayer: 1,
        lastLayer: 50,
        layersUsed: new Set([1, 2, 3]),
        totalLayers: 100,
      }),
    ];

    // No filament estimates (empty array)
    const filamentEstimates: FilamentUsage[] = [];

    const html = colorStatsTemplate(colors, filamentEstimates);

    // Should show 0% when no weight data
    expect(html).toContain('width: 0%');
    expect(html).toContain('0.0%');
  });

  it('should handle undefined filament estimates', () => {
    const colors = [
      new Color({
        id: 'T0',
        name: 'Color 1',
        hexValue: '#D3B7A7',
        firstLayer: 1,
        lastLayer: 50,
        layersUsed: new Set([1, 2, 3]),
        totalLayers: 100,
      }),
    ];

    // Undefined filament estimates
    const html = colorStatsTemplate(colors, undefined);

    // Should show 0% when no weight data
    expect(html).toContain('width: 0%');
    expect(html).toContain('0.0%');
  });
});
