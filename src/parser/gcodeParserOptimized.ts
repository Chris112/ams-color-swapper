import { GcodeStats } from '../types/gcode';
import { ToolChange } from '../types/tool';
import { LayerColorInfo } from '../types/layer';
import { Color } from '../domain/models/Color';
import { Logger } from '../utils/logger';
import { BrowserFileReader } from '../utils/fileReader';

export class GcodeParserOptimized {
  private logger: Logger;
  private stats: Partial<GcodeStats>;
  private currentLayer: number = 0;
  private currentZ: number = 0;
  private currentTool: string = 'T0';
  private activeTools: Set<string> = new Set(['T0']); // Track all tools that have been used
  private toolChanges: ToolChange[] = [];
  private layerColorMap: Map<number, string[]> = new Map();
  private layerDetails: Map<number, LayerColorInfo> = new Map();
  private layerToolChanges: ToolChange[] = [];
  private colorFirstSeen: Map<string, number> = new Map();
  private colorLastSeen: Map<string, number> = new Map();
  private lineNumber: number = 0;
  private startTime: number = 0;
  private onProgress?: (progress: number, message: string) => void;
  private maxLayerSeen: number = 0;

  constructor(logger?: Logger, onProgress?: (progress: number, message: string) => void) {
    this.logger = logger || new Logger('GcodeParser');
    this.onProgress = onProgress;
    this.stats = {
      toolChanges: [],
      layerColorMap: new Map(),
      layerDetails: [],
      parserWarnings: [],
      colors: [],
    };
  }

  async parse(file: File): Promise<GcodeStats> {
    this.startTime = Date.now();
    this.logger.info(`Starting G-code parse for ${file.name}`);

    if (this.onProgress) {
      this.onProgress(5, 'Reading file...');
    }

    this.stats.fileName = file.name;
    this.stats.fileSize = file.size;
    this.stats.totalLayers = 1; // Initialize with at least 1 layer
    this.stats.totalHeight = 0;

    // Initialize layer 0 with the default tool
    this.layerColorMap.set(0, [this.currentTool]);
    this.updateColorSeen(this.currentTool, 0);
    // Initialize layer 0 details
    this.layerDetails.set(0, {
      layer: 0,
      colors: [this.currentTool],
      primaryColor: this.currentTool,
      toolChangeCount: 0,
      toolChangesInLayer: [],
    });

    // Estimate total lines for progress tracking (approximately 24 bytes per line)
    if (this.onProgress) {
      this.onProgress(10, 'Estimating file size...');
    }
    const estimatedLines = Math.ceil(file.size / 24);
    this.logger.info(
      `Estimated lines to process: ${estimatedLines.toLocaleString()} (based on ${file.size.toLocaleString()} bytes)`
    );

    // Create reader from the original file
    const reader = new BrowserFileReader(file);

    if (this.onProgress) {
      this.onProgress(20, 'Parsing G-code...');
    }
    await this.processLines(reader, estimatedLines);

    const parseTime = Date.now() - this.startTime;
    this.logger.info(`Parse completed in ${parseTime}ms`);

    if (this.onProgress) {
      this.onProgress(85, 'Analyzing colors and calculating statistics...');
    }

    // Update stats with the maximum layer seen
    this.stats.totalLayers = this.maxLayerSeen + 1; // +1 because layers are 0-indexed
    this.logger.silly(
      `Setting totalLayers to ${this.stats.totalLayers} (maxLayerSeen: ${this.maxLayerSeen})`
    );

    // Finalize the last layer's details
    this.finalizeLayerDetails(this.currentLayer);

    // Finalize stats
    this.stats.toolChanges = this.toolChanges;
    this.stats.layerColorMap = this.layerColorMap;

    // Convert layerDetails map to array
    this.stats.layerDetails = Array.from(this.layerDetails.values()).sort(
      (a, b) => a.layer - b.layer
    );

    // Calculate color usage ranges
    this.stats.colorUsageRanges = this.calculateColorUsageRanges();

    // Populate unique colors list
    this.stats.colors = this.extractUniqueColors();

    // Set parse time
    this.stats.parseTime = Date.now() - this.startTime;

    if (this.onProgress) {
      this.onProgress(100, 'Parse complete!');
    }

    return this.stats as GcodeStats;
  }

