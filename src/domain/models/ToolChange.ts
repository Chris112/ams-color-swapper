/**
 * Domain model representing a tool/filament change in 3D printing
 */
export class ToolChange {
  constructor(
    public readonly fromTool: string,
    public readonly toTool: string,
    public readonly layer: number,
    public readonly lineNumber: number,
    public readonly zHeight?: number
  ) {
    this.validate();
  }

  /**
   * Check if this is a change from a specific tool
   */
  isFromTool(toolId: string): boolean {
    return this.fromTool === toolId;
  }

  /**
   * Check if this is a change to a specific tool
   */
  isToTool(toolId: string): boolean {
    return this.toTool === toolId;
  }

  /**
   * Check if this involves a specific tool (either from or to)
   */
  involvesTool(toolId: string): boolean {
    return this.isFromTool(toolId) || this.isToTool(toolId);
  }

  /**
   * Get a human-readable description
   */
  get description(): string {
    const height = this.zHeight ? ` at Z=${this.zHeight.toFixed(2)}mm` : '';
    return `Change from ${this.fromTool} to ${this.toTool} at layer ${this.layer}${height}`;
  }

  /**
   * Create from raw data
   */
  static fromData(data: {
    fromTool: string;
    toTool: string;
    layer: number;
    lineNumber: number;
    zHeight?: number;
  }): ToolChange {
    return new ToolChange(data.fromTool, data.toTool, data.layer, data.lineNumber, data.zHeight);
  }

  private validate(): void {
    if (!this.fromTool) {
      throw new Error('From tool is required');
    }
    if (!this.toTool) {
      throw new Error('To tool is required');
    }
    if (this.layer < 0) {
      throw new Error('Layer must be non-negative');
    }
    if (this.lineNumber < 0) {
      throw new Error('Line number must be non-negative');
    }
    if (this.zHeight !== undefined && this.zHeight < 0) {
      throw new Error('Z height must be non-negative');
    }
  }
}
