import { ColorRange, LayerColorInfo } from '../types';
import { Color } from '../domain/models/Color';

export function extractColorInfo(
  colorFirstSeen: Map<string, number>,
  colorLastSeen: Map<string, number>,
  totalLayers: number,
  layerColorMap: Map<number, string[]>,
  layerDetails?: LayerColorInfo[]
): Color[] {
  const colors: Color[] = [];

  // Build layer usage information for each color
  const colorLayersUsed = new Map<string, Set<number>>();
  const colorPartialLayers = new Map<string, Set<number>>();

  for (const [layer, colorsInLayer] of layerColorMap) {
    for (const color of colorsInLayer) {
      // Add to layers used
      if (!colorLayersUsed.has(color)) {
        colorLayersUsed.set(color, new Set());
      }
      colorLayersUsed.get(color)!.add(layer);

      // If this layer has multiple colors, track partial usage
      if (colorsInLayer.length > 1 && layerDetails) {
        const layerInfo = layerDetails.find((ld) => ld.layer === layer);
        if (layerInfo && layerInfo.primaryColor !== color) {
          if (!colorPartialLayers.has(color)) {
            colorPartialLayers.set(color, new Set());
          }
          colorPartialLayers.get(color)!.add(layer);
        }
      }
    }
  }

  for (const [colorId, firstLayer] of colorFirstSeen) {
    const lastLayer = colorLastSeen.get(colorId) || firstLayer;
    const layersUsed = colorLayersUsed.get(colorId) || new Set();
    const partialLayers = colorPartialLayers.get(colorId) || new Set();

    colors.push(new Color({
      id: colorId,
      name: `Color ${parseInt(colorId.substring(1)) + 1}`,
      hexValue: undefined, // Will be set later by statistics
      firstLayer,
      lastLayer,
      layersUsed,
      partialLayers,
      totalLayers,
    }));
  }

  // Sort by tool number
  colors.sort((a, b) => {
    const toolA = parseInt(a.id.substring(1));
    const toolB = parseInt(b.id.substring(1));
    return toolA - toolB;
  });

  return colors;
}

export function extractColorRanges(
  layerColorMap: Map<number, string[]>,
  totalLayers: number
): ColorRange[] {
  const ranges: ColorRange[] = [];
  const colorRangeTracker = new Map<string, { start: number; end: number; continuous: boolean }>();

  // Process layers in order to build ranges for each color
  for (let layer = 0; layer <= totalLayers; layer++) {
    const colors = layerColorMap.get(layer) || [];

    // Update active colors
    const activeColors = new Set(colors);

    // End ranges for colors no longer active
    for (const [colorId, range] of colorRangeTracker) {
      if (!activeColors.has(colorId)) {
        ranges.push({
          colorId,
          startLayer: range.start,
          endLayer: layer - 1,
          continuous: range.continuous,
        });
        colorRangeTracker.delete(colorId);
      }
    }

    // Start or continue ranges for active colors
    for (const color of colors) {
      if (!colorRangeTracker.has(color)) {
        colorRangeTracker.set(color, {
          start: layer,
          end: layer,
          continuous: true,
        });
      } else {
        const range = colorRangeTracker.get(color)!;
        range.end = layer;
        // Check if continuous (no gaps)
        if (layer > range.end + 1) {
          range.continuous = false;
        }
      }
    }
  }

  // Add final ranges for any remaining colors
  for (const [colorId, range] of colorRangeTracker) {
    ranges.push({
      colorId,
      startLayer: range.start,
      endLayer: totalLayers,
      continuous: range.continuous,
    });
  }

  return ranges;
}
