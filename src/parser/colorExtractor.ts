import { ColorInfo, ColorRange } from '../types';

export function extractColorInfo(
  colorFirstSeen: Map<string, number>,
  colorLastSeen: Map<string, number>,
  totalLayers: number,
  layerColorMap?: Map<number, string>
): ColorInfo[] {
  const colors: ColorInfo[] = [];

  // If we have a layer-by-layer map, use it for accurate counting
  if (layerColorMap) {
    const colorLayerCounts = new Map<string, Set<number>>();
    
    // Count actual layers where each color is used
    for (const [layer, tool] of layerColorMap.entries()) {
      if (!colorLayerCounts.has(tool)) {
        colorLayerCounts.set(tool, new Set());
      }
      colorLayerCounts.get(tool)!.add(layer);
    }
    
    // Build color info from actual usage
    for (const [toolId, layers] of colorLayerCounts.entries()) {
      const layerArray = Array.from(layers).sort((a, b) => a - b);
      const firstLayer = layerArray[0];
      const lastLayer = layerArray[layerArray.length - 1];
      
      colors.push({
        id: toolId,
        name: getColorName(toolId),
        hexColor: getColorHex(toolId),
        firstLayer,
        lastLayer,
        layerCount: layers.size,
        usagePercentage: (layers.size / Math.max(totalLayers, 1)) * 100
      });
    }
  } else {
    // Fallback to old method
    for (const [toolId, firstLayer] of colorFirstSeen.entries()) {
      const lastLayer = colorLastSeen.get(toolId) || firstLayer;
      const layerCount = lastLayer - firstLayer + 1;
      
      colors.push({
        id: toolId,
        name: getColorName(toolId),
        hexColor: getColorHex(toolId),
        firstLayer,
        lastLayer,
        layerCount,
        usagePercentage: (layerCount / Math.max(totalLayers, 1)) * 100
      });
    }
  }

  return colors.sort((a, b) => {
    const toolA = parseInt(a.id.substring(1));
    const toolB = parseInt(b.id.substring(1));
    return toolA - toolB;
  });
}

export function extractColorRanges(
  layerColorMap: Map<number, string>,
  totalLayers: number
): ColorRange[] {
  const ranges: ColorRange[] = [];
  let currentColor: string | null = null;
  let rangeStart = 0;

  for (let layer = 0; layer <= totalLayers; layer++) {
    const color = layerColorMap.get(layer) || null;
    
    if (color !== currentColor) {
      if (currentColor !== null && layer > 0) {
        ranges.push({
          colorId: currentColor,
          startLayer: rangeStart,
          endLayer: layer - 1,
          continuous: true
        });
      }
      
      if (color !== null) {
        currentColor = color;
        rangeStart = layer;
      }
    }
  }

  if (currentColor !== null) {
    ranges.push({
      colorId: currentColor,
      startLayer: rangeStart,
      endLayer: totalLayers,
      continuous: true
    });
  }

  return ranges;
}

function getColorName(toolId: string): string {
  const colorNames: { [key: string]: string } = {
    'T0': 'Color 1',
    'T1': 'Color 2',
    'T2': 'Color 3',
    'T3': 'Color 4',
    'T4': 'Color 5',
    'T5': 'Color 6',
    'T6': 'Color 7',
    'T7': 'Color 8'
  };
  
  return colorNames[toolId] || `Color ${toolId}`;
}

function getColorHex(toolId: string): string {
  const colorHexes: { [key: string]: string } = {
    'T0': '#E74C3C',
    'T1': '#3498DB', 
    'T2': '#2ECC71',
    'T3': '#F39C12',
    'T4': '#9B59B6',
    'T5': '#1ABC9C',
    'T6': '#34495E',
    'T7': '#E67E22'
  };
  
  return colorHexes[toolId] || '#95A5A6';
}