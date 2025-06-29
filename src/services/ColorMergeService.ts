import { Color } from '../domain/models/Color';
import { GcodeStats } from '../types/gcode';
import { Logger } from '../utils/logger';

const logger = new Logger('ColorMergeService');

export interface MergePreview {
  targetColor: Color;
  sourceColors: Color[];
  affectedLayers: number[];
  affectedSegments: number;
  freedSlots: string[];
  newColorCount: number;
}

export interface MergeResult {
  mergedStats: GcodeStats;
  mergeHistory: MergeHistoryEntry;
}

export interface MergeHistoryEntry {
  id: string;
  timestamp: number;
  targetColorId: string;
  sourceColorIds: string[];
  affectedLayers: number[];
  freedSlots: string[];
}

export class ColorMergeService {
  private mergeHistory: MergeHistoryEntry[] = [];

  /**
   * Preview what would happen if colors were merged
   */
  public previewMerge(
    stats: GcodeStats,
    targetColorId: string,
    sourceColorIds: string[]
  ): MergePreview | null {
    const targetColor = stats.colors.find((c) => c.id === targetColorId);
    const sourceColors = stats.colors.filter((c) => sourceColorIds.includes(c.id));

    if (!targetColor || sourceColors.length === 0) {
      logger.warn('Invalid color IDs for merge preview');
      return null;
    }

    // Find all affected layers
    const affectedLayers = new Set<number>();
    let affectedSegments = 0;

    stats.layerColorMap.forEach((colors, layer) => {
      if (colors.some((c) => sourceColorIds.includes(c))) {
        affectedLayers.add(layer);
        affectedSegments += colors.filter((c) => sourceColorIds.includes(c)).length;
      }
    });

    // Calculate freed slots
    const freedSlots = sourceColorIds;

    return {
      targetColor,
      sourceColors,
      affectedLayers: Array.from(affectedLayers).sort((a, b) => a - b),
      affectedSegments,
      freedSlots,
      newColorCount: stats.colors.length - sourceColors.length,
    };
  }

  /**
   * Apply color merge to the stats
   */
  public mergeColors(
    stats: GcodeStats,
    targetColorId: string,
    sourceColorIds: string[]
  ): MergeResult | null {
    const preview = this.previewMerge(stats, targetColorId, sourceColorIds);
    if (!preview) {
      return null;
    }

    logger.info(
      `Merging colors: ${sourceColorIds.join(', ')} -> ${targetColorId}, affecting ${preview.affectedLayers.length} layers`
    );

    // Clone the stats to avoid mutating the original
    const mergedStats = this.cloneStats(stats);

    // Update tool changes
    mergedStats.toolChanges = mergedStats.toolChanges.map((change) => ({
      ...change,
      fromTool: sourceColorIds.includes(String(change.fromTool)) ? targetColorId : change.fromTool,
      toTool: sourceColorIds.includes(String(change.toTool)) ? targetColorId : change.toTool,
    }));

    // Update layer color map
    const newLayerColorMap = new Map<number, string[]>();
    mergedStats.layerColorMap.forEach((colors, layer) => {
      const updatedColors = colors.map((c) => (sourceColorIds.includes(c) ? targetColorId : c));
      // Remove duplicates
      const uniqueColors = Array.from(new Set(updatedColors));
      newLayerColorMap.set(layer, uniqueColors);
    });
    mergedStats.layerColorMap = newLayerColorMap;

    // Update layer details if present
    if (mergedStats.layerDetails) {
      mergedStats.layerDetails = mergedStats.layerDetails.map((detail) => ({
        ...detail,
        colors: detail.colors.map((c: string) => (sourceColorIds.includes(c) ? targetColorId : c)),
        uniqueColors: Array.from(
          new Set(
            detail.colors.map((c: string) => (sourceColorIds.includes(c) ? targetColorId : c))
          )
        ),
      }));
    }

    // Update color usage ranges - merge ranges for colors being combined
    const newColorUsageRanges = mergedStats.colorUsageRanges.map((range) => {
      if (sourceColorIds.includes(range.colorId)) {
        return { ...range, colorId: targetColorId };
      }
      return range;
    });

    // Merge overlapping ranges for the same color
    const mergedRanges: typeof newColorUsageRanges = [];
    const colorRangeMap = new Map<string, typeof newColorUsageRanges>();

    newColorUsageRanges.forEach((range) => {
      if (!colorRangeMap.has(range.colorId)) {
        colorRangeMap.set(range.colorId, []);
      }
      colorRangeMap.get(range.colorId)!.push(range);
    });

    colorRangeMap.forEach((ranges, colorId) => {
      const layerRanges = ranges.map((r) => ({ start: r.startLayer, end: r.endLayer }));
      const merged = this.mergeOverlappingRanges(layerRanges);
      merged.forEach(({ start, end }) => {
        mergedRanges.push({
          colorId,
          startLayer: start,
          endLayer: end,
          continuous: true,
        });
      });
    });

    mergedStats.colorUsageRanges = mergedRanges;

    // Update colors array - merge layer usage
    const targetColorIndex = mergedStats.colors.findIndex((c) => c.id === targetColorId);
    if (targetColorIndex !== -1) {
      const targetColor = mergedStats.colors[targetColorIndex];
      const mergedLayersUsed = new Set(targetColor.layersUsed);
      const mergedPartialLayers = new Set(targetColor.partialLayers);

      sourceColorIds.forEach((sourceId) => {
        const sourceColor = mergedStats.colors.find((c) => c.id === sourceId);
        if (sourceColor) {
          sourceColor.layersUsed.forEach((layer) => mergedLayersUsed.add(layer));
          sourceColor.partialLayers.forEach((layer) => mergedPartialLayers.add(layer));
        }
      });

      // Update target color with merged data
      const mergedColor = new Color({
        id: targetColor.id,
        name: targetColor.name,
        hexValue: targetColor.hexValue,
        firstLayer: Math.min(
          targetColor.firstLayer,
          ...preview.sourceColors.map((c) => c.firstLayer)
        ),
        lastLayer: Math.max(targetColor.lastLayer, ...preview.sourceColors.map((c) => c.lastLayer)),
        layersUsed: mergedLayersUsed,
        partialLayers: mergedPartialLayers,
        totalLayers: mergedStats.totalLayers,
      });
      mergedStats.colors[targetColorIndex] = mergedColor;
    }

    // Remove source colors from the colors array
    mergedStats.colors = mergedStats.colors.filter((c) => !sourceColorIds.includes(c.id));

    // Create merge history entry
    const historyEntry: MergeHistoryEntry = {
      id: `merge-${Date.now()}`,
      timestamp: Date.now(),
      targetColorId,
      sourceColorIds,
      affectedLayers: preview.affectedLayers,
      freedSlots: preview.freedSlots,
    };

    this.mergeHistory.push(historyEntry);

    logger.info(
      `Merge complete: ${sourceColorIds.length} colors merged into ${targetColorId}, ${preview.freedSlots.length} slots freed`
    );

    return {
      mergedStats,
      mergeHistory: historyEntry,
    };
  }

