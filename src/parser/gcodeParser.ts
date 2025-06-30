import { GcodeStats } from '../types/gcode';
import { ToolChange } from '../types/tool';
import { LayerColorInfo } from '../types/layer';
import { Logger } from '../utils/logger';
import { BrowserFileReader } from '../utils/fileReader';
import { calculateStatistics } from './statistics';
import { gcodeToInternalLayer, detectGcodeNumberingScheme } from '../utils/layerHelpers';
import { getOrThrow, firstOrUndefined } from '../utils/typeGuards';

export class GcodeParser {
  private logger: Logger;
  private stats: Partial<GcodeStats>;
  private currentLayer: number = 0;
  private currentZ: number = 0;
  private currentTool: string | null = null; // Will be set by first tool change
  private activeTools: Set<string> = new Set(); // Track all tools that have been used
  private toolChanges: ToolChange[] = [];
  private layerColorMap: Map<number, string[]> = new Map();
  private colorFirstSeen: Map<string, number> = new Map();
  private colorLastSeen: Map<string, number> = new Map();
  private layerDetails: Map<number, LayerColorInfo> = new Map();
  private layerToolChanges: ToolChange[] = []; // Tool changes in current layer
  private lineNumber: number = 0;
  private startTime: number = 0;
  private onProgress?: (progress: number, message: string) => void;
  private gcodeLayers: number[] = []; // Track raw G-code layer numbers for scheme detection
  private isGcodeOneBased: boolean | null = null; // Will be determined during parsing

  // Bambu Studio metadata for cost calculation
  private filamentCostPerKg: number[] = []; // Cost per kg for each filament type
  private filamentIndices: number[] = []; // Which filament index each tool uses
  private usedFilamentWeights: number[] = []; // Actual weights used per tool

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

    // Don't initialize layer 0 automatically - let layer detection from comments determine the numbering scheme
    this.currentLayer = -1; // Start with -1 to indicate no layer has been processed yet

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

