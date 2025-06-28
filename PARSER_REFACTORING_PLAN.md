# Parser Refactoring Plan: Base Class & Improved Color Tracking

## Overview

This plan addresses two key issues:

1. **Multiple parser implementations** (8 variants) with duplicated code
2. **Inaccurate timeline visualization** for multi-color prints where multiple colors are used within single layers

## Current State

### Parser Architecture

- **Factory Pattern**: Already implemented in `parserFactory.ts`
- **Parser Types**: `ParserAlgorithm` type defined in `AmsConfiguration.ts`
- **Common Interface**: `IGcodeParser` with `parse(file: File): Promise<any>`
- **8 Parser Variants**:
  - Original (`GcodeParser`)
  - Optimized (`GcodeParserOptimized`)
  - Buffer (`GcodeParserBuffer`)
  - Streams (`GcodeParserStreams`)
  - Regex (`GcodeParserRegex`)
  - FSM (`GcodeParserFSM`)
  - Worker (`GcodeParserWorker`)
  - Lazy (`GcodeParserLazy`)

### Current Color Tracking Limitation

All parsers use the same data structure:

```typescript
layerColorMap: Map<number, string>; // Only ONE color per layer
```

This causes the timeline to show misleading visualizations where one color appears to dominate when in reality multiple colors swap within layers.

## Proposed Solution

### Phase 1: Create Abstract Base Parser Class

#### 1.1 Base Class Definition

Create `src/parser/BaseGcodeParser.ts`:

