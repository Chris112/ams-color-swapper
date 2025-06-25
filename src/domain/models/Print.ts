import { Color } from './Color';
import { ToolChange } from './ToolChange';
import { Slicer, FilamentUsageStats } from './Slicer';

/**
 * Domain model representing a 3D print job
 */
export class Print {
  constructor(
    public readonly fileName: string,
    public readonly fileSize: number,
    public readonly totalLayers: number,
    public readonly totalHeight: number,
    public readonly colors: Color[],
    public readonly toolChanges: ToolChange[],
    public readonly slicer?: Slicer,
    public readonly estimatedTime?: number,
    public readonly filamentUsageStats?: FilamentUsageStats
  ) {
    this.validate();
  }

  /**
   * Get average layer height
   */
  get averageLayerHeight(): number {
    if (this.totalLayers === 0) return 0;
    return this.totalHeight / this.totalLayers;
  }

  /**
   * Get color at specific layer
   */
  getColorAtLayer(layer: number): Color | undefined {
    return this.colors.find((color) => color.isUsedInLayer(layer));
  }

  /**
   * Get all colors that overlap (can't share slots)
   */
  getOverlappingColors(): Array<[Color, Color]> {
    const overlaps: Array<[Color, Color]> = [];

    for (let i = 0; i < this.colors.length; i++) {
      for (let j = i + 1; j < this.colors.length; j++) {
        if (this.colors[i].overlapsWith(this.colors[j])) {
          overlaps.push([this.colors[i], this.colors[j]]);
        }
      }
    }

    return overlaps;
  }

  /**
   * Get tool changes within a layer range
   */
  getToolChangesInRange(startLayer: number, endLayer: number): ToolChange[] {
    return this.toolChanges.filter((tc) => tc.layer >= startLayer && tc.layer <= endLayer);
  }

  /**
   * Check if multiple colors are used
   */
  get isMultiColor(): boolean {
    return this.colors.length > 1;
  }

  /**
   * Get estimated print time as formatted string
   */
  get formattedPrintTime(): string | undefined {
    if (!this.estimatedTime) return undefined;

    const hours = Math.floor(this.estimatedTime / 3600);
    const minutes = Math.floor((this.estimatedTime % 3600) / 60);
    const seconds = this.estimatedTime % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private validate(): void {
    if (!this.fileName) {
      throw new Error('File name is required');
    }
    if (this.fileSize < 0) {
      throw new Error('File size must be non-negative');
    }
    if (this.totalLayers < 0) {
      throw new Error('Total layers must be non-negative');
    }
    if (this.totalHeight < 0) {
      throw new Error('Total height must be non-negative');
    }
  }
}