  /**
   * Undo a merge operation
   */
  public undoMerge(mergeId: string, originalStats: GcodeStats): GcodeStats | null {
    const mergeEntry = this.mergeHistory.find((entry) => entry.id === mergeId);
    if (!mergeEntry) {
      logger.warn(`Merge entry ${mergeId} not found in history`);
      return null;
    }

    // For now, return the original stats
    // In a full implementation, we'd reconstruct the pre-merge state
    logger.info(`Undoing merge ${mergeId}`);
    return originalStats;
  }

  /**
   * Get merge history
   */
  public getMergeHistory(): MergeHistoryEntry[] {
    return [...this.mergeHistory];
  }

  /**
   * Clear merge history
   */
  public clearHistory(): void {
    this.mergeHistory = [];
  }

  /**
   * Helper to clone stats object
   */
  private cloneStats(stats: GcodeStats): GcodeStats {
    return {
      ...stats,
      colors: stats.colors.map(
        (c) =>
          new Color({
            id: c.id,
            name: c.name,
            hexValue: c.hexValue,
            firstLayer: c.firstLayer,
            lastLayer: c.lastLayer,
            layersUsed: new Set(c.layersUsed),
            partialLayers: new Set(c.partialLayers),
            totalLayers: stats.totalLayers,
          })
      ),
      toolChanges: stats.toolChanges.map((tc) => ({ ...tc })),
      layerColorMap: new Map(stats.layerColorMap),
      layerDetails: stats.layerDetails ? stats.layerDetails.map((ld) => ({ ...ld })) : undefined,
      colorUsageRanges: stats.colorUsageRanges.map((r) => ({ ...r })),
    };
  }

  /**
   * Merge overlapping layer ranges
   * @internal Made public for testing
   */
  public mergeOverlappingRanges(
    ranges: Array<{ start: number; end: number }>
  ): Array<{ start: number; end: number }> {
    if (ranges.length <= 1) return ranges;

    // Sort by start layer
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const merged: Array<{ start: number; end: number }> = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const last = merged[merged.length - 1];

      if (current.start <= last.end + 1) {
        // Overlapping or adjacent ranges, merge them
        last.end = Math.max(last.end, current.end);
      } else {
        // Non-overlapping range, add it
        merged.push(current);
      }
    }

    return merged;
  }
}
