/**
 * Domain model for a color used in 3D printing
 */
export class Color {
  public readonly id: string;
  public readonly name: string | undefined;
  public readonly hexValue: string | undefined;
  public readonly firstLayer: number;
  public readonly lastLayer: number;
  public readonly layersUsed: Set<number>;
  public readonly partialLayers: Set<number>;
  public readonly usagePercentage: number;

  constructor(params: {
    id: string;
    name: string | undefined;
    hexValue: string | undefined;
    firstLayer: number;
    lastLayer: number;
    layersUsed?: Set<number>;
    partialLayers?: Set<number>;
    totalLayers?: number;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.hexValue = params.hexValue;
    this.firstLayer = params.firstLayer;
    this.lastLayer = params.lastLayer;
    this.layersUsed = params.layersUsed || new Set();
    this.partialLayers = params.partialLayers || new Set();

    // Calculate usage percentage
    const totalLayers = params.totalLayers || 0;
    this.usagePercentage = totalLayers > 0 ? (this.layersUsed.size / totalLayers) * 100 : 0;

    this.validate();
  }

  /**
   * Total number of layers using this color
   */
  get layerCount(): number {
    return this.layersUsed.size;
  }

  /**
   * Number of layers where this color is used but not as primary
   */
  get partialLayerCount(): number {
    return this.partialLayers.size;
  }

  /**
   * Check if this color is used in a specific layer
   */
  isUsedInLayer(layer: number): boolean {
    return this.layersUsed.has(layer);
  }

  /**
   * Check if this color is partial (non-primary) in a specific layer
   */
  isPartialInLayer(layer: number): boolean {
    return this.partialLayers.has(layer);
  }

  /**
   * Check if this color is primary in a specific layer
   */
  isPrimaryInLayer(layer: number): boolean {
    return this.layersUsed.has(layer) && !this.partialLayers.has(layer);
  }

  /**
   * Get layer usage type for a specific layer
   */
  getLayerUsage(layer: number): 'primary' | 'partial' | 'none' {
    if (!this.layersUsed.has(layer)) return 'none';
    return this.partialLayers.has(layer) ? 'partial' : 'primary';
  }

  /**
   * Check if this color overlaps with another color
   */
  overlapsWith(other: Color): boolean {
    // Check if any layers are used by both colors
    for (const layer of this.layersUsed) {
      if (other.layersUsed.has(layer)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get display name for the color
   */
  get displayName(): string {
    if (this.name) return this.name;
    if (this.hexValue) return this.hexValue;
    return this.id;
  }

  /**
   * Create a Color from raw data
   */
  static fromData(data: {
    id: string;
    name?: string;
    hexColor?: string;
    firstLayer: number;
    lastLayer: number;
    layersUsed?: number[];
    partialLayers?: number[];
    totalLayers?: number;
  }): Color {
    return new Color({
      id: data.id,
      name: data.name,
      hexValue: data.hexColor,
      firstLayer: data.firstLayer,
      lastLayer: data.lastLayer,
      layersUsed: data.layersUsed ? new Set(data.layersUsed) : undefined,
      partialLayers: data.partialLayers ? new Set(data.partialLayers) : undefined,
      totalLayers: data.totalLayers,
    });
  }

  private validate(): void {
    if (!this.id) {
      throw new Error('Color ID is required');
    }
    if (this.firstLayer < 0) {
      throw new Error('First layer must be non-negative');
    }
    if (this.lastLayer < this.firstLayer) {
      throw new Error('Last layer must be greater than or equal to first layer');
    }
    if (this.hexValue && !this.isValidHexColor(this.hexValue)) {
      throw new Error('Invalid hex color format');
    }
  }

  private isValidHexColor(hex: string): boolean {
    return /^#[0-9A-F]{6}$/i.test(hex);
  }

  /**
   * Convert to a serializable format
   */
  toJSON(): {
    id: string;
    name?: string;
    hexColor?: string;
    firstLayer: number;
    lastLayer: number;
    layerCount: number;
    partialLayerCount: number;
    usagePercentage: number;
    layersUsed: number[];
    partialLayers: number[];
  } {
    return {
      id: this.id,
      name: this.name,
      hexColor: this.hexValue,
      firstLayer: this.firstLayer,
      lastLayer: this.lastLayer,
      layerCount: this.layerCount,
      partialLayerCount: this.partialLayerCount,
      usagePercentage: this.usagePercentage,
      layersUsed: Array.from(this.layersUsed),
      partialLayers: Array.from(this.partialLayers),
    };
  }
}