```typescript
import { GcodeStats, ToolChange, ColorSegment } from '../types';
import { Logger } from '../utils/logger';
import { calculateStatistics } from './statistics';

export abstract class BaseGcodeParser implements IGcodeParser {
  protected logger: Logger;
  protected stats: Partial<GcodeStats>;
  protected currentLayer: number = 0;
  protected maxLayerSeen: number = 0;
  protected currentZ: number = 0;
  protected currentTool: string = 'T0';
  protected toolChanges: ToolChange[] = [];
  protected lineNumber: number = 0;
  protected startTime: number = 0;
  protected onProgress?: (progress: number, message: string) => void;

  // NEW: Enhanced color tracking
  protected layerColorSegments: Map<number, ColorSegment[]> = new Map();
  protected currentLayerStartLine: number = 0;

  // Legacy support (computed from segments)
  protected get layerColorMap(): Map<number, string> {
    const map = new Map<number, string>();
    this.layerColorSegments.forEach((segments, layer) => {
      if (segments.length > 0) {
        map.set(layer, segments[0].tool);
      }
    });
    return map;
  }

  // Color tracking for statistics
  protected colorFirstSeen: Map<string, number> = new Map();
  protected colorLastSeen: Map<string, number> = new Map();

  constructor(logger?: Logger, onProgress?: (progress: number, message: string) => void) {
    this.logger = logger || new Logger('GcodeParser');
    this.onProgress = onProgress;
    this.stats = {
      toolChanges: [],
      layerColorMap: new Map(),
      parserWarnings: [],
      colors: [],
    };
  }

  // Abstract method that each parser must implement
  abstract parse(file: File): Promise<GcodeStats>;

  // Common methods available to all parsers
  protected initializeParsing(file: File): void {
    this.startTime = Date.now();
    this.stats.fileName = file.name;
    this.stats.fileSize = file.size;
    this.stats.totalLayers = 1;
    this.stats.totalHeight = 0;

    // Initialize layer 0
    this.recordColorSegment(this.currentTool, 0, 0);
    this.updateColorSeen(this.currentTool, 0);
  }

  protected handleLayerChange(newLayer: number): void {
    if (newLayer !== this.currentLayer) {
      // Close the current segment if any
      this.closeCurrentSegment();

      this.currentLayer = newLayer;
      this.currentLayerStartLine = this.lineNumber;

      if (newLayer > this.maxLayerSeen) {
        this.maxLayerSeen = newLayer;
      }

      // Start new segment for current tool
      this.recordColorSegment(this.currentTool, this.currentLayer, this.lineNumber);
      this.updateColorSeen(this.currentTool, this.currentLayer);

      this.logger.silly(`Layer ${this.currentLayer} - Tool: ${this.currentTool}`);
    }
  }

  protected handleToolChange(newTool: string): void {
    if (newTool !== this.currentTool) {
      // Close current segment
      this.closeCurrentSegment();

      const change: ToolChange = {
        fromTool: this.currentTool,
        toTool: newTool,
        layer: this.currentLayer,
        lineNumber: this.lineNumber,
        zHeight: this.currentZ,
      };

      this.toolChanges.push(change);
      this.logger.silly(
        `Tool change: ${this.currentTool} → ${newTool} at layer ${this.currentLayer}`
      );

      this.currentTool = newTool;

      // Start new segment
      this.recordColorSegment(this.currentTool, this.currentLayer, this.lineNumber);
      this.updateColorSeen(this.currentTool, this.currentLayer);
    }
  }

  protected recordColorSegment(tool: string, layer: number, startLine: number): void {
    let segments = this.layerColorSegments.get(layer);
    if (!segments) {
      segments = [];
      this.layerColorSegments.set(layer, segments);
    }

    segments.push({
      tool,
      startLine,
      endLine: undefined, // Will be set when segment closes
      estimatedProgress: 0, // Will be calculated later
    });
  }

  protected closeCurrentSegment(): void {
    const segments = this.layerColorSegments.get(this.currentLayer);
    if (segments && segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      if (!lastSegment.endLine) {
        lastSegment.endLine = this.lineNumber;
      }
    }
  }

  protected updateColorSeen(tool: string, layer: number): void {
    if (!this.colorFirstSeen.has(tool)) {
      this.colorFirstSeen.set(tool, layer);
    }
    this.colorLastSeen.set(tool, layer);
  }

  protected async finalizeParsing(): Promise<GcodeStats> {
    // Close any open segments
    this.closeCurrentSegment();

    const parseTime = Date.now() - this.startTime;
    this.logger.info(`Parse completed in ${parseTime}ms`);

    // Update stats
    this.stats.totalLayers = this.maxLayerSeen + 1;

    // Calculate segment progress within layers
    this.calculateSegmentProgress();

    const completeStats = await calculateStatistics(
      this.stats as GcodeStats,
      this.toolChanges,
      this.layerColorMap, // Legacy support
      this.colorFirstSeen,
      this.colorLastSeen,
      parseTime,
      this.layerColorSegments // NEW parameter
    );

    return completeStats;
  }

  private calculateSegmentProgress(): void {
    this.layerColorSegments.forEach((segments, layer) => {
      if (segments.length === 0) return;

      const layerStartLine = segments[0].startLine;
      const layerEndLine = segments[segments.length - 1].endLine || this.lineNumber;
      const layerLines = layerEndLine - layerStartLine;

      segments.forEach((segment) => {
        const segmentStart = segment.startLine - layerStartLine;
        const segmentEnd = (segment.endLine || layerEndLine) - layerStartLine;
        segment.estimatedProgress = segmentStart / layerLines;
      });
    });
  }
}
```

#### 1.2 Update Type Definitions

Add to `src/types/index.ts`:

```typescript
export interface ColorSegment {
  tool: string;
  startLine: number;
  endLine?: number;
  estimatedProgress: number; // 0-1 representing position within the layer
}

export interface GcodeStats {
  // ... existing fields ...
  layerColorSegments?: Map<number, ColorSegment[]>; // NEW
}
```

### Phase 2: Refactor Parser Variants

Each parser variant will be simplified to extend the base class. Example for `GcodeParserOptimized`:

