/**
 * Domain model for a color used in 3D printing
 */
export class Color {
  constructor(
    public readonly id: string,
    public readonly name: string | undefined,
    public readonly hexValue: string | undefined,
    public readonly firstLayer: number,
    public readonly lastLayer: number
  ) {
    this.validate();
  }

  /**
   * Total number of layers using this color
   */
  get layerCount(): number {
    return this.lastLayer - this.firstLayer + 1;
  }

  /**
   * Check if this color is used in a specific layer
   */
  isUsedInLayer(layer: number): boolean {
    return layer >= this.firstLayer && layer <= this.lastLayer;
  }

  /**
   * Check if this color overlaps with another color
   */
  overlapsWith(other: Color): boolean {
    return !(this.lastLayer < other.firstLayer || this.firstLayer > other.lastLayer);
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
  }): Color {
    return new Color(
      data.id,
      data.name,
      data.hexColor,
      data.firstLayer,
      data.lastLayer
    );
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
}