    // If no layers were detected from comments, initialize with layer 0 (fallback for legacy files)
    if (this.currentLayer === -1) {
      this.currentLayer = 0;
      this.initializeLayer(0);
      // Set default tool if none was detected
      if (this.currentTool === null) {
        this.currentTool = 'T0';
        this.activeTools.add('T0');
      }
      this.addColorToLayer(0, this.currentTool);
      this.updateColorSeen(this.currentTool, 0);
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

    // Note: rawContent is no longer automatically loaded here to prevent memory issues
    // It will be loaded on-demand when needed (e.g., for G-code export)

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

    const parts = line.split(' ');
    const command = getOrThrow(parts, 0, `Invalid G-code line format: '${line}'`).toUpperCase();

    switch (command) {
      case 'G0':
      case 'G1':
        this.parseMove(line);
        break;
      case 'M600':
        this.parseFilamentChange(line);
        break;
      case 'M620':
        this.parseBambuToolChange(line);
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
        const colorString = getOrThrow(
          colorMatch,
          1,
          `Invalid color definition format in line: '${line}'`
        );
        const colors = colorString.split(';').map((c) => c.trim());
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
        const software = getOrThrow(
          slicerMatch,
          1,
          `Invalid slicer software format in line: '${line}'`
        );
        const version = getOrThrow(
          slicerMatch,
          2,
          `Invalid slicer version format in line: '${line}'`
        );
        if (!this.stats.slicerInfo) {
          this.stats.slicerInfo = {
            software,
            version,
          };
        }
        this.logger.info(`Detected slicer: ${software} v${version}`);
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
      const layerString = getOrThrow(
        layerMatch,
        1,
        `Invalid layer number format in line: '${line}'`
      ) as string;
      const gcodeLayer = parseInt(layerString);

      // Track G-code layer numbers for numbering scheme detection
      this.gcodeLayers.push(gcodeLayer);

      // Detect numbering scheme if not already determined
      if (this.isGcodeOneBased === null && this.gcodeLayers.length >= 1) {
        this.isGcodeOneBased = detectGcodeNumberingScheme(this.gcodeLayers);
        this.logger.info(
          `Detected G-code numbering scheme: ${this.isGcodeOneBased ? '1-based' : '0-based'}`
        );
      }

      // Convert G-code layer to internal 0-based layer
      const internalLayer = gcodeToInternalLayer(gcodeLayer, this.isGcodeOneBased || false);

      if (internalLayer !== this.currentLayer) {
        // Finalize previous layer details
        if (this.currentLayer >= 0) {
          this.updateLayerDetails(this.currentLayer);
        }

        // Start new layer
        this.currentLayer = internalLayer;
        this.layerToolChanges = []; // Reset tool changes for new layer
        this.initializeLayer(this.currentLayer);

        // Carry forward all active tools from previous layer
        // In multi-color prints, tools remain active until explicitly changed
        if (this.currentLayer > 0) {
          const previousLayerTools = this.layerColorMap.get(this.currentLayer - 1) || [];
          previousLayerTools.forEach((tool) => {
            this.addColorToLayer(this.currentLayer, tool);
            this.updateColorSeen(tool, this.currentLayer);
          });
        } else if (this.currentTool !== null) {
          // First layer: add the currently active tool
          this.addColorToLayer(this.currentLayer, this.currentTool);
          this.updateColorSeen(this.currentTool, this.currentLayer);
        }

        this.logger.silly(
          `G-code Layer ${gcodeLayer} → Internal Layer ${this.currentLayer} - Current tool: ${this.currentTool}`
        );
      }
    }

    // Extract print time from comments like "; total estimated time: 5h 41m 9s" or "; model printing time: 15m 8s; total estimated time: 22m 55s"
    if (line.includes('total estimated time:')) {
      const timeMatch = line.match(/total estimated time:\s*(?:(\d+)h\s*)?(\d+)m\s*(\d+)s/);
      if (timeMatch) {
        const hours = timeMatch[1] ? parseInt(timeMatch[1]) : 0;
        const minutes = parseInt(
          getOrThrow(timeMatch, 2, `Invalid minute format in time: '${line}'`)
        );
        const seconds = parseInt(
          getOrThrow(timeMatch, 3, `Invalid second format in time: '${line}'`)
        );
        this.stats.printTime =
          hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;
        this.stats.estimatedPrintTime = hours * 3600 + minutes * 60 + seconds;
        this.logger.info(`Total estimated time: ${this.stats.printTime}`);
      }
    }
    // Also support Bambu Studio format "model printing time: 15m 8s"
    else if (line.includes('model printing time:')) {
      const timeMatch = line.match(/model printing time:\s*(?:(\d+)h\s*)?(\d+)m\s*(\d+)s/);
      if (timeMatch) {
        const hours = timeMatch[1] ? parseInt(timeMatch[1]) : 0;
        const minutes = parseInt(
          getOrThrow(timeMatch, 2, `Invalid minute format in time: '${line}'`)
        );
        const seconds = parseInt(
          getOrThrow(timeMatch, 3, `Invalid second format in time: '${line}'`)
        );
        if (!this.stats.printTime) {
          // Only set if not already set by total estimated time
          this.stats.printTime =
            hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;
          this.stats.estimatedPrintTime = hours * 3600 + minutes * 60 + seconds;
          this.logger.info(`Model printing time: ${this.stats.printTime}`);
        }
      }
    }
    // Alternative format
    else if (line.includes('estimated printing time')) {
      const timeMatch = line.match(/(\d+)h\s*(\d+)m\s*(\d+)s/);
      if (timeMatch) {
        const hours = parseInt(getOrThrow(timeMatch, 1, `Invalid hour format in time: '${line}'`));
        const minutes = parseInt(
          getOrThrow(timeMatch, 2, `Invalid minute format in time: '${line}'`)
        );
        const seconds = parseInt(
          getOrThrow(timeMatch, 3, `Invalid second format in time: '${line}'`)
        );
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
        const costString = getOrThrow(costMatch, 1, `Invalid cost format in line: '${line}'`);
        const costs = costString.split(',').map((c) => parseFloat(c.trim()));
        const totalCost = costs.reduce((sum, cost) => sum + cost, 0);
        this.stats.printCost = Math.round(totalCost * 100) / 100; // Round to 2 decimal places
        this.logger.info(`Print cost: $${this.stats.printCost}`);
      }
    }

    // Extract filament_cost (Bambu Studio format - cost per kg for each filament type)
    // Also check for format with colon
    if (line.includes('filament_cost') && !line.includes('filament cost =')) {
      const costMatch = line.match(/;\s*filament_cost\s*[:=]\s*(.+)/);
      if (costMatch) {
        this.filamentCostPerKg = costMatch[1].split(',').map((c) => parseFloat(c.trim()));
        this.logger.info(`Filament cost per kg: ${this.filamentCostPerKg.join(', ')}`);

        // Try to calculate cost if we already have weights and indices
        if (
          this.usedFilamentWeights.length > 0 &&
          this.filamentIndices.length > 0 &&
          !this.stats.printCost
        ) {
          let totalCost = 0;
          this.usedFilamentWeights.forEach((weight, toolIndex) => {
            if (weight > 0 && toolIndex < this.filamentIndices.length) {
              const filamentIdx = this.filamentIndices[toolIndex];
              if (filamentIdx < this.filamentCostPerKg.length) {
                const costPerKg = this.filamentCostPerKg[filamentIdx];
                const costForThisFilament = (weight / 1000) * costPerKg; // convert g to kg
                totalCost += costForThisFilament;
                this.logger.info(
                  `T${toolIndex} uses filament ${filamentIdx}: ${weight}g @ $${costPerKg}/kg = $${costForThisFilament.toFixed(2)}`
                );
              }
            }
          });

          if (totalCost > 0) {
            this.stats.printCost = Math.round(totalCost * 100) / 100;
            this.logger.info(`Calculated print cost from Bambu metadata: $${this.stats.printCost}`);
          }
        }
      }
    }

    // Extract filament indices (Bambu Studio format - which filament each tool uses)
    if (line.includes('; filament:')) {
      const filamentMatch = line.match(/; filament:\s*(.+)/);
      if (filamentMatch) {
        this.filamentIndices = filamentMatch[1].split(',').map((f) => parseInt(f.trim()));
        this.logger.info(`Filament indices: ${this.filamentIndices.join(', ')}`);
      }
    }

    // Extract filament length from comments like "; total filament length [mm] : 729.60,1256.50"
    if (line.includes('total filament length [mm]') && !this.stats.filamentEstimates) {
      const lengthMatch = line.match(/total filament length \[mm\]\s*:\s*(.+)/);
      if (lengthMatch) {
        const lengths = lengthMatch[1].split(',').map((l) => parseFloat(l.trim()));

        this.stats.filamentEstimates = [];

        // Store lengths for each tool
        let totalEstimatedWeight = 0;
        lengths.forEach((length, index) => {
          if (length > 0) {
            const toolId = `T${index}`;
            // Estimate weight from length (assuming 1.75mm filament and 1.24g/cm³ density for PLA)
            const estimatedWeight = (length / 1000) * Math.PI * Math.pow(1.75 / 2, 2) * 1.24;
            totalEstimatedWeight += estimatedWeight;

            const existingEntry = this.stats.filamentEstimates!.find((e) => e.colorId === toolId);
            if (existingEntry) {
              existingEntry.length = length;
              if (!existingEntry.weight) {
                existingEntry.weight = Math.round(estimatedWeight * 100) / 100;
              }
            } else {
              this.stats.filamentEstimates!.push({
                colorId: toolId,
                length: length,
                weight: Math.round(estimatedWeight * 100) / 100,
              });
            }
          }
        });

        // Update total weight if not already set
        if (!this.stats.filamentUsageStats) {
          this.stats.filamentUsageStats = {
            total: Math.round(totalEstimatedWeight * 100) / 100,
            model: 0,
            support: 0,
            flushed: 0,
            tower: 0,
          };
        }

        this.logger.info(
          `Filament lengths: ${lengths.join(', ')}mm (estimated ${totalEstimatedWeight.toFixed(1)}g)`
        );
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

        // Store weights for Bambu cost calculation
        this.usedFilamentWeights = weights;

        // Calculate print cost if we have Bambu Studio metadata
        if (
          this.filamentCostPerKg.length > 0 &&
          this.filamentIndices.length > 0 &&
          !this.stats.printCost
        ) {
          this.logger.info(
            `Calculating cost with: costPerKg=${this.filamentCostPerKg.length} items, indices=${this.filamentIndices.length} items, weights=${weights.length} items`
          );
          let totalCost = 0;
          weights.forEach((weight, toolIndex) => {
            if (weight > 0 && toolIndex < this.filamentIndices.length) {
              const filamentIdx = this.filamentIndices[toolIndex];
              if (filamentIdx < this.filamentCostPerKg.length) {
                const costPerKg = this.filamentCostPerKg[filamentIdx];
                const costForThisFilament = (weight / 1000) * costPerKg; // convert g to kg
                totalCost += costForThisFilament;
                this.logger.info(
                  `T${toolIndex} uses filament ${filamentIdx}: ${weight}g @ $${costPerKg}/kg = $${costForThisFilament.toFixed(2)}`
                );
              }
            }
          });

          if (totalCost > 0) {
            this.stats.printCost = Math.round(totalCost * 100) / 100;
            this.logger.info(`Calculated print cost from Bambu metadata: $${this.stats.printCost}`);
          }
        } else {
          this.logger.info(
            `Cannot calculate cost: costPerKg=${this.filamentCostPerKg.length}, indices=${this.filamentIndices.length}, hasCost=${!!this.stats.printCost}`
          );
        }
      }
    }

    // Extract filament weight from Bambu format "; total filament weight [g] : 2.32,3.75"
    if (line.includes('total filament weight [g]') && line.includes(':')) {
      const weightMatch = line.match(/total filament weight \[g\]\s*:\s*(.+)/);
      if (weightMatch) {
        const weights = weightMatch[1].split(',').map((w) => parseFloat(w.trim()));
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

        // Store weights for Bambu cost calculation
        this.usedFilamentWeights = weights;

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

        this.logger.info(`Total filament weight: ${totalWeight.toFixed(2)}g`);
        this.logger.info(`Per-tool weights: ${weights.map((w, i) => `T${i}: ${w}g`).join(', ')}`);

        // Calculate print cost if we have Bambu Studio metadata
        if (
          this.filamentCostPerKg.length > 0 &&
          this.filamentIndices.length > 0 &&
          !this.stats.printCost
        ) {
          this.logger.info(
            `Calculating cost with: costPerKg=${this.filamentCostPerKg.length} items, indices=${this.filamentIndices.length} items, weights=${weights.length} items`
          );
          let totalCost = 0;
          weights.forEach((weight, toolIndex) => {
            if (weight > 0 && toolIndex < this.filamentIndices.length) {
              const filamentIdx = this.filamentIndices[toolIndex];
              if (filamentIdx < this.filamentCostPerKg.length) {
                const costPerKg = this.filamentCostPerKg[filamentIdx];
                const costForThisFilament = (weight / 1000) * costPerKg; // convert g to kg
                totalCost += costForThisFilament;
                this.logger.info(
                  `T${toolIndex} uses filament ${filamentIdx}: ${weight}g @ $${costPerKg}/kg = $${costForThisFilament.toFixed(2)}`
                );
              }
            }
          });

          if (totalCost > 0) {
            this.stats.printCost = Math.round(totalCost * 100) / 100;
            this.logger.info(`Calculated print cost from Bambu metadata: $${this.stats.printCost}`);
          }
        } else {
          this.logger.info(
            `Cannot calculate cost: costPerKg=${this.filamentCostPerKg.length}, indices=${this.filamentIndices.length}, hasCost=${!!this.stats.printCost}`
          );
        }
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
          colorId: this.currentTool || 'T0',
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

  private parseBambuToolChange(line: string) {
    // Parse M620 S[toolNumber]A format
    // Example: M620 S0A (switch to T0), M620 S1A (switch to T1)
    const bambuMatch = line.match(/M620\s+S(\d+)A/i);
    if (bambuMatch) {
      const toolNumber = parseInt(bambuMatch[1]);
      const tool = `T${toolNumber}`;
      this.logger.silly(`Bambu tool change detected: ${line} → ${tool}`);
      this.parseToolChange(tool);
    }
  }

  private parseToolChange(tool: string) {
    if (tool !== this.currentTool) {
      // Only process tool changes if we're in a valid layer (>= 0)
      if (this.currentLayer >= 0 && this.currentTool !== null) {
        // End the previous tool's range at the previous layer
        // This prevents overlap - previous tool ends before current layer
        if (this.currentLayer > 0) {
          this.updateColorSeen(this.currentTool, this.currentLayer - 1);
        }

        const change: ToolChange = {
          fromTool: this.currentTool,
          toTool: tool,
          layer: this.currentLayer,
          lineNumber: this.lineNumber,
          zHeight: this.currentZ,
        };

        this.toolChanges.push(change);
        this.layerToolChanges.push(change);
        this.logger.silly(
          `Tool change: ${this.currentTool} → ${tool} at layer ${this.currentLayer}`
        );
      } else if (this.currentTool === null) {
        this.logger.silly(`Initial tool set to: ${tool}`);
      }

      // When a tool change happens during a layer, accumulate all tools that deposit material
      if (this.currentLayer >= 0) {
        // Keep the previous tool - it deposited material on this layer
        // Add the new tool to the current layer (previous tool remains)
        this.addColorToLayer(this.currentLayer, tool);
        this.updateColorSeen(tool, this.currentLayer);
      }

      this.currentTool = tool;
      // Track this tool as active (used in the print)
      this.activeTools.add(tool);
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
        primaryColor: this.currentTool || 'T0',
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
        layerInfo.primaryColor = firstOrUndefined(colors) || 'T0'; // First color is primary, fallback to T0
      }
    }
  }

  private updateLayerDetails(layer: number) {
    const layerInfo = this.layerDetails.get(layer);
    if (layerInfo) {
      layerInfo.toolChangesInLayer = [...this.layerToolChanges];
      layerInfo.toolChangeCount = this.layerToolChanges.length;
      // Primary color is the most recent tool (last one used in layer)
      layerInfo.primaryColor = this.currentTool || 'T0';
    }
  }
}
