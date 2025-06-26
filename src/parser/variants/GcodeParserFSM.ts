import { GcodeStats, ToolChange } from '../../types';
import { Logger } from '../../utils/logger';
import { BrowserFileReader } from '../../utils/fileReader';
import { calculateStatistics } from '../statistics';

// State machine states
enum ParserState {
  INITIAL,
  READING_COMMAND,
  READING_COMMENT,
  READING_G_COMMAND,
  READING_T_COMMAND,
  READING_M_COMMAND,
  READING_Z_VALUE,
  READING_LAYER_NUMBER,
  SKIP_LINE,
}

// Character codes for faster comparisons
const CharCode = {
  SEMICOLON: ';'.charCodeAt(0),
  SPACE: ' '.charCodeAt(0),
  TAB: '\t'.charCodeAt(0),
  NEWLINE: '\n'.charCodeAt(0),
  G: 'G'.charCodeAt(0),
  T: 'T'.charCodeAt(0),
  M: 'M'.charCodeAt(0),
  Z: 'Z'.charCodeAt(0),
  ZERO: '0'.charCodeAt(0),
  ONE: '1'.charCodeAt(0),
  SIX: '6'.charCodeAt(0),
  SEVEN: '7'.charCodeAt(0),
  NINE: '9'.charCodeAt(0),
  DOT: '.'.charCodeAt(0),
  MINUS: '-'.charCodeAt(0),
  PLUS: '+'.charCodeAt(0),
} as const;

export class GcodeParserFSM {
  private logger: Logger;
  private stats: Partial<GcodeStats>;
  private currentLayer: number = 0;
  private maxLayerSeen: number = 0;
  private currentZ: number = 0;
  private currentTool: string = 'T0';
  private toolChanges: ToolChange[] = [];
  private layerColorMap: Map<number, string> = new Map();
  private colorFirstSeen: Map<string, number> = new Map();
  private colorLastSeen: Map<string, number> = new Map();
  private lineNumber: number = 0;
  private startTime: number = 0;
  private onProgress?: (progress: number, message: string) => void;

  // FSM state
  private state: ParserState = ParserState.INITIAL;
  private buffer: string = '';
  private commandBuffer: string = '';
  private valueBuffer: string = '';

  constructor(logger?: Logger, onProgress?: (progress: number, message: string) => void) {
    this.logger = logger || new Logger('GcodeParserFSM');
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
    this.logger.info(`Starting FSM G-code parse for ${file.name}`);

    if (this.onProgress) {
      this.onProgress(5, 'Initializing state machine...');
    }

    this.stats.fileName = file.name;
    this.stats.fileSize = file.size;
    this.stats.totalLayers = 1;
    this.stats.totalHeight = 0;

    // Initialize layer 0
    this.layerColorMap.set(0, this.currentTool);
    this.updateColorSeen(this.currentTool, 0);

    const estimatedLines = Math.ceil(file.size / 24);
    this.logger.info(`Estimated lines: ${estimatedLines.toLocaleString()}`);

    const reader = new BrowserFileReader(file);

    if (this.onProgress) {
      this.onProgress(20, 'Processing with state machine...');
    }

    await this.processFileWithFSM(reader, estimatedLines);

    const parseTime = Date.now() - this.startTime;
    this.logger.info(`FSM parse completed in ${parseTime}ms`);

    if (this.onProgress) {
      this.onProgress(85, 'Analyzing colors and calculating statistics...');
    }

    // Set total layers based on maxLayerSeen
    this.stats.totalLayers = this.maxLayerSeen + 1;

    const completeStats = await calculateStatistics(
      this.stats as GcodeStats,
      this.toolChanges,
      this.layerColorMap,
      this.colorFirstSeen,
      this.colorLastSeen,
      parseTime
    );

    if (!this.stats.rawContent) {
      if (this.onProgress) {
        this.onProgress(90, 'Loading content for geometry parsing...');
      }
      this.stats.rawContent = await file.text();
      completeStats.rawContent = this.stats.rawContent;
    }

    if (!completeStats.colors || completeStats.colors.length === 0) {
      completeStats.colors = [
        {
          id: 'T0',
          name: 'Default Color',
          hexColor: '#888888',
          firstLayer: 0,
          lastLayer: completeStats.totalLayers - 1,
          layerCount: completeStats.totalLayers,
          usagePercentage: 100,
        },
      ];
    }

    this.logger.info('FSM parsing complete', {
      parseTime: `${parseTime}ms`,
      totalLayers: completeStats.totalLayers,
      uniqueColors: completeStats.colors.length,
    });

    return completeStats;
  }

