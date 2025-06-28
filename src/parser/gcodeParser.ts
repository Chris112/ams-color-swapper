import { GcodeStats, ToolChange, LayerColorInfo } from '../types';
import { Logger } from '../utils/logger';
import { BrowserFileReader } from '../utils/fileReader';
import { calculateStatistics } from './statistics';

export class GcodeParser {
  private logger: Logger;
  private stats: Partial<GcodeStats>;
  private currentLayer: number = 0;
  private currentZ: number = 0;
  private currentTool: string = 'T0';
  private activeTools: Set<string> = new Set(['T0']); // Track all tools that have been used
  private toolChanges: ToolChange[] = [];
  private layerColorMap: Map<number, string[]> = new Map();
  private colorFirstSeen: Map<string, number> = new Map();
  private colorLastSeen: Map<string, number> = new Map();
  private layerDetails: Map<number, LayerColorInfo> = new Map();
  private layerToolChanges: ToolChange[] = []; // Tool changes in current layer
  private lineNumber: number = 0;
  private startTime: number = 0;
  private onProgress?: (progress: number, message: string) => void;

  constructor(logger?: Logger, onProgress?: (progress: number, message: string) => void) {
    this.logger = logger || new Logger('GcodeParser');
    this.onProgress = onProgress;
    this.stats = {
      toolChanges: [],
      layerColorMap: new Map(),
      parserWarnings: [],
      colors: [],
      layerDetails: [],
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
    this.initializeLayer(0);
    this.addColorToLayer(0, this.currentTool);
    this.updateColorSeen(this.currentTool, 0);

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

    // Finalize the last layer
    if (this.currentLayer >= 0) {
      this.updateLayerDetails(this.currentLayer);
    }

    const completeStats = await calculateStatistics(
      this.stats as GcodeStats,
      this.toolChanges,
      this.layerColorMap,
      this.colorFirstSeen,
      this.colorLastSeen,
      Array.from(this.layerDetails.values()),
      parseTime
    );

    if (this.onProgress) {
      this.onProgress(95, 'Finalizing analysis...');
    }

    // Load raw content for geometry parsing if needed
    if (!this.stats.rawContent) {
      if (this.onProgress) {
        this.onProgress(90, 'Loading content for geometry parsing...');
      }
      this.stats.rawContent = await file.text();
      completeStats.rawContent = this.stats.rawContent;
    }

    // Ensure we have at least basic data
    if (!completeStats.colors || completeStats.colors.length === 0) {
      // Add default color if none found
      const { Color } = await import('../domain/models/Color');
      completeStats.colors = [
        new Color({
          id: 'T0',
          name: 'Default Color',
          hexValue: '#888888',
          firstLayer: 0,
          lastLayer: completeStats.totalLayers - 1,
          layersUsed: new Set(Array.from({ length: completeStats.totalLayers }, (_, i) => i)),
          partialLayers: new Set(),
          totalLayers: completeStats.totalLayers,
        }),
      ];
    }

    // Log analysis summary
    this.logger.info('G-code Analysis Summary', {
      fileName: file.name,
      parseTime: `${parseTime}ms`,
      totalLayers: completeStats.totalLayers,
      totalHeight: `${completeStats.totalHeight}mm`,
      uniqueColors: completeStats.colors.length,
      toolChanges: completeStats.toolChanges?.length || 0,
      filamentUsage: completeStats.filamentUsageStats?.total
        ? `${completeStats.filamentUsageStats.total.toFixed(2)}mm`
        : 'N/A',
      printTime: completeStats.printTime || 'N/A',
    });

    // Log color details
    completeStats.colors.forEach((color, index) => {
      this.logger.info(`Color ${index + 1}`, {
        id: color.id,
        name: color.name,
        hex: color.hexValue,
        usage: `${color.usagePercentage?.toFixed(2)}%`,
        layers: `${color.firstLayer}-${color.lastLayer}`,
        layerCount: color.layerCount,
        layersUsed: Array.from(color.layersUsed || []).length,
      });
    });

    // Log layer-by-layer color breakdown (first 10 layers for debugging)
    this.logger.debug('Layer-by-layer color breakdown:');
    for (let i = 0; i <= Math.min(10, completeStats.totalLayers - 1); i++) {
      const layerColors = completeStats.layerColorMap.get(i) || [];
      this.logger.debug(`Layer ${i}: [${layerColors.join(', ')}]`);
    }
    if (completeStats.totalLayers > 11) {
      this.logger.debug(`... (showing first 10 layers of ${completeStats.totalLayers} total)`);
    }

    // Log optimization potential
    if (completeStats.colors.length > 4) {
      this.logger.info(
        `Optimization needed: ${completeStats.colors.length} colors detected, but AMS only has 4 slots`
      );
    }

    return completeStats;
  }

  private async processLines(reader: BrowserFileReader, totalLines: number): Promise<void> {
    // Update progress every 1% or every 1000 lines, whichever is more frequent
    const progressInterval = Math.max(Math.floor(totalLines / 100), 1000);

    for await (const line of reader.readLines()) {
      this.lineNumber++;
      await this.parseLine(line.trim());

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

  private async parseLine(line: string): Promise<void> {
    if (!line || line.startsWith(';')) {
      this.parseComment(line);
      return;
    }

    const command = line.split(' ')[0].toUpperCase();

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
    // Extract color definitions for Bambu Lab
    if (line.includes('extruder_colour') || line.includes('filament_colour')) {
      const colorMatch = line.match(/= (.+)/);
      if (colorMatch) {
        const colors = colorMatch[1].split(';').map((c) => c.trim());
        this.logger.info(`Found ${colors.length} color definitions`);
        // Store color info for later use
        if (!this.stats.slicerInfo) {
          this.stats.slicerInfo = { software: 'Unknown', version: 'Unknown' };
        }
        this.stats.slicerInfo.colorDefinitions = colors;
      }
    }

    if (line.includes('generated by')) {
      const slicerMatch = line.match(/generated by (.+?) ([\d.]+)/i);
      if (slicerMatch) {
        if (!this.stats.slicerInfo) {
          this.stats.slicerInfo = {
            software: slicerMatch[1],
            version: slicerMatch[2],
          };
        }
        this.logger.info(`Detected slicer: ${slicerMatch[1]} v${slicerMatch[2]}`);
      }
    }

    // Handle various layer formats
    let layerMatch = null;

    // Bambu Lab format: "; layer num/total_layer_count: 1/197"
    if (line.includes('layer num/total_layer_count:')) {
      layerMatch = line.match(/layer num\/total_layer_count:\s*(\d+)/);
    }
    // Bambu Lab format: "; layer #2"
    else if (line.includes('; layer #')) {
      layerMatch = line.match(/; layer #(\d+)/);
    }
    // Standard formats
    else if (line.includes('LAYER:') || line.includes('layer ')) {
      layerMatch = line.match(/(?:LAYER:|layer )\s*(\d+)/i);
    }

    if (layerMatch) {
      const newLayer = parseInt(layerMatch[1]);
      if (newLayer !== this.currentLayer) {
        // Finalize previous layer details
        if (this.currentLayer >= 0) {
          this.updateLayerDetails(this.currentLayer);
        }

        // Start new layer
        this.currentLayer = newLayer;
        this.layerToolChanges = []; // Reset tool changes for new layer
        this.initializeLayer(this.currentLayer);

        // Add ALL active tools to this layer (they all contribute to the layer)
        // This ensures colors persist across layers even without explicit tool changes
        for (const tool of this.activeTools) {
          this.addColorToLayer(this.currentLayer, tool);
          this.updateColorSeen(tool, this.currentLayer);
        }

        this.logger.silly(
          `Layer ${this.currentLayer} - Active tools: ${Array.from(this.activeTools).join(', ')}, Current: ${this.currentTool}`
        );
      }
    }

    // Extract print time from comments like "; total estimated time: 5h 41m 9s"
    if (line.includes('total estimated time:')) {
      const timeMatch = line.match(/total estimated time:\s*(\d+)h\s*(\d+)m\s*(\d+)s/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseInt(timeMatch[3]);
        this.stats.printTime = `${hours}h ${minutes}m ${seconds}s`;
        this.stats.estimatedPrintTime = hours * 3600 + minutes * 60 + seconds;
        this.logger.info(`Total estimated time: ${this.stats.printTime}`);
      }
    }
    // Alternative format
    else if (line.includes('estimated printing time')) {
      const timeMatch = line.match(/(\d+)h\s*(\d+)m\s*(\d+)s/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseInt(timeMatch[3]);
        if (!this.stats.printTime) {
          this.stats.printTime = `${hours}h ${minutes}m ${seconds}s`;
        }
        this.stats.estimatedPrintTime = hours * 3600 + minutes * 60 + seconds;
        this.logger.info(`Estimated print time: ${hours}h ${minutes}m ${seconds}s`);
      }
    }

    // Extract filament cost from comments like "; filament cost = 0.95, 1.11, 0.03, 0.36, 0.00, 0.00"
    if (line.includes('filament cost =')) {
      const costMatch = line.match(/filament cost = (.+)/);
      if (costMatch) {
        const costs = costMatch[1].split(',').map((c) => parseFloat(c.trim()));
        const totalCost = costs.reduce((sum, cost) => sum + cost, 0);
        this.stats.printCost = Math.round(totalCost * 100) / 100; // Round to 2 decimal places
        this.logger.info(`Print cost: $${this.stats.printCost}`);
      }
    }

    // Extract filament usage from comments like "; filament used [g] = 37.57, 43.70, 1.04, 14.22, 0.00, 0.00"
    if (line.includes('filament used [g]')) {
      const usageMatch = line.match(/filament used \[g\] = (.+)/);
      if (usageMatch) {
        const weights = usageMatch[1].split(',').map((w) => parseFloat(w.trim()));
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
    // Format: "; filament used [g] = 21.10 (21.10+0.00)"
    if (line.includes('filament used [g] =') && line.includes('(')) {
      const detailMatch = line.match(/filament used \[g\] = ([\d.]+) \(([\d.]+)\+([\d.]+)\)/);
      if (detailMatch) {
        const total = parseFloat(detailMatch[1]);
        const model = parseFloat(detailMatch[2]);
        const support = parseFloat(detailMatch[3]);

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
    }

    // Extract flushed filament: "; flushed material = 60.64"
    if (line.includes('flushed material =')) {
      const flushedMatch = line.match(/flushed material = ([\d.]+)/);
      if (flushedMatch) {
        if (!this.stats.filamentUsageStats) {
          this.stats.filamentUsageStats = {
            total: 0,
            model: 0,
            support: 0,
            flushed: 0,
            tower: 0,
          };
        }
        this.stats.filamentUsageStats.flushed = parseFloat(flushedMatch[1]);
      }
    }

    // Extract wipe tower filament: "; wipe tower = 14.19"
    if (line.includes('wipe tower =')) {
      const towerMatch = line.match(/wipe tower = ([\d.]+)/);
      if (towerMatch) {
        if (!this.stats.filamentUsageStats) {
          this.stats.filamentUsageStats = {
            total: 0,
            model: 0,
            support: 0,
            flushed: 0,
            tower: 0,
          };
        }
        this.stats.filamentUsageStats.tower = parseFloat(towerMatch[1]);
      }
    }

    // Original filament used parsing for length
    if (line.includes('filament used') && !line.includes('[g]')) {
      const filamentMatch = line.match(/filament used.*?(\d+\.?\d*)\s*mm/i);
      if (filamentMatch) {
        const length = parseFloat(filamentMatch[1]);
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
    const zMatch = line.match(/Z([\d.]+)/);
    if (zMatch) {
      const newZ = parseFloat(zMatch[1]);
      if (newZ > this.currentZ) {
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

      // Add the new tool to the current layer's color list
      this.addColorToLayer(this.currentLayer, tool);
      this.updateColorSeen(tool, this.currentLayer);
    }
  }

  private updateColorSeen(tool: string, layer: number) {
    if (!this.colorFirstSeen.has(tool)) {
      this.colorFirstSeen.set(tool, layer);
    }
    this.colorLastSeen.set(tool, layer);
  }

  private initializeLayer(layer: number) {
    if (!this.layerColorMap.has(layer)) {
      this.layerColorMap.set(layer, []);
    }
    if (!this.layerDetails.has(layer)) {
      this.layerDetails.set(layer, {
        layer,
        colors: [],
        primaryColor: this.currentTool,
        toolChangeCount: 0,
        toolChangesInLayer: [],
      });
    }
  }

  private addColorToLayer(layer: number, tool: string) {
    const colors = this.layerColorMap.get(layer) || [];
    if (!colors.includes(tool)) {
      colors.push(tool);
      this.layerColorMap.set(layer, colors);

      const layerInfo = this.layerDetails.get(layer);
      if (layerInfo) {
        layerInfo.colors = [...colors];
        layerInfo.primaryColor = colors[0]; // First color is primary for now
      }
    }
  }

  private updateLayerDetails(layer: number) {
    const layerInfo = this.layerDetails.get(layer);
    if (layerInfo) {
      layerInfo.toolChangesInLayer = [...this.layerToolChanges];
      layerInfo.toolChangeCount = this.layerToolChanges.length;
      // Primary color is the most recent tool (last one used in layer)
      layerInfo.primaryColor = this.currentTool;
    }
  }
}