  private async processLines(reader: BrowserFileReader, totalLines: number): Promise<void> {
    // Update progress every 1% or every 1000 lines, whichever is more frequent
    const progressInterval = Math.max(Math.floor(totalLines / 100), 1000);

    for await (const line of reader.readLines()) {
      this.lineNumber++;
      this.parseLine(line.trim());

      // Report progress periodically with accurate percentage
      if (this.onProgress && this.lineNumber % progressInterval === 0) {
        const progressPercent = (this.lineNumber / totalLines) * 60; // 60% of total progress for line processing
        const totalProgress = Math.min(20 + progressPercent, 80);
        const percentage = Math.min(Math.round((this.lineNumber / totalLines) * 100), 100);
        this.onProgress(
          totalProgress,
          `Processing lines: ${percentage}% (${this.lineNumber.toLocaleString()}/${totalLines.toLocaleString()})`
        );
      }
    }

    // Final update after all lines processed
    if (this.onProgress) {
      this.onProgress(80, `Processed all ${totalLines.toLocaleString()} lines`);
    }
  }

  private parseLine(line: string): void {
    if (!line || line.startsWith(';')) {
      this.parseComment(line);
      return;
    }

    const commandEnd = line.indexOf(' ');
    const command = (commandEnd === -1 ? line : line.substring(0, commandEnd)).toUpperCase();

    switch (command) {
      case 'G0':
      case 'G1':
        this.parseMove(line);
        break;
      case 'M600':
        this.parseFilamentChange(line);
        break;
      case 'T0':
      case 'T1':
      case 'T2':
      case 'T3':
      case 'T4':
      case 'T5':
      case 'T6':
      case 'T7':
        this.parseToolChange(command);
        break;
    }
  }

