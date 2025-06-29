/**
 * Tool change related type definitions
 */

/**
 * Represents a tool change event
 * Consolidated from ToolChange and ToolChangeData
 */
export interface ToolChange {
  /** The tool being switched from */
  fromTool: string | number;

  /** The tool being switched to */
  toTool: string | number;

  /** Layer number where the change occurs */
  layer: number;

  /** Line number in the G-code file */
  lineNumber?: number;

  /** Z height at the tool change */
  zHeight?: number;

  /** Associated color ID */
  colorId?: string;
}

/**
 * Tool usage statistics
 */
export interface ToolUsageStats {
  toolId: string;
  usageCount: number;
  totalTime?: number;
  colorId?: string;
}