  private async processFileWithFSM(reader: BrowserFileReader, estimatedLines: number): Promise<void> {
    const progressInterval = Math.max(Math.floor(estimatedLines / 100), 1000);

    for await (const line of reader.readLines()) {
      this.lineNumber++;
      this.processLineWithFSM(line);

      if (this.onProgress && this.lineNumber % progressInterval === 0) {
        const progressPercent = (this.lineNumber / estimatedLines) * 60;
        const totalProgress = Math.min(20 + progressPercent, 80);
        const percentage = Math.round((this.lineNumber / estimatedLines) * 100);
        this.onProgress(
          totalProgress,
          `FSM parsing: ${percentage}% (${this.lineNumber.toLocaleString()}/${estimatedLines.toLocaleString()})`
        );
      }
    }

    if (this.onProgress) {
      this.onProgress(80, `Processed all ${estimatedLines.toLocaleString()} lines`);
    }
  }

  private processLineWithFSM(line: string): void {
    this.state = ParserState.INITIAL;
    this.buffer = '';
    this.commandBuffer = '';
    this.valueBuffer = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const charCode = char.charCodeAt(0);

      switch (this.state) {
        case ParserState.INITIAL:
          if (charCode === CharCode.SEMICOLON) {
            this.state = ParserState.READING_COMMENT;
            this.buffer = line.substring(i);
            i = line.length; // Skip to end
          } else if (charCode === CharCode.G) {
            this.state = ParserState.READING_G_COMMAND;
            this.commandBuffer = 'G';
          } else if (charCode === CharCode.T) {
            this.state = ParserState.READING_T_COMMAND;
            this.commandBuffer = 'T';
          } else if (charCode === CharCode.M) {
            this.state = ParserState.READING_M_COMMAND;
            this.commandBuffer = 'M';
          } else if (charCode !== CharCode.SPACE && charCode !== CharCode.TAB) {
            this.state = ParserState.SKIP_LINE;
          }
          break;

        case ParserState.READING_G_COMMAND:
          if (charCode >= CharCode.ZERO && charCode <= CharCode.NINE) {
            this.commandBuffer += char;
          } else {
            // Check if it's G0 or G1
            if (this.commandBuffer === 'G0' || this.commandBuffer === 'G1') {
              // Look for Z coordinate
              const zIndex = line.indexOf('Z', i);
              if (zIndex !== -1) {
                this.state = ParserState.READING_Z_VALUE;
                i = zIndex; // Jump to Z
              } else {
                this.state = ParserState.SKIP_LINE;
              }
            } else {
              this.state = ParserState.SKIP_LINE;
            }
          }
          break;

        case ParserState.READING_T_COMMAND:
          if (charCode >= CharCode.ZERO && charCode <= CharCode.SEVEN) {
            this.commandBuffer += char;
            // Execute tool change
            if (this.commandBuffer !== this.currentTool) {
              this.handleToolChange(this.commandBuffer);
            }
            this.state = ParserState.SKIP_LINE;
          } else {
            this.state = ParserState.SKIP_LINE;
          }
          break;

        case ParserState.READING_M_COMMAND:
          if (charCode >= CharCode.ZERO && charCode <= CharCode.NINE) {
            this.commandBuffer += char;
            if (this.commandBuffer === 'M600') {
              this.handleFilamentChange();
              this.state = ParserState.SKIP_LINE;
            } else if (this.commandBuffer.length >= 4) {
              this.state = ParserState.SKIP_LINE;
            }
          } else {
            this.state = ParserState.SKIP_LINE;
          }
          break;

        case ParserState.READING_Z_VALUE:
          if (charCode === CharCode.Z) {
            this.valueBuffer = '';
          } else if (
            (charCode >= CharCode.ZERO && charCode <= CharCode.NINE) ||
            charCode === CharCode.DOT ||
            charCode === CharCode.MINUS ||
            charCode === CharCode.PLUS
          ) {
            this.valueBuffer += char;
          } else if (this.valueBuffer) {
            // End of Z value
            const newZ = parseFloat(this.valueBuffer);
            if (!isNaN(newZ) && newZ > this.currentZ) {
              this.currentZ = newZ;
              if (!this.stats.totalHeight || newZ > this.stats.totalHeight) {
                this.stats.totalHeight = newZ;
              }
            }
            this.state = ParserState.SKIP_LINE;
          }
          break;

        case ParserState.SKIP_LINE:
          // Do nothing, skip rest of line
          break;
      }
    }

