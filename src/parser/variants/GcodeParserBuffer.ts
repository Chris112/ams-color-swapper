import { GcodeStats } from '../../types/gcode';
import { ToolChange } from '../../types/tool';
import { LayerColorInfo } from '../../types/layer';
import { Logger } from '../../utils/logger';

export class GcodeParserBuffer {
  private logger: Logger;
  private stats: Partial<GcodeStats>;
  private currentLayer: number = 0;
  private maxLayerSeen: number = 0;
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

  // ASCII codes for optimization
  private static readonly ASCII = {
    NEWLINE: 10,
    SEMICOLON: 59,
    SPACE: 32,
    TAB: 9,
    G: 71,
    T: 84,
    M: 77,
    Z: 90,
    ZERO: 48,
    ONE: 49,
    SIX: 54,
    SEVEN: 55,
  } as const;

  constructor(logger?: Logger, onProgress?: (progress: number, message: string) => void) {
    this.logger = logger || new Logger('GcodeParserBuffer');
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
    this.logger.info(`Starting buffer-based G-code parse for ${file.name}`);

    if (this.onProgress) {
      this.onProgress(5, 'Loading file into buffer...');
    }

    this.stats.fileName = file.name;
    this.stats.fileSize = file.size;
    this.stats.totalLayers = 1;
    this.stats.totalHeight = 0;

    // Initialize layer 0
    this.initializeLayer(0);
    this.addColorToLayer(0, this.currentTool);
    this.updateColorSeen(this.currentTool, 0);

    const estimatedLines = Math.ceil(file.size / 24);
    this.logger.info(`Estimated lines: ${estimatedLines.toLocaleString()}`);

    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    if (this.onProgress) {
      this.onProgress(20, 'Processing buffer...');
    }

    await this.processBuffer(uint8Array, estimatedLines);

    const parseTime = Date.now() - this.startTime;
    this.logger.info(`Buffer parse completed in ${parseTime}ms`);

    if (this.onProgress) {
      this.onProgress(85, 'Analyzing colors and calculating statistics...');
    }

    // Finalize the last layer
    if (this.currentLayer >= 0) {
      this.updateLayerDetails(this.currentLayer);
    }

    // Set total layers based on maxLayerSeen
    this.stats.totalLayers = this.maxLayerSeen + 1;

    // Import and calculate statistics
    const { calculateStatistics } = await import('../statistics');
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

    return completeStats;
  }

