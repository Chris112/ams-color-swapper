import { Color } from '../domain/models/Color';
import { FilamentDatabase } from '../services/FilamentDatabase';
import { GcodeStats, LayerColorInfo, ToolChange } from '../types';
import { extractColorInfo, extractColorRanges } from './colorExtractor';

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

  let colors = await extractColorInfo(
    colorFirstSeen,
    colorLastSeen,
    totalLayers,
    layerColorMap,
    layerDetails
  );

  // Initialize FilamentDatabase for enhanced color naming (non-blocking)
  const filamentDb = FilamentDatabase.getInstance();

  // For Bambu Lab printers, enhance colors with hex values
  if (partialStats.slicerInfo?.colorDefinitions) {
    const definedColorCount = partialStats.slicerInfo.colorDefinitions.length;
    const usedTools = new Set(colors.map((c) => c.id));

    // Add missing colors that were defined but not used
    for (let i = 0; i < definedColorCount; i++) {
      const toolId = `T${i}`;
      if (!usedTools.has(toolId)) {
        colors.push(
          new Color({
            id: toolId,
            name: `Color ${i + 1} (Unused)`,
            hexValue: partialStats.slicerInfo.colorDefinitions[i],
            firstLayer: 0,
            lastLayer: 0,
            layersUsed: new Set(),
            partialLayers: new Set(),
            totalLayers,
          })
        );
      }
    }

    // Create new Color objects with hex values
    colors = await Promise.all(
      colors.map(async (color) => {
        const index = parseInt(color.id.substring(1));
        let hexValue = color.hexValue;
        let name = color.name;

        if (index < definedColorCount) {
          hexValue = partialStats.slicerInfo!.colorDefinitions![index];
          // Update the name based on the hex color using FilamentDatabase
          if (hexValue) {
            // Get enhanced name from FilamentDatabase (non-blocking)
            const enhancedName = await filamentDb.getEnhancedColorName(hexValue, color.name);
            name = enhancedName;
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
      })
    );
  } else {
    // For cases without color definitions, try to enhance names if hex values are available
    colors = await Promise.all(
      colors.map(async (color) => {
        let name = color.name;

        if (color.hexValue) {
          // Get enhanced name from FilamentDatabase (non-blocking)
          const enhancedName = await filamentDb.getEnhancedColorName(color.hexValue, color.name);
          name = enhancedName;
        }

        return new Color({
          id: color.id,
          name,
          hexValue: color.hexValue,
          firstLayer: color.firstLayer,
          lastLayer: color.lastLayer,
          layersUsed: color.layersUsed,
          partialLayers: color.partialLayers,
          totalLayers,
        });
      })
    );
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