  private parseComment(line: string) {
    // Handle various layer formats first, as they are the most common
    if (line.includes('layer')) {
      let newLayer: number | null = null;

      // Bambu Lab format: "; layer num/total_layer_count: 1/197"
      let startIndex = line.indexOf('layer num/total_layer_count:');
      if (startIndex !== -1) {
        startIndex += 'layer num/total_layer_count:'.length;
        const endIndex = line.indexOf('/', startIndex);
        if (endIndex !== -1) {
          newLayer = parseInt(line.substring(startIndex, endIndex).trim());
        }
      }
      // Bambu Lab format: "; layer #2"
      else {
        startIndex = line.indexOf('; layer #');
        if (startIndex !== -1) {
          startIndex += '; layer #'.length;
          newLayer = parseInt(line.substring(startIndex).trim());
        }
      }

      // Standard formats
      if (newLayer === null) {
        startIndex = line.indexOf('LAYER:');
        if (startIndex !== -1) {
          startIndex += 'LAYER:'.length;
          newLayer = parseInt(line.substring(startIndex).trim());
        } else {
          startIndex = line.indexOf('layer ');
          if (startIndex !== -1) {
            startIndex += 'layer '.length;
            newLayer = parseInt(line.substring(startIndex).trim());
          }
        }
      }

      if (newLayer !== null && newLayer !== this.currentLayer) {
        // Finalize previous layer details
        this.finalizeLayerDetails(this.currentLayer);

        this.currentLayer = newLayer;
        if (newLayer > this.maxLayerSeen) {
          this.maxLayerSeen = newLayer;
        }

        // Initialize new layer with ALL active tools (color persistence)
        const layerColors = Array.from(this.activeTools);
        this.layerColorMap.set(this.currentLayer, layerColors);

        // Update color seen for all active tools
        for (const tool of this.activeTools) {
          this.updateColorSeen(tool, this.currentLayer);
        }

        // Reset layer tool changes for new layer
        this.layerToolChanges = [];

        // Initialize layer details
        this.layerDetails.set(this.currentLayer, {
          layer: this.currentLayer,
          colors: layerColors,
          primaryColor: this.currentTool,
          toolChangeCount: 0,
          toolChangesInLayer: [],
        });

        this.logger.silly(
          `Layer ${this.currentLayer} - Active tools: ${Array.from(this.activeTools).join(', ')}, Current: ${this.currentTool}`
        );
        return; // Exit early if we found a layer change
      }
    }

    // Extract color definitions for Bambu Lab
    if (line.includes('extruder_colour') || line.includes('filament_colour')) {
      const parts = line.split('=');
      if (parts.length > 1) {
        const colors = parts[1].split(';');
        this.logger.info(`Found ${colors.length} color definitions`);
        // Store color info for later use
        if (!this.stats.slicerInfo) {
          this.stats.slicerInfo = { software: 'Unknown', version: 'Unknown' };
        }
        this.stats.slicerInfo.colorDefinitions = colors;
      }
    }

    // Extract slicer info
    else if (line.includes('generated by')) {
      const generatedByIndex = line.indexOf('generated by ');
      if (generatedByIndex !== -1) {
        const softwareStartIndex = generatedByIndex + 'generated by '.length;
        const versionStartIndex =
          softwareStartIndex + line.substring(softwareStartIndex).indexOf(' ') + 1;
        const software = line.substring(softwareStartIndex, versionStartIndex - 1);
        const version = line.substring(versionStartIndex);

        if (!this.stats.slicerInfo) {
          this.stats.slicerInfo = {
            software: software,
            version: version,
          };
        }
        this.logger.info(`Detected slicer: ${software} v${version}`);
      }
    }

    // Extract print time
    else if (line.includes('total estimated time:')) {
      const timeStartIndex = line.indexOf('total estimated time:') + 'total estimated time:'.length;
      const timeString = line.substring(timeStartIndex).trim();
      const parts = timeString
        .split(/h|m|s/)
        .map((s) => parseInt(s.trim()))
        .filter((n) => !isNaN(n));

      if (parts.length >= 3) {
        const hours = parts[0];
        const minutes = parts[1];
        const seconds = parts[2];
        this.stats.printTime = `${hours}h ${minutes}m ${seconds}s`;
        this.stats.estimatedPrintTime = hours * 3600 + minutes * 60 + seconds;
        this.logger.info(`Total estimated time: ${this.stats.printTime}`);
      }
    }
    // Alternative format
    else if (line.includes('estimated printing time')) {
      const timeStartIndex =
        line.indexOf('estimated printing time') + 'estimated printing time'.length;
      const timeString = line.substring(timeStartIndex).trim();
      const parts = timeString
        .split(/h|m|s/)
        .map((s) => parseInt(s.trim()))
        .filter((n) => !isNaN(n));

      if (parts.length >= 3) {
        const hours = parts[0];
        const minutes = parts[1];
        const seconds = parts[2];
        if (!this.stats.printTime) {
          this.stats.printTime = `${hours}h ${minutes}m ${seconds}s`;
        }
        this.stats.estimatedPrintTime = hours * 3600 + minutes * 60 + seconds;
        this.logger.info(`Estimated print time: ${hours}h ${minutes}m ${seconds}s`);
      }
    }

    // Extract filament cost
    else if (line.includes('filament cost =')) {
      const parts = line.split('=');
      if (parts.length > 1) {
        const costs = parts[1].split(',').map((c) => parseFloat(c.trim()));
        const totalCost = costs.reduce((sum, cost) => sum + cost, 0);
        this.stats.printCost = Math.round(totalCost * 100) / 100; // Round to 2 decimal places
        this.logger.info(`Print cost: ${this.stats.printCost}`);
      }
    }

    // Extract filament usage
    else if (line.includes('filament used [g]')) {
      const parts = line.split('=');
      if (parts.length > 1) {
        const weights = parts[1].split(',').map((w) => parseFloat(w.trim()));
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

        if (!this.stats.filamentUsageStats) {
          this.stats.filamentUsageStats = {
            total: Math.round(totalWeight * 100) / 100,
            model: 0,
            support: 0,
            flushed: 0,
            tower: 0,
          };
        } else {
          this.stats.filamentUsageStats.total = Math.round(totalWeight * 100) / 100;
        }

        // Store per-color filament weights
        if (!this.stats.filamentEstimates) {
          this.stats.filamentEstimates = [];
        }

        // Map weights to tool IDs (T0, T1, T2, etc.)
        weights.forEach((weight, index) => {
          if (weight > 0) {
            const toolId = `T${index}`;
            // Check if we already have an entry for this tool
            const existingEntry = this.stats.filamentEstimates!.find((e) => e.colorId === toolId);
            if (existingEntry) {
              existingEntry.weight = weight;
            } else {
              this.stats.filamentEstimates!.push({
                colorId: toolId,
                length: 0, // We'll update this if we find length data
                weight: weight,
              });
            }
          }
        });

        this.logger.info(`Total filament usage: ${this.stats.filamentUsageStats.total}g`);
        this.logger.info(`Per-color weights: ${weights.map((w, i) => `T${i}: ${w}g`).join(', ')}`);
      }
    }

    // Extract detailed filament usage for model, support, etc.
    else if (line.includes('filament used [g] =') && line.includes('(')) {
      const startIndex = line.indexOf('=') + 1;
      const endIndex = line.indexOf('(', startIndex);
      const total = parseFloat(line.substring(startIndex, endIndex).trim());
      const plusIndex = line.indexOf('+', endIndex);
      const model = parseFloat(line.substring(endIndex + 1, plusIndex).trim());
      const support = parseFloat(
        line.substring(plusIndex + 1, line.indexOf(')', plusIndex)).trim()
      );

      if (!this.stats.filamentUsageStats) {
        this.stats.filamentUsageStats = {
          total: 0,
          model: 0,
          support: 0,
          flushed: 0,
          tower: 0,
        };
      }

      // Update filament usage values
      this.stats.filamentUsageStats.total = total;
      this.stats.filamentUsageStats.model = model;
      this.stats.filamentUsageStats.support = support;
    }

    // Extract flushed filament
    else if (line.includes('flushed material =')) {
      const parts = line.split('=');
      if (parts.length > 1) {
        if (!this.stats.filamentUsageStats) {
          this.stats.filamentUsageStats = {
            total: 0,
            model: 0,
            support: 0,
            flushed: 0,
            tower: 0,
          };
        }
        this.stats.filamentUsageStats.flushed = parseFloat(parts[1].trim());
      }
    }

    // Extract wipe tower filament
    else if (line.includes('wipe tower =')) {
      const parts = line.split('=');
      if (parts.length > 1) {
        if (!this.stats.filamentUsageStats) {
          this.stats.filamentUsageStats = {
            total: 0,
            model: 0,
            support: 0,
            flushed: 0,
            tower: 0,
          };
        }
        this.stats.filamentUsageStats.tower = parseFloat(parts[1].trim());
      }
    }

    // Original filament used parsing for length
    else if (line.includes('filament used') && !line.includes('[g]')) {
      const startIndex = line.indexOf('used') + 'used'.length;
      const endIndex = line.indexOf('mm', startIndex);
      if (startIndex !== -1 && endIndex !== -1) {
        const length = parseFloat(line.substring(startIndex, endIndex).trim());
        if (!this.stats.filamentEstimates) {
          this.stats.filamentEstimates = [];
        }
        this.stats.filamentEstimates.push({
          colorId: this.currentTool,
          length,
        });
      }
    }
  }

