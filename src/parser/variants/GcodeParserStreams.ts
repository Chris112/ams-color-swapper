import { GcodeStats } from '../../types/gcode';
import { ToolChange } from '../../types/tool';
import { LayerColorInfo } from '../../types/layer';
import { Logger } from '../../utils/logger';
import { gcodeToInternalLayer, detectGcodeNumberingScheme } from '../../utils/layerHelpers';

export class GcodeParserStreams {
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
  private gcodeLayers: number[] = []; // Track raw G-code layer numbers for scheme detection
  private isGcodeOneBased: boolean | null = null; // Will be determined during parsing

  constructor(logger?: Logger, onProgress?: (progress: number, message: string) => void) {
    this.logger = logger || new Logger('GcodeParserStreams');
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
    this.logger.info(`Starting streaming G-code parse for ${file.name}`);

    if (this.onProgress) {
      this.onProgress(5, 'Starting stream processing...');
    }

    this.stats.fileName = file.name;
    this.stats.fileSize = file.size;
    this.stats.totalLayers = 1;
    this.stats.totalHeight = 0;

    // Initialize layer 0 with T0 (will be enhanced by layer detection if present)
    this.currentLayer = 0;
    this.initializeLayer(0);
    this.addColorToLayer(0, this.currentTool);
    this.updateColorSeen(this.currentTool, 0);

    const estimatedLines = Math.ceil(file.size / 24);
    this.logger.info(`Estimated lines: ${estimatedLines.toLocaleString()}`);

    // Create a ReadableStream from the file
    const stream = file.stream();
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    // Transform stream to process lines
    const lineStream = this.createLineStream(reader, decoder, estimatedLines);

    if (this.onProgress) {
      this.onProgress(20, 'Processing G-code stream...');
    }

    // Process the stream
    await this.processStream(lineStream);

    const parseTime = Date.now() - this.startTime;
    this.logger.info(`Stream parse completed in ${parseTime}ms`);

    if (this.onProgress) {
      this.onProgress(85, 'Analyzing colors and calculating statistics...');
    }

    // Finalize the last layer
    if (this.currentLayer >= 0) {
      this.updateLayerDetails(this.currentLayer);
    }

    // Ensure T0 is present on all layers that were detected
    // If only layer 0 was used (no layer comments), T0 is already there
    // This is just a safety check to ensure consistency

    // Let calculateStatistics determine correct totalLayers based on indexing scheme
    // Don't override it here to maintain consistency with main parser

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

    // rawContent is loaded on-demand to prevent memory issues
    // It will be populated when needed by downstream components

    return completeStats;
  }

  private async *createLineStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
    estimatedLines: number
  ): AsyncGenerator<string> {
    let buffer = '';
    const progressInterval = Math.max(Math.floor(estimatedLines / 100), 1000);

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Process any remaining data in buffer
        if (buffer) {
          yield buffer;
        }
        break;
      }

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Extract complete lines from buffer
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        this.lineNumber++;

        // Report progress
        if (this.onProgress && this.lineNumber % progressInterval === 0) {
          const progressPercent = (this.lineNumber / estimatedLines) * 60;
          const totalProgress = Math.min(20 + progressPercent, 80);
          const percentage = Math.min(Math.round((this.lineNumber / estimatedLines) * 100), 100);
          this.onProgress(
            totalProgress,
            `Streaming: ${percentage}% (${this.lineNumber.toLocaleString()} lines)`
          );
        }

        yield line.trim();
      }
    }
  }

  private async processStream(lineStream: AsyncGenerator<string>): Promise<void> {
    for await (const line of lineStream) {
      this.parseLine(line);
    }

    if (this.onProgress) {
      this.onProgress(80, `Processed ${this.lineNumber.toLocaleString()} lines`);
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
    // Handle various layer formats (using same logic as main parser)
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
      const gcodeLayer = parseInt(layerMatch[1]);

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
        if (internalLayer > this.maxLayerSeen) {
          this.maxLayerSeen = internalLayer;
        }
        this.initializeLayer(this.currentLayer);

        // Carry forward all active tools from previous layer
        // In multi-color prints, tools remain active until explicitly changed
        if (this.currentLayer > 0) {
          const previousLayerTools = this.layerColorMap.get(this.currentLayer - 1) || [];
          previousLayerTools.forEach((tool) => {
            this.addColorToLayer(this.currentLayer, tool);
            this.updateColorSeen(tool, this.currentLayer);
          });
        } else {
          // First layer: add the currently active tool
          this.addColorToLayer(this.currentLayer, this.currentTool);
          this.updateColorSeen(this.currentTool, this.currentLayer);
        }

        this.logger.silly(
          `G-code Layer ${gcodeLayer} → Internal Layer ${this.currentLayer} - Current tool: ${this.currentTool}`
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
