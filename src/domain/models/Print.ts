import { Color } from './Color';
import { ToolChange } from './ToolChange';
import { Slicer, FilamentUsageStats } from './Slicer';
import { LayerColorInfo } from '../../types/layer';

/**
 * Domain model representing a 3D print
 */
export class Print {
  public readonly formattedPrintTime: string;

  constructor(
    public readonly fileName: string,
    public readonly fileSize: number,
    public readonly totalLayers: number,
    public readonly totalHeight: number,
    public readonly colors: Color[],
    public readonly toolChanges: ToolChange[],
    public readonly layerColorMap: Map<number, string[]>,
    public readonly layerDetails: LayerColorInfo[],
    public readonly slicer?: Slicer,
    public readonly estimatedTime?: number,
    public readonly filamentUsageStats?: FilamentUsageStats
  ) {
    this.formattedPrintTime = this.formatPrintTime(estimatedTime);
  }

  private formatPrintTime(seconds?: number): string {
    if (!seconds) return 'Unknown';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Get total number of color changes
   */
  public get totalColorChanges(): number {
    return this.toolChanges.length;
  }

  /**
   * Get unique color count
   */
  public get uniqueColorCount(): number {
    return this.colors.length;
  }

  /**
   * Get color usage statistics
   */
  public getColorUsageStats(): Map<string, number> {
    const stats = new Map<string, number>();

    this.layerColorMap.forEach((colors) => {
      colors.forEach((color) => {
        stats.set(color, (stats.get(color) || 0) + 1);
      });
    });

    return stats;
  }

  /**
   * Check if print uses specific color
   */
  public usesColor(colorId: string): boolean {
    return this.colors.some((c) => c.id === colorId);
  }

  /**
   * Get layers where specific color is used
   */
  public getColorLayers(colorId: string): number[] {
    const layers: number[] = [];

    this.layerColorMap.forEach((colors, layer) => {
      if (colors.includes(colorId)) {
        layers.push(layer);
      }
    });

    return layers.sort((a, b) => a - b);
  }
}