  private parseMove(line: string) {
    const zIndex = line.indexOf('Z');
    if (zIndex !== -1) {
      const spaceIndex = line.indexOf(' ', zIndex);
      const zValueStr =
        spaceIndex !== -1 ? line.substring(zIndex + 1, spaceIndex) : line.substring(zIndex + 1);
      const newZ = parseFloat(zValueStr);
      if (!isNaN(newZ) && newZ > this.currentZ) {
        this.currentZ = newZ;
        if (!this.stats.totalHeight || newZ > this.stats.totalHeight) {
          this.stats.totalHeight = newZ;
        }
      }
    }
  }

  private parseFilamentChange(_line: string) {
    this.logger.warn(
      `Manual filament change detected at layer ${this.currentLayer}, line ${this.lineNumber}`
    );
    this.stats.parserWarnings?.push(
      `M600 filament change at layer ${this.currentLayer} (line ${this.lineNumber})`
    );
  }

  private parseToolChange(tool: string) {
    if (tool !== this.currentTool) {
      const change: ToolChange = {
        fromTool: this.currentTool,
        toTool: tool,
        layer: this.currentLayer,
        lineNumber: this.lineNumber,
        zHeight: this.currentZ,
      };

      this.toolChanges.push(change);
      this.layerToolChanges.push(change);
      this.logger.silly(`Tool change: ${this.currentTool} → ${tool} at layer ${this.currentLayer}`);

      this.currentTool = tool;

      // Track this tool as active (used in the print)
      this.activeTools.add(tool);

      // Add new color to current layer if not already present
      const layerColors = this.layerColorMap.get(this.currentLayer) || [];
      if (!layerColors.includes(tool)) {
        layerColors.push(tool);
        this.layerColorMap.set(this.currentLayer, layerColors);
      }

      // Update layer details
      const layerDetail = this.layerDetails.get(this.currentLayer);
      if (layerDetail && !layerDetail.colors.includes(tool)) {
        layerDetail.colors.push(tool);
      }

      this.updateColorSeen(tool, this.currentLayer);
    }
  }

