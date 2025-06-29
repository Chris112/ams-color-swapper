import { Color } from '../domain/models/Color';
import { ToolChange } from '../types/tool';
import { Logger } from '../utils/logger';

export interface DeduplicationResult {
  deduplicatedColors: Color[];
  colorMapping: Map<string, string>; // Original tool ID -> New tool ID
  freedSlots: string[]; // Tool IDs that were freed up
  duplicatesFound: Array<{
    hexCode: string;
    originalTools: string[];
    assignedTo: string;
    colorName: string;
  }>;
}

export class ColorDeduplicationService {
  private logger = new Logger('ColorDeduplicationService');

  /**
   * Deduplicate colors by combining those with identical hex codes
   * into the lowest numbered toolhead where that hex code first appeared
   */
  public deduplicateColors(colors: Color[]): DeduplicationResult {
    const hexToColors = new Map<string, Color[]>();
    const colorMapping = new Map<string, string>();
    const freedSlots: string[] = [];
    const duplicatesFound: DeduplicationResult['duplicatesFound'] = [];

    // Group colors by hex code
    colors.forEach((color) => {
      if (color.hexValue) {
        const hex = color.hexValue.toUpperCase();
        if (!hexToColors.has(hex)) {
          hexToColors.set(hex, []);
        }
        hexToColors.get(hex)!.push(color);
      }
    });

    // Process each hex group
    const deduplicatedColors: Color[] = [];
    const processedHexCodes = new Set<string>();

    hexToColors.forEach((colorGroup, hexCode) => {
      if (colorGroup.length > 1) {
        // Sort by tool number to find the lowest
        const sortedColors = [...colorGroup].sort((a, b) => {
          const aNum = parseInt(a.id.substring(1));
          const bNum = parseInt(b.id.substring(1));
          return aNum - bNum;
        });

        const primaryColor = sortedColors[0];
        const duplicateColors = sortedColors.slice(1);

        // Combine all layer usage into the primary color
        const combinedLayersUsed = new Set(primaryColor.layersUsed);
        const combinedPartialLayers = new Set(primaryColor.partialLayers);
        let minFirstLayer = primaryColor.firstLayer;
        let maxLastLayer = primaryColor.lastLayer;

        duplicateColors.forEach((dupColor) => {
          dupColor.layersUsed.forEach((layer) => combinedLayersUsed.add(layer));
          dupColor.partialLayers.forEach((layer) => combinedPartialLayers.add(layer));
          minFirstLayer = Math.min(minFirstLayer, dupColor.firstLayer);
          maxLastLayer = Math.max(maxLastLayer, dupColor.lastLayer);

          // Track the mapping
          colorMapping.set(dupColor.id, primaryColor.id);
          freedSlots.push(dupColor.id);
        });

        // Create the deduplicated color with combined usage
        const deduplicatedColor = new Color({
          ...primaryColor,
          layersUsed: combinedLayersUsed,
          partialLayers: combinedPartialLayers,
          firstLayer: minFirstLayer,
          lastLayer: maxLastLayer,
          name: this.getCombinedColorName(colorGroup) || primaryColor.name,
        });

        deduplicatedColors.push(deduplicatedColor);
        processedHexCodes.add(hexCode);

        // Track duplicate information
        duplicatesFound.push({
          hexCode,
          originalTools: colorGroup.map((c) => c.id),
          assignedTo: primaryColor.id,
          colorName: deduplicatedColor.name || hexCode,
        });

        this.logger.info(
          `Deduplicated ${hexCode}: ${colorGroup.map((c) => c.id).join(', ')} -> ${primaryColor.id}`
        );
      } else {
        // No duplicates for this hex code
        deduplicatedColors.push(colorGroup[0]);
      }
    });

    // Add colors without hex values (shouldn't be deduplicated)
    colors.forEach((color) => {
      if (!color.hexValue) {
        deduplicatedColors.push(color);
      }
    });

    // Sort deduplicated colors by tool number
    deduplicatedColors.sort((a, b) => {
      const aNum = parseInt(a.id.substring(1));
      const bNum = parseInt(b.id.substring(1));
      return aNum - bNum;
    });

    return {
      deduplicatedColors,
      colorMapping,
      freedSlots,
      duplicatesFound,
    };
  }

  /**
   * Update tool changes based on color deduplication mapping
   */
  public updateToolChanges(
    toolChanges: ToolChange[],
    colorMapping: Map<string, string>
  ): ToolChange[] {
    return toolChanges.map((tc) => ({
      ...tc,
      fromTool: colorMapping.get(String(tc.fromTool)) || tc.fromTool,
      toTool: colorMapping.get(String(tc.toTool)) || tc.toTool,
    }));
  }

  /**
   * Update layer color map based on deduplication
   */
  public updateLayerColorMap(
    layerColorMap: Map<number, string[]>,
    colorMapping: Map<string, string>
  ): Map<number, string[]> {
    const updatedMap = new Map<number, string[]>();

    layerColorMap.forEach((colors, layer) => {
      const updatedColors = colors.map((color) => colorMapping.get(color) || color);
      // Remove duplicates within each layer
      const uniqueColors = Array.from(new Set(updatedColors));
      updatedMap.set(layer, uniqueColors);
    });

    return updatedMap;
  }

  /**
   * Get a combined name for deduplicated colors
   */
  private getCombinedColorName(colors: Color[]): string | undefined {
    // If all colors have the same name, use it
    const uniqueNames = new Set(colors.map((c) => c.name).filter(Boolean));
    if (uniqueNames.size === 1 && colors[0].name) {
      return colors[0].name;
    }

    // If names differ but have enhanced names, prefer the first enhanced name
    const enhancedColor = colors.find(
      (c) => c.name && !c.name.match(/^(Color \d+|T\d+|#[0-9A-Fa-f]{6})/) && c.name.length > 3
    );
    if (enhancedColor?.name) {
      return enhancedColor.name;
    }

    // Otherwise, use the first color's name
    return colors[0].name;
  }
}
