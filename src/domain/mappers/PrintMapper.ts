import { GcodeStats } from '../../types';
import { Print, Color, ToolChange } from '../models';

/**
 * Maps between infrastructure types and domain models
 */
export class PrintMapper {
  /**
   * Convert GcodeStats to Print domain model
   */
  static toDomain(stats: GcodeStats): Print {
    const colors = stats.colors.map((c) =>
      Color.fromData({
        id: c.id,
        name: c.name,
        hexColor: c.hexColor,
        firstLayer: c.firstLayer,
        lastLayer: c.lastLayer,
      })
    );

    const toolChanges = stats.toolChanges.map((tc) =>
      ToolChange.fromData({
        fromTool: tc.fromTool,
        toTool: tc.toTool,
        layer: tc.layer,
        lineNumber: tc.lineNumber,
        zHeight: tc.zHeight,
      })
    );

    return new Print(
      stats.fileName,
      stats.fileSize,
      stats.totalLayers,
      stats.totalHeight,
      colors,
      toolChanges,
      stats.slicerInfo
        ? {
            software: stats.slicerInfo.software,
            version: stats.slicerInfo.version,
            profile: stats.slicerInfo.profile,
          }
        : undefined,
      stats.estimatedPrintTime,
      stats.filamentUsageStats
    );
  }

  /**
   * Convert Print domain model to GcodeStats
   */
  static toInfrastructure(print: Print): GcodeStats {
    const layerColorMap = new Map<number, string>();
    const colorUsageRanges = print.colors.map((color) => ({
      colorId: color.id,
      startLayer: color.firstLayer,
      endLayer: color.lastLayer,
      continuous: true,
    }));

    // Build layer color map
    for (let layer = 1; layer <= print.totalLayers; layer++) {
      const color = print.getColorAtLayer(layer);
      if (color) {
        layerColorMap.set(layer, color.id);
      }
    }

    return {
      fileName: print.fileName,
      fileSize: print.fileSize,
      totalLayers: print.totalLayers,
      totalHeight: print.totalHeight,
      estimatedPrintTime: print.estimatedTime,
      printTime: print.formattedPrintTime,
      slicerInfo: print.slicer
        ? {
            software: print.slicer.software,
            version: print.slicer.version || '',
            profile: print.slicer.profile,
          }
        : undefined,
      colors: print.colors.map((color) => ({
        id: color.id,
        name: color.name,
        hexColor: color.hexValue,
        firstLayer: color.firstLayer,
        lastLayer: color.lastLayer,
        layerCount: color.layerCount,
        usagePercentage: (color.layerCount / print.totalLayers) * 100,
      })),
      toolChanges: print.toolChanges.map((tc) => ({
        fromTool: tc.fromTool,
        toTool: tc.toTool,
        layer: tc.layer,
        lineNumber: tc.lineNumber,
        zHeight: tc.zHeight,
      })),
      layerColorMap,
      colorUsageRanges,
      filamentUsageStats: print.filamentUsageStats,
      parserWarnings: [],
      parseTime: 0,
    };
  }
}