```typescript
export class GcodeParserOptimized extends BaseGcodeParser {
  async parse(file: File): Promise<GcodeStats> {
    this.initializeParsing(file);

    if (this.onProgress) {
      this.onProgress(5, 'Reading file...');
    }

    const reader = new BrowserFileReader(file);
    await this.processLines(reader, estimatedLines);

    return this.finalizeParsing();
  }

  private async processLines(reader: BrowserFileReader, totalLines: number): Promise<void> {
    for await (const line of reader.readLines()) {
      this.lineNumber++;
      this.parseLine(line.trim());
      // Progress reporting...
    }
  }

  private parseLine(line: string): void {
    // Parsing logic specific to this variant
    // Calls parent methods like:
    // - this.handleLayerChange(newLayer)
    // - this.handleToolChange(tool)
  }
}
```

### Phase 3: Update Timeline Visualization

#### 3.1 Enhanced Timeline Rendering

Update `ResultsView.ts` to use the new color segment data:

```typescript
private drawEnhancedTimeline(): void {
  const canvas = document.getElementById('colorTimeline') as HTMLCanvasElement;
  const stats = this.state.stats;

  if (!stats.layerColorSegments) {
    // Fallback to old rendering
    this.drawColorTimeline();
    return;
  }

  // Clear canvas
  const ctx = canvas.getContext('2d');

  // For each layer, draw multiple color segments
  const layerWidth = canvas.width / stats.totalLayers;

  stats.layerColorSegments.forEach((segments, layer) => {
    const x = layer * layerWidth;

    segments.forEach((segment, index) => {
      const color = stats.colors.find(c => c.id === segment.tool);
      const segmentHeight = barHeight / segments.length; // Stack vertically
      const y = barY + (index * segmentHeight);

      // Draw segment
      ctx.fillStyle = color?.hexColor || '#888';
      ctx.fillRect(x, y, layerWidth, segmentHeight);
    });
  });
}
```

#### 3.2 Alternative Visualization Options

1. **Stacked Bar Chart**: Show actual filament usage per color
2. **Density Heatmap**: Color intensity based on swap frequency
3. **Split Timeline**: Top bar for active color, bottom bar for swap indicators

### Phase 4: Update Statistics Calculation

Modify `calculateStatistics` to accept and use the new segment data:

```typescript
export async function calculateStatistics(
  partialStats: GcodeStats,
  toolChanges: ToolChange[],
  layerColorMap: Map<number, string>,
  colorFirstSeen: Map<string, number>,
  colorLastSeen: Map<string, number>,
  parseTime: number,
  layerColorSegments?: Map<number, ColorSegment[]> // NEW
): Promise<GcodeStats> {
  // Enhanced statistics using segment data
  if (layerColorSegments) {
    // Calculate more accurate usage percentages
    // Track color swap frequency
    // Identify high-swap layers
  }

  // ... existing logic ...
}
```

## Implementation Order

1. **Week 1**: Create base class and update type definitions
2. **Week 1-2**: Refactor 2-3 parser variants as proof of concept
3. **Week 2**: Update remaining parsers
4. **Week 3**: Implement enhanced timeline visualization
5. **Week 3-4**: Testing and optimization

## Benefits

1. **Code Reusability**: ~70% reduction in duplicated code across parsers
2. **Accurate Visualization**: Timeline will show true color distribution
3. **Maintainability**: Single point for bug fixes and improvements
4. **Extensibility**: Easy to add new parser variants
5. **Performance**: No impact on parsing speed, visualization updates are client-side

## Backward Compatibility

- Legacy `layerColorMap` computed from segments for compatibility
- Existing visualization falls back if no segment data
- No changes to public API or file format

## Testing Strategy

1. Unit tests for base class methods
2. Integration tests for each parser variant
3. Visual regression tests for timeline rendering
4. Performance benchmarks to ensure no degradation

## Future Enhancements

1. **Time-based segments**: Use actual print time estimates instead of line numbers
2. **Volume tracking**: Calculate actual filament volume per segment
3. **Real-time preview**: Show color changes as file is being parsed
4. **Export segments**: Allow users to export detailed color usage data
