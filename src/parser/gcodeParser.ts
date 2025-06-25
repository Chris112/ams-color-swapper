import { GcodeStats, ToolChange } from '../types';
import { Logger } from '../utils/logger';
import { BrowserFileReader } from '../utils/fileReader';
import { calculateStatistics } from './statistics';

export class GcodeParser {
  private logger: Logger;
  private stats: Partial<GcodeStats>;
  private currentLayer: number = 0;
  private currentZ: number = 0;
  private currentTool: string = 'T0';
  private toolChanges: ToolChange[] = [];
  private layerColorMap: Map<number, string> = new Map();
  private colorFirstSeen: Map<string, number> = new Map();
  private colorLastSeen: Map<string, number> = new Map();
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
    };
  }

  async parse(file: File): Promise<GcodeStats> {
    this.startTime = Date.now();
    this.logger.info(`Starting G-code parse for ${file.name}`);
    
    if (this.onProgress) {
      this.onProgress(10, 'Reading file...');
    }

    this.stats.fileName = file.name;
    this.stats.fileSize = file.size;
    this.stats.totalLayers = 1; // Initialize with at least 1 layer
    this.stats.totalHeight = 0;

    // Initialize layer 0 with the default tool
    this.layerColorMap.set(0, this.currentTool);
    this.updateColorSeen(this.currentTool, 0);

    const reader = new BrowserFileReader(file);
    
    // Store raw content for geometry parsing
    if (this.onProgress) {
      this.onProgress(20, 'Loading file content...');
    }
    this.stats.rawContent = await file.text();

    if (this.onProgress) {
      this.onProgress(30, 'Parsing G-code...');
    }
    await this.processLines(reader);

    const parseTime = Date.now() - this.startTime;
    this.logger.info(`Parse completed in ${parseTime}ms`);
    
    if (this.onProgress) {
      this.onProgress(85, 'Analyzing colors...');
    }

    const completeStats = await calculateStatistics(
      this.stats as GcodeStats,
      this.toolChanges,
      this.layerColorMap,
      this.colorFirstSeen,
      this.colorLastSeen,
      parseTime
    );

    // Ensure we have at least basic data
    if (!completeStats.colors || completeStats.colors.length === 0) {
      // Add default color if none found
      completeStats.colors = [{
        id: 'T0',
        name: 'Default Color',
        hexColor: '#888888',
        firstLayer: 0,
        lastLayer: completeStats.totalLayers - 1,
        layerCount: completeStats.totalLayers,
        usagePercentage: 100
      }];
    }

    // Log analysis summary
    this.logger.info('G-code Analysis Summary', {
      fileName: file.name,
      parseTime: `${parseTime}ms`,
      totalLayers: completeStats.totalLayers,
      totalHeight: `${completeStats.totalHeight}mm`,
      uniqueColors: completeStats.colors.length,
      toolChanges: completeStats.toolChanges?.length || 0,
      filamentUsage: completeStats.filamentUsage?.total ? `${completeStats.filamentUsage.total.toFixed(2)}mm` : 'N/A',
      printTime: completeStats.printTime || 'N/A'
    });
    
    // Log color details
    completeStats.colors.forEach((color, index) => {
      this.logger.info(`Color ${index + 1}`, {
        id: color.id,
        name: color.name,
        hex: color.hexColor,
        usage: `${color.usagePercentage?.toFixed(2)}%`,
        layers: `${color.firstLayer}-${color.lastLayer}`,
        layerCount: color.layerCount
      });
    });
    
    // Log optimization potential
    if (completeStats.colors.length > 4) {
      this.logger.info(`Optimization needed: ${completeStats.colors.length} colors detected, but AMS only has 4 slots`);
    }

    return completeStats;
  }

  private async processLines(reader: BrowserFileReader): Promise<void> {
    // Estimate total lines based on file size (rough estimate: 50 bytes per line average)
    const estimatedLines = Math.max(Math.floor(this.stats.fileSize! / 50), 1000);
    let progressInterval = Math.max(Math.floor(estimatedLines / 20), 100); // Update every 5%
    
    for await (const line of reader.readLines()) {
      this.lineNumber++;
      await this.parseLine(line.trim());
      
      // Report progress periodically
      if (this.onProgress && this.lineNumber % progressInterval === 0) {
        const progress = Math.min(30 + Math.floor((this.lineNumber / estimatedLines) * 50), 80);
        this.onProgress(progress, `Processing line ${this.lineNumber.toLocaleString()}...`);
      }
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
        const colors = colorMatch[1].split(';');
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
        this.currentLayer = newLayer;
        this.layerColorMap.set(this.currentLayer, this.currentTool);
        this.updateColorSeen(this.currentTool, this.currentLayer);
        this.logger.silly(`Layer ${this.currentLayer} - Tool: ${this.currentTool}`);
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

        if (!this.stats.filamentUsage) {
          this.stats.filamentUsage = {
            total: Math.round(totalWeight * 100) / 100,
            model: 0,
            support: 0,
            flushed: 0,
            tower: 0,
          };
        } else {
          this.stats.filamentUsage.total = Math.round(totalWeight * 100) / 100;
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
            const existingEntry = this.stats.filamentEstimates!.find(e => e.colorId === toolId);
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

        this.logger.info(`Total filament usage: ${this.stats.filamentUsage.total}g`);
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

        if (!this.stats.filamentUsage) {
          this.stats.filamentUsage = {
            total: 0,
            model: 0,
            support: 0,
            flushed: 0,
            tower: 0,
          };
        }

        // Update filament usage values
        this.stats.filamentUsage.total = total;
        this.stats.filamentUsage.model = model;
        this.stats.filamentUsage.support = support;
      }
    }

    // Extract flushed filament: "; flushed material = 60.64"
    if (line.includes('flushed material =')) {
      const flushedMatch = line.match(/flushed material = ([\d.]+)/);
      if (flushedMatch) {
        if (!this.stats.filamentUsage) {
          this.stats.filamentUsage = {
            total: 0,
            model: 0,
            support: 0,
            flushed: 0,
            tower: 0,
          };
        }
        this.stats.filamentUsage.flushed = parseFloat(flushedMatch[1]);
      }
    }

    // Extract wipe tower filament: "; wipe tower = 14.19"
    if (line.includes('wipe tower =')) {
      const towerMatch = line.match(/wipe tower = ([\d.]+)/);
      if (towerMatch) {
        if (!this.stats.filamentUsage) {
          this.stats.filamentUsage = {
            total: 0,
            model: 0,
            support: 0,
            flushed: 0,
            tower: 0,
          };
        }
        this.stats.filamentUsage.tower = parseFloat(towerMatch[1]);
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
      this.logger.silly(`Tool change: ${this.currentTool} → ${tool} at layer ${this.currentLayer}`);

      this.currentTool = tool;
      // Don't update the layer color map here - wait for the layer change
      // This ensures we track which tool is active when the layer actually starts printing
    }
  }

  private updateColorSeen(tool: string, layer: number) {
    if (!this.colorFirstSeen.has(tool)) {
      this.colorFirstSeen.set(tool, layer);
    }
    this.colorLastSeen.set(tool, layer);
  }
}