  private async processBuffer(buffer: Uint8Array, estimatedLines: number): Promise<void> {
    const progressInterval = Math.max(Math.floor(estimatedLines / 100), 1000);
    let lineStart = 0;
    let position = 0;
    const bufferLength = buffer.length;

    while (position < bufferLength) {
      // Find next newline
      while (position < bufferLength && buffer[position] !== GcodeParserBuffer.ASCII.NEWLINE) {
        position++;
      }

      // Process line if we found a newline
      if (position > lineStart) {
        this.lineNumber++;
        this.processLine(buffer, lineStart, position);

        // Report progress
        if (this.onProgress && this.lineNumber % progressInterval === 0) {
          const progressPercent = (position / bufferLength) * 60;
          const totalProgress = Math.min(20 + progressPercent, 80);
          const percentage = Math.min(Math.round((position / bufferLength) * 100), 100);
          this.onProgress(
            totalProgress,
            `Buffer parsing: ${percentage}% (${this.lineNumber.toLocaleString()} lines)`
          );

          // Yield to prevent blocking
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      // Move past the newline
      position++;
      lineStart = position;
    }

    // Process any remaining data
    if (lineStart < bufferLength) {
      this.lineNumber++;
      this.processLine(buffer, lineStart, bufferLength);
    }

    if (this.onProgress) {
      this.onProgress(80, `Processed ${this.lineNumber.toLocaleString()} lines`);
    }
  }

  private processLine(buffer: Uint8Array, start: number, end: number): void {
    // Skip empty lines
    if (start >= end) return;

    // Skip whitespace at start
    while (
      start < end &&
      (buffer[start] === GcodeParserBuffer.ASCII.SPACE ||
        buffer[start] === GcodeParserBuffer.ASCII.TAB)
    ) {
      start++;
    }

    if (start >= end) return;

    // Check for comment
    if (buffer[start] === GcodeParserBuffer.ASCII.SEMICOLON) {
      this.parseComment(buffer, start, end);
      return;
    }

    // Check for commands
    const firstChar = buffer[start];
    const secondChar = start + 1 < end ? buffer[start + 1] : 0;

    // G0/G1 moves
    if (
      firstChar === GcodeParserBuffer.ASCII.G &&
      (secondChar === GcodeParserBuffer.ASCII.ZERO || secondChar === GcodeParserBuffer.ASCII.ONE)
    ) {
      this.parseMove(buffer, start, end);
    }
    // Tool changes T0-T7
    else if (
      firstChar === GcodeParserBuffer.ASCII.T &&
      secondChar >= GcodeParserBuffer.ASCII.ZERO &&
      secondChar <= GcodeParserBuffer.ASCII.SEVEN
    ) {
      this.parseToolChange(`T${String.fromCharCode(secondChar)}`);
    }
    // M600 filament change
    else if (
      firstChar === GcodeParserBuffer.ASCII.M &&
      secondChar === GcodeParserBuffer.ASCII.SIX &&
      start + 2 < end &&
      buffer[start + 2] === GcodeParserBuffer.ASCII.ZERO &&
      start + 3 < end &&
      buffer[start + 3] === GcodeParserBuffer.ASCII.ZERO
    ) {
      this.parseFilamentChange();
    }
  }

  private parseComment(buffer: Uint8Array, start: number, end: number) {
    // Convert to string for complex parsing
    const decoder = new TextDecoder();
    const line = decoder.decode(buffer.slice(start, end));

    // Handle layer changes
    if (line.includes('layer')) {
      let newLayer: number | null = null;

      // Bambu Lab format
      let startIndex = line.indexOf('layer num/total_layer_count:');
      if (startIndex !== -1) {
        startIndex += 'layer num/total_layer_count:'.length;
        const endIndex = line.indexOf('/', startIndex);
        if (endIndex !== -1) {
          newLayer = parseInt(line.substring(startIndex, endIndex).trim());
        }
      } else {
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
        if (this.currentLayer >= 0) {
          this.updateLayerDetails(this.currentLayer);
        }

        // Start new layer
        this.currentLayer = newLayer;
        this.layerToolChanges = []; // Reset tool changes for new layer
        if (newLayer > this.maxLayerSeen) {
          this.maxLayerSeen = newLayer;
        }
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
        return;
      }
    }

    // Extract color definitions
    if (line.includes('extruder_colour') || line.includes('filament_colour')) {
      const parts = line.split('=');
      if (parts.length > 1) {
        const colors = parts[1].split(';').map((c) => c.trim());
        this.logger.info(`Found ${colors.length} color definitions`);
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
    else if (line.includes('total estimated time:') || line.includes('estimated printing time')) {
      const timePattern = /(\d+)h\s*(\d+)m\s*(\d+)s/;
      const match = line.match(timePattern);
      if (match) {
        const hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const seconds = parseInt(match[3]);
        this.stats.printTime = `${hours}h ${minutes}m ${seconds}s`;
        this.stats.estimatedPrintTime = hours * 3600 + minutes * 60 + seconds;
        this.logger.info(`Print time: ${this.stats.printTime}`);
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

        if (!this.stats.filamentEstimates) {
          this.stats.filamentEstimates = [];
        }

        weights.forEach((weight, index) => {
          if (weight > 0) {
            const toolId = `T${index}`;
            const existingEntry = this.stats.filamentEstimates!.find((e) => e.colorId === toolId);
            if (existingEntry) {
              existingEntry.weight = weight;
            } else {
              this.stats.filamentEstimates!.push({
                colorId: toolId,
                length: 0,
                weight: weight,
              });
            }
          }
        });

        this.logger.info(`Total filament: ${this.stats.filamentUsageStats.total}g`);
      }
    }
  }

  private parseMove(buffer: Uint8Array, start: number, end: number) {
    // Look for Z coordinate
    for (let i = start; i < end; i++) {
      if (buffer[i] === GcodeParserBuffer.ASCII.Z) {
        // Extract Z value
        let valueStart = i + 1;
        let valueEnd = valueStart;

        // Skip optional sign
        if (valueEnd < end && (buffer[valueEnd] === 45 || buffer[valueEnd] === 43)) {
          // - or +
          valueEnd++;
        }

        // Find end of number
        while (
          valueEnd < end &&
          ((buffer[valueEnd] >= 48 && buffer[valueEnd] <= 57) || // 0-9
            buffer[valueEnd] === 46)
        ) {
          // .
          valueEnd++;
        }

        if (valueEnd > valueStart) {
          const decoder = new TextDecoder();
          const zStr = decoder.decode(buffer.slice(valueStart, valueEnd));
          const newZ = parseFloat(zStr);

          if (!isNaN(newZ) && newZ > this.currentZ) {
            this.currentZ = newZ;
            if (!this.stats.totalHeight || newZ > this.stats.totalHeight) {
              this.stats.totalHeight = newZ;
            }
          }
        }
        break;
      }
    }
  }

  private parseFilamentChange() {
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
