import { Color } from './Color';

/**
 * Domain model representing an AMS (Automatic Material System) slot
 */
export class AmsSlot {
  private _colors: Color[] = [];

  constructor(
    public readonly unitNumber: number,
    public readonly slotNumber: number,
    public isPermanent: boolean = true
  ) {
    this.validate();
  }

  /**
   * Get colors assigned to this slot
   */
  get colors(): ReadonlyArray<Color> {
    return [...this._colors];
  }

  /**
   * Get color IDs assigned to this slot
   */
  get colorIds(): string[] {
    return this._colors.map((c) => c.id);
  }

  /**
   * Check if slot is empty
   */
  get isEmpty(): boolean {
    return this._colors.length === 0;
  }

  /**
   * Check if slot has multiple colors (requires swaps)
   */
  get requiresSwaps(): boolean {
    return this._colors.length > 1;
  }

  /**
   * Assign a color to this slot
   */
  assignColor(color: Color, allowOverlaps: boolean = false): void {
    if (this.isPermanent && this._colors.length > 0) {
      throw new Error('Cannot assign multiple colors to a permanent slot');
    }

    // Check for overlaps with existing colors (only if not allowing overlaps)
    if (!allowOverlaps) {
      const overlap = this._colors.find((c) => c.overlapsWith(color));
      if (overlap) {
        throw new Error(`Color ${color.id} overlaps with ${overlap.id} in slot ${this.slotNumber}`);
      }
    }

    this._colors.push(color);
  }

  /**
   * Remove a color from this slot
   */
  removeColor(colorId: string): void {
    this._colors = this._colors.filter((c) => c.id !== colorId);
  }

  /**
   * Clear all colors from this slot
   */
  clear(): void {
    this._colors = [];
  }

  /**
   * Get the color that should be loaded at a specific layer
   */
  getColorAtLayer(layer: number): Color | undefined {
    return this._colors.find((c) => c.isUsedInLayer(layer));
  }

  /**
   * Get swap points (layers where color changes are needed)
   */
  getSwapPoints(): number[] {
    if (this.isPermanent || this._colors.length <= 1) {
      return [];
    }

    const swapPoints: number[] = [];

    // Sort colors by first layer
    const sortedColors = [...this._colors].sort((a, b) => a.firstLayer - b.firstLayer);

    // Add swap point at the start of each color (except the first)
    for (let i = 1; i < sortedColors.length; i++) {
      swapPoints.push(sortedColors[i].firstLayer);
    }

    return swapPoints;
  }

  /**
   * Get unique identifier for this slot
   */
  get slotId(): string {
    return `${this.unitNumber}-${this.slotNumber}`;
  }

  /**
   * Get display name for this slot
   */
  get displayName(): string {
    return `Unit ${this.unitNumber} Slot ${this.slotNumber}`;
  }

  private validate(): void {
    if (this.unitNumber < 1 || this.unitNumber > 16) {
      throw new Error('Unit number must be between 1 and 16');
    }
    if (this.slotNumber < 1 || this.slotNumber > 4) {
      throw new Error('Slot number must be between 1 and 4');
    }
  }
}