    // Handle end of line states
    if (this.state === ParserState.READING_COMMENT) {
      this.processComment(this.buffer);
    } else if (this.state === ParserState.READING_Z_VALUE && this.valueBuffer) {
      const newZ = parseFloat(this.valueBuffer);
      if (!isNaN(newZ) && newZ > this.currentZ) {
        this.currentZ = newZ;
        if (!this.stats.totalHeight || newZ > this.stats.totalHeight) {
          this.stats.totalHeight = newZ;
        }
      }
    }
  }

  private processComment(comment: string) {
    // Layer detection
    if (comment.includes('layer')) {
      const layerMatch = comment.match(/layer\s*(?:#|num\/total_layer_count:)?\s*(\d+)/i);
      if (layerMatch) {
        const newLayer = parseInt(layerMatch[1]);
        if (newLayer !== this.currentLayer) {
          this.currentLayer = newLayer;
          if (newLayer > this.maxLayerSeen) {
            this.maxLayerSeen = newLayer;
          }
          this.layerColorMap.set(this.currentLayer, this.currentTool);
          this.updateColorSeen(this.currentTool, this.currentLayer);
          this.logger.silly(`Layer ${this.currentLayer} - Tool: ${this.currentTool}`);
        }
      }
    }

    // Color definitions
    else if (comment.includes('extruder_colour') || comment.includes('filament_colour')) {
      const parts = comment.split('=');
      if (parts.length > 1) {
        const colors = parts[1].split(';');
        this.logger.info(`Found ${colors.length} color definitions`);
        if (!this.stats.slicerInfo) {
          this.stats.slicerInfo = { software: 'Unknown', version: 'Unknown' };
        }
        this.stats.slicerInfo.colorDefinitions = colors;
      }
    }

    // Slicer info
    else if (comment.includes('generated by')) {
      const match = comment.match(/generated by\s+(.+?)\s+(.+)/);
      if (match) {
        if (!this.stats.slicerInfo) {
          this.stats.slicerInfo = {
            software: match[1],
            version: match[2],
          };
        }
        this.logger.info(`Detected slicer: ${match[1]} v${match[2]}`);
      }
    }

    // Print time
    else if (comment.includes('estimated') && comment.includes('time')) {
      const match = comment.match(/(\d+)h\s*(\d+)m\s*(\d+)s/);
      if (match) {
        const hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const seconds = parseInt(match[3]);
        this.stats.printTime = `${hours}h ${minutes}m ${seconds}s`;
        this.stats.estimatedPrintTime = hours * 3600 + minutes * 60 + seconds;
        this.logger.info(`Print time: ${this.stats.printTime}`);
      }
    }

    // Filament usage
    else if (comment.includes('filament used [g]')) {
      const parts = comment.split('=');
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

  private handleToolChange(tool: string) {
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
  }

  private handleFilamentChange() {
    this.logger.warn(
      `Manual filament change detected at layer ${this.currentLayer}, line ${this.lineNumber}`
    );
    this.stats.parserWarnings?.push(
      `M600 filament change at layer ${this.currentLayer} (line ${this.lineNumber})`
    );
  }

  private updateColorSeen(tool: string, layer: number) {
    if (!this.colorFirstSeen.has(tool)) {
      this.colorFirstSeen.set(tool, layer);
    }
    this.colorLastSeen.set(tool, layer);
  }
}