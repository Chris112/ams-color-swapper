import { GcodeStats, ToolChange } from '../types';
import { extractColorInfo, extractColorRanges } from './colorExtractor';
import { getColorName } from '../utils/colorNames';

export async function calculateStatistics(
  partialStats: GcodeStats,
  toolChanges: ToolChange[],
  layerColorMap: Map<number, string>,
  colorFirstSeen: Map<string, number>,
  colorLastSeen: Map<string, number>,
  parseTime: number
): Promise<GcodeStats> {
  const totalLayers = Math.max(...Array.from(layerColorMap.keys()), 0) || 1;

  let colors = extractColorInfo(colorFirstSeen, colorLastSeen, totalLayers, layerColorMap);

  // For Bambu Lab printers, ensure all defined colors are included
  if (partialStats.slicerInfo?.colorDefinitions) {
    const definedColorCount = partialStats.slicerInfo.colorDefinitions.length;
    const usedTools = new Set(colors.map((c) => c.id));

    // Add missing colors that were defined but not used
    for (let i = 0; i < definedColorCount; i++) {
      const toolId = `T${i}`;
      if (!usedTools.has(toolId)) {
        colors.push({
          id: toolId,
          name: `Color ${i + 1} (Unused)`,
          hexColor: partialStats.slicerInfo.colorDefinitions[i],
          firstLayer: -1,
          lastLayer: -1,
          layerCount: 0,
          usagePercentage: 0,
        });
      }
    }

    // Update hex colors from definitions
    colors.forEach((color) => {
      const index = parseInt(color.id.substring(1));
      if (index < definedColorCount) {
        color.hexColor = partialStats.slicerInfo!.colorDefinitions![index];
        // Update the name based on the hex color
        if (color.hexColor) {
          const colorName = getColorName(color.hexColor);
          // Only use the color name if it's meaningful (not generic like "Reddish")
          if (
            !colorName.includes('-ish') &&
            !colorName.includes('Near') &&
            colorName !== color.hexColor
          ) {
            color.name = colorName;
          }
        }
      }
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
    parseTime,
  };

  return stats;
}
