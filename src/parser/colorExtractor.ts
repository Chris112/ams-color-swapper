import { ColorInfo, ColorRange } from '../types';

export function extractColorInfo(
  colorFirstSeen: Map<string, number>,
  colorLastSeen: Map<string, number>,
  totalLayers: number,
  layerColorMap: Map<number, string>
): ColorInfo[] {
  const colors: ColorInfo[] = [];

  // Count layers per color
  const layerCounts = new Map<string, number>();
  for (const [_layer, color] of layerColorMap) {
    layerCounts.set(color, (layerCounts.get(color) || 0) + 1);
  }

  for (const [colorId, firstLayer] of colorFirstSeen) {
    const lastLayer = colorLastSeen.get(colorId) || firstLayer;
    const layerCount = layerCounts.get(colorId) || 0;

    colors.push({
      id: colorId,
      name: `Color ${parseInt(colorId.substring(1)) + 1}`,
      firstLayer,
      lastLayer,
      layerCount,
      usagePercentage: totalLayers > 0 ? (layerCount / totalLayers) * 100 : 0,
    });
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
  layerColorMap: Map<number, string>,
  totalLayers: number
): ColorRange[] {
  const ranges: ColorRange[] = [];
  let currentColor: string | null = null;
  let rangeStart = 0;

  // Process layers in order
  for (let layer = 0; layer <= totalLayers; layer++) {
    const color = layerColorMap.get(layer);

    if (color !== currentColor) {
      // End previous range
      if (currentColor !== null && layer > 0) {
        ranges.push({
          colorId: currentColor,
          startLayer: rangeStart,
          endLayer: layer - 1,
          continuous: true,
        });
      }

      // Start new range
      if (color) {
        currentColor = color;
        rangeStart = layer;
      }
    }
  }

  // Add final range
  if (currentColor !== null) {
    ranges.push({
      colorId: currentColor,
      startLayer: rangeStart,
      endLayer: totalLayers,
      continuous: true,
    });
  }

  return ranges;
}
