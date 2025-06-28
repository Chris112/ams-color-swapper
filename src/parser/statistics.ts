import { GcodeStats, ToolChange, LayerColorInfo } from '../types';
import { Color } from '../domain/models/Color';
import { extractColorInfo, extractColorRanges } from './colorExtractor';
import { getColorName } from '../utils/colorNames';

export async function calculateStatistics(
  partialStats: GcodeStats,
  toolChanges: ToolChange[],
  layerColorMap: Map<number, string[]>,
  colorFirstSeen: Map<string, number>,
  colorLastSeen: Map<string, number>,
  layerDetails: LayerColorInfo[],
  parseTime: number
): Promise<GcodeStats> {
  // Calculate totalLayers from layerColorMap, but use partialStats if it's greater than 1
  const layerKeys = Array.from(layerColorMap.keys()).filter(
    (key) => !isNaN(key) && key !== null && key !== undefined
  );
  const maxLayerFromMap = layerKeys.length > 0 ? Math.max(...layerKeys) : 0;
  const calculatedLayers = maxLayerFromMap + 1;

  const totalLayers =
    partialStats.totalLayers && partialStats.totalLayers > 1 && !isNaN(partialStats.totalLayers)
      ? Math.max(partialStats.totalLayers, calculatedLayers)
      : calculatedLayers;

  let colors = extractColorInfo(
    colorFirstSeen,
    colorLastSeen,
    totalLayers,
    layerColorMap,
    layerDetails
  );

  // For Bambu Lab printers, enhance colors with hex values
  if (partialStats.slicerInfo?.colorDefinitions) {
    const definedColorCount = partialStats.slicerInfo.colorDefinitions.length;
    const usedTools = new Set(colors.map((c) => c.id));

    // Add missing colors that were defined but not used
    for (let i = 0; i < definedColorCount; i++) {
      const toolId = `T${i}`;
      if (!usedTools.has(toolId)) {
        colors.push(new Color({
          id: toolId,
          name: `Color ${i + 1} (Unused)`,
          hexValue: partialStats.slicerInfo.colorDefinitions[i],
          firstLayer: -1,
          lastLayer: -1,
          layersUsed: new Set(),
          partialLayers: new Set(),
          totalLayers,
        }));
      }
    }

    // Create new Color objects with hex values
    colors = colors.map((color) => {
      const index = parseInt(color.id.substring(1));
      let hexValue = color.hexValue;
      let name = color.name;
      
      if (index < definedColorCount) {
        hexValue = partialStats.slicerInfo!.colorDefinitions![index];
        // Update the name based on the hex color
        if (hexValue) {
          const colorName = getColorName(hexValue);
          // Only use the color name if it's meaningful (not generic like "Reddish")
          if (
            !colorName.includes('-ish') &&
            !colorName.includes('Near') &&
            colorName !== hexValue
          ) {
            name = colorName;
          }
        }
      }

      return new Color({
        id: color.id,
        name,
        hexValue,
        firstLayer: color.firstLayer,
        lastLayer: color.lastLayer,
        layersUsed: color.layersUsed,
        partialLayers: color.partialLayers,
        totalLayers,
      });
    });
  }

  const colorUsageRanges = extractColorRanges(layerColorMap, totalLayers);

  // Filter out unused colors (test requirement: only show used colors)
  const usedColors = colors.filter((color) => color.layerCount > 0);

  const stats: GcodeStats = {
    ...partialStats,
    totalLayers,
    colors: usedColors,
    toolChanges,
    layerColorMap,
    colorUsageRanges,
    layerDetails,
    parseTime,
  };

  return stats;
}