  private updateColorSeen(tool: string, layer: number) {
    if (!this.colorFirstSeen.has(tool)) {
      this.colorFirstSeen.set(tool, layer);
    }
    this.colorLastSeen.set(tool, layer);
  }

  private finalizeLayerDetails(layer: number) {
    const layerDetail = this.layerDetails.get(layer);
    if (layerDetail) {
      layerDetail.toolChangesInLayer = [...this.layerToolChanges];
      layerDetail.toolChangeCount = this.layerToolChanges.length;

      // Determine primary color (most used in layer)
      // For now, we'll use the first color, but this could be enhanced
      // to track actual usage within the layer
      if (layerDetail.colors.length > 0) {
        layerDetail.primaryColor = layerDetail.colors[0];
      }
    }
  }

  private calculateColorUsageRanges() {
    const ranges: Array<{
      colorId: string;
      startLayer: number;
      endLayer: number;
      continuous: boolean;
    }> = [];
    const colorRanges = new Map<string, { start: number; end: number }>();

    // Build continuous ranges for each color
    this.colorFirstSeen.forEach((firstLayer, color) => {
      const lastLayer = this.colorLastSeen.get(color) || firstLayer;
      colorRanges.set(color, { start: firstLayer, end: lastLayer });
    });

    // Convert to ColorRange format
    colorRanges.forEach((range, colorId) => {
      ranges.push({
        colorId,
        startLayer: range.start,
        endLayer: range.end,
        continuous: this.isColorContinuous(colorId, range.start, range.end),
      });
    });

    return ranges;
  }

  private isColorContinuous(colorId: string, startLayer: number, endLayer: number): boolean {
    // Check if color appears in every layer between start and end
    for (let layer = startLayer; layer <= endLayer; layer++) {
      const layerColors = this.layerColorMap.get(layer);
      if (!layerColors || !layerColors.includes(colorId)) {
        return false;
      }
    }
    return true;
  }

  private extractUniqueColors(): Color[] {
    const uniqueColors = new Set<string>();
    const layersUsedByColor = new Map<string, Set<number>>();

    // Collect unique colors and track which layers they appear in
    this.layerColorMap.forEach((colors, layer) => {
      colors.forEach((color) => {
        uniqueColors.add(color);
        if (!layersUsedByColor.has(color)) {
          layersUsedByColor.set(color, new Set());
        }
        layersUsedByColor.get(color)!.add(layer);
      });
    });

    return Array.from(uniqueColors).map((colorId) => {
      const layersUsed = layersUsedByColor.get(colorId) || new Set();
      const sortedLayers = Array.from(layersUsed).sort((a, b) => a - b);

      return new Color({
        id: colorId,
        name: colorId,
        hexValue: this.getColorHex(colorId),
        firstLayer: sortedLayers[0] || 0,
        lastLayer: sortedLayers[sortedLayers.length - 1] || 0,
        layersUsed: layersUsed,
        partialLayers: new Set(), // We don't track partial layers in this parser
        totalLayers: this.stats.totalLayers,
      });
    });
  }

  private getColorHex(colorId: string): string {
    // Extract color hex from slicer info if available
    if (this.stats.slicerInfo?.colorDefinitions) {
      const toolIndex = parseInt(colorId.substring(1));
      if (toolIndex < this.stats.slicerInfo.colorDefinitions.length) {
        const color = this.stats.slicerInfo.colorDefinitions[toolIndex].trim();
        // Ensure color has # prefix
        return color.startsWith('#') ? color : `#${color}`;
      }
    }

    // Default color palette
    const defaultColors = [
      '#FF0000', // Red
      '#00FF00', // Green
      '#0000FF', // Blue
      '#FFFF00', // Yellow
      '#FF00FF', // Magenta
      '#00FFFF', // Cyan
      '#FFA500', // Orange
      '#800080', // Purple
    ];

    const index = parseInt(colorId.substring(1)) % defaultColors.length;
    return defaultColors[index];
  }
}
