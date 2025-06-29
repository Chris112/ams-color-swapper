import { Color } from '../domain/models/Color';
import { FilamentDatabase } from '../services/FilamentDatabase';
import { ColorDeduplicationService } from '../services/ColorDeduplicationService';
import { GcodeStats } from '../types/gcode';
import { ToolChange } from '../types/tool';
import { LayerColorInfo } from '../types/layer';
import { extractColorInfo, extractColorRanges } from './colorExtractor';
import { Logger } from '../utils/logger';

const logger = new Logger('Statistics');

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
  const minLayerFromMap = layerKeys.length > 0 ? Math.min(...layerKeys) : 0;
  
  // For 1-based indexing (like OrcaSlicer), totalLayers = maxLayer
  // For 0-based indexing, totalLayers = maxLayer + 1
  // Detect indexing scheme: if minimum layer is 1, it's 1-based
  const calculatedLayers = minLayerFromMap === 1 ? maxLayerFromMap : maxLayerFromMap + 1;

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
          const colorDefs = partialStats.slicerInfo?.colorDefinitions;
          if (colorDefs && index < colorDefs.length) {
            hexValue = colorDefs[index];
          }
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

  // Apply color deduplication
  const deduplicationService = new ColorDeduplicationService();
  const deduplicationResult = deduplicationService.deduplicateColors(colors);

  // Update tool changes and layer color map with deduplicated mappings
  const updatedToolChanges = deduplicationService.updateToolChanges(
    toolChanges,
    deduplicationResult.colorMapping
  );

  const updatedLayerColorMap = deduplicationService.updateLayerColorMap(
    layerColorMap,
    deduplicationResult.colorMapping
  );

  // Extract color ranges with updated map
  const colorUsageRanges = extractColorRanges(updatedLayerColorMap, totalLayers);

  // Filter out unused colors (test requirement: only show used colors)
  const usedColors = deduplicationResult.deduplicatedColors.filter((color) => color.layerCount > 0);

  const stats: GcodeStats = {
    ...partialStats,
    totalLayers,
    colors: usedColors,
    toolChanges: updatedToolChanges,
    layerColorMap: updatedLayerColorMap,
    colorUsageRanges,
    layerDetails,
    parseTime,
    deduplicationInfo:
      deduplicationResult.duplicatesFound.length > 0
        ? {
            duplicatesFound: deduplicationResult.duplicatesFound,
            freedSlots: deduplicationResult.freedSlots,
            colorMapping: deduplicationResult.colorMapping,
          }
        : undefined,
  };

  // Log deduplication results
  if (deduplicationResult.duplicatesFound.length > 0) {
    logger.info(`Color deduplication freed ${deduplicationResult.freedSlots.length} slots`);
    deduplicationResult.duplicatesFound.forEach((dup) => {
      logger.info(
        `Merged ${dup.originalTools.join(', ')} (${dup.hexCode}) -> ${dup.assignedTo}: ${dup.colorName}`
      );
    });
  }

  return stats;
}
