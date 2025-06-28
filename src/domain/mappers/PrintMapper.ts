import { GcodeStats } from '../../types';
import { Print, ToolChange } from '../models';

/**
 * Maps between infrastructure types and domain models
 */
export class PrintMapper {
  /**
   * Convert GcodeStats to Print domain model
   */
  static toDomain(stats: GcodeStats): Print {
    // Colors are already Color objects from the parser
    const colors = stats.colors;

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
      stats.layerColorMap,
      stats.layerDetails || [],
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
    // Generate color usage ranges from Color objects
    const colorUsageRanges = print.colors.map((color) => {
      // Find continuous ranges from layersUsed set
      const layers = Array.from(color.layersUsed).sort((a, b) => a - b);
      if (layers.length === 0) {
        return {
          colorId: color.id,
          startLayer: color.firstLayer,
          endLayer: color.lastLayer,
          continuous: false,
        };
      }

      // For now, return the full range (can be improved to find actual continuous ranges)
      return {
        colorId: color.id,
        startLayer: Math.min(...layers),
        endLayer: Math.max(...layers),
        continuous: layers.length === Math.max(...layers) - Math.min(...layers) + 1,
      };
    });

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
      colors: print.colors,
      toolChanges: print.toolChanges.map((tc) => ({
        fromTool: tc.fromTool,
        toTool: tc.toTool,
        layer: tc.layer,
        lineNumber: tc.lineNumber,
        zHeight: tc.zHeight,
      })),
      layerColorMap: print.layerColorMap,
      colorUsageRanges,
      layerDetails: print.layerDetails,
      filamentUsageStats: print.filamentUsageStats,
      parserWarnings: [],
      parseTime: 0,
    };
  }
}
