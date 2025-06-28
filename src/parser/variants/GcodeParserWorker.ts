import { GcodeStats, LayerColorInfo } from '../../types';
import { Color } from '../../domain/models/Color';
import { Logger } from '../../utils/logger';

export class GcodeParserWorker {
  private logger: Logger;
  private onProgress?: (progress: number, message: string) => void;
  private workerCount: number;
  private maxLayerSeen: number = 0;

  constructor(logger?: Logger, onProgress?: (progress: number, message: string) => void) {
    this.logger = logger || new Logger('GcodeParserWorker');
    this.onProgress = onProgress;
    // Use number of CPU cores, but cap at 4 for reasonable performance
    this.workerCount = Math.min(navigator.hardwareConcurrency || 2, 4);
  }

  async parse(file: File): Promise<GcodeStats> {
    const startTime = Date.now();
    this.logger.info(
      `Starting worker-based G-code parse for ${file.name} with ${this.workerCount} workers`
    );

    if (this.onProgress) {
      this.onProgress(5, 'Preparing workers...');
    }

    const stats: Partial<GcodeStats> = {
      fileName: file.name,
      fileSize: file.size,
      toolChanges: [],
      layerColorMap: new Map(),
      parserWarnings: [],
      colors: [],
    };

    try {
      // Read file content
      const content = await file.text();
      const chunks = this.splitIntoChunks(content, this.workerCount);

      if (this.onProgress) {
        this.onProgress(20, `Processing with ${this.workerCount} workers...`);
      }

      // Process chunks in parallel
      const results = await this.processChunksInWorkers(chunks);

      // Merge results
      const mergedData = this.mergeWorkerResults(results);

      // Track max layer seen
      this.maxLayerSeen = Math.max(...Array.from(mergedData.layers), 0);

      // Apply merged data to stats
      stats.totalLayers = this.maxLayerSeen + 1;
      stats.totalHeight = mergedData.maxZ;
      stats.slicerInfo = mergedData.slicerInfo;
      stats.printTime = mergedData.printTime;
      stats.layerColorMap = mergedData.layerColorMap;
      stats.toolChanges = mergedData.toolChanges;

      if (mergedData.estimatedPrintTime) {
        stats.estimatedPrintTime = mergedData.estimatedPrintTime;
      }

      if (mergedData.filamentWeights && mergedData.filamentWeights.length > 0) {
        const totalWeight = mergedData.filamentWeights.reduce((sum, w) => sum + w, 0);
        stats.filamentUsageStats = {
          total: Math.round(totalWeight * 100) / 100,
          model: 0,
          support: 0,
          flushed: 0,
          tower: 0,
        };

        stats.filamentEstimates = [];
        mergedData.filamentWeights.forEach((weight, index) => {
          if (weight > 0) {
            stats.filamentEstimates!.push({
              colorId: `T${index}`,
              length: 0,
              weight: weight,
            });
          }
        });
      }

      if (mergedData.hasM600) {
        stats.parserWarnings?.push('M600 filament changes detected');
      }

      // Calculate colors and color usage ranges
      const uniqueColors: Color[] = Array.from(mergedData.tools).map((tool) => {
        const toolIndex = parseInt(tool.slice(1));
        const colorDef = mergedData.colorDefs?.[toolIndex]?.trim() || '#888888';
        const hexColor =
          typeof colorDef === 'string' && colorDef.length > 0
            ? colorDef.startsWith('#')
              ? colorDef
              : `#${colorDef}`
            : '#888888';
        const firstLayer = mergedData.colorFirstSeen.get(tool) || 0;
        const lastLayer = mergedData.colorLastSeen.get(tool) || 0;

        // Build layersUsed set from layerColorMap
        const layersUsed = new Set<number>();
        mergedData.layerColorMap.forEach((tools, layer) => {
          if (tools.includes(tool)) {
            layersUsed.add(layer);
          }
        });

        return new Color({
          id: tool,
          name: tool,
          hexValue: hexColor,
          firstLayer,
          lastLayer,
          layersUsed,
          partialLayers: new Set(),
          totalLayers: stats.totalLayers,
        });
      });
      stats.colors = uniqueColors;

      // Calculate color usage ranges
      const colorRanges: any[] = [];
      mergedData.colorFirstSeen.forEach((firstLayer, colorId) => {
        const lastLayer = mergedData.colorLastSeen.get(colorId) || firstLayer;
        colorRanges.push({
          colorId,
          startLayer: firstLayer,
          endLayer: lastLayer,
          continuous: true, // Simplified for now
        });
      });
      stats.colorUsageRanges = colorRanges;

      // Calculate layer details
      const layerDetails: LayerColorInfo[] = [];
      mergedData.layerColorMap.forEach((colors, layer) => {
        const toolChangesInLayer = mergedData.toolChanges.filter((tc) => tc.layer === layer);
        layerDetails.push({
          layer,
          colors,
          primaryColor: colors[0], // First color as primary for simplicity
          toolChangeCount: toolChangesInLayer.length,
          toolChangesInLayer,
        });
      });
      stats.layerDetails = layerDetails;

      const parseTime = Date.now() - startTime;
      stats.parseTime = parseTime;
      this.logger.info(`Worker parse completed in ${parseTime}ms`);

      if (this.onProgress) {
        this.onProgress(100, 'Parse complete');
      }

      return stats as GcodeStats;
    } catch (error) {
      this.logger.error('Worker parsing failed', error);
      throw error;
    }
  }

  private splitIntoChunks(content: string, chunkCount: number): string[] {
    const lines = content.split('\n');
    const linesPerChunk = Math.ceil(lines.length / chunkCount);
    const chunks: string[] = [];

    for (let i = 0; i < chunkCount; i++) {
      const start = i * linesPerChunk;
      const end = Math.min(start + linesPerChunk, lines.length);
      chunks.push(lines.slice(start, end).join('\n'));
    }

    return chunks;
  }

  private async processChunksInWorkers(chunks: string[]): Promise<any[]> {
    // In a real implementation, this would create actual Web Workers
    // For the benchmark, we'll simulate worker processing
    const workerPromises = chunks.map((chunk, index) => {
      return this.simulateWorkerProcessing(chunk, index, chunks.length);
    });

    const results = await Promise.all(workerPromises);
    return results;
  }

  private async simulateWorkerProcessing(
    chunk: string,
    chunkIndex: number,
    totalChunks: number
  ): Promise<any> {
    // Simulate worker processing by parsing the chunk
    const lines = chunk.split('\n');
    const layers = new Set<number>();
    const tools = new Set<string>(['T0']);
    const activeTools = new Set<string>(['T0']); // Track all tools used in this chunk
    const toolChanges: any[] = [];
    const layerColorMap: Array<[number, string[]]> = [];

    let currentLayer = 0;
    let currentTool = 'T0';
    let maxZ = 0;
    let hasM600 = false;
    let colorDefs: string[] | undefined;
    let slicerInfo: { software: string; version: string } | undefined;
    let printTime: string | undefined;
    let filamentWeights: number[] | undefined;
    let localLineNumber = 0;

    for (const line of lines) {
      localLineNumber++;
      const trimmed = line.trim();

      if (!trimmed) continue;

      // Parse similar to worker script
      if (trimmed[0] === ';') {
        if (trimmed.includes('layer')) {
          const match = trimmed.match(/layer\s*(?:#|num\/total_layer_count:)?\s*(\d+)/i);
          if (match) {
            const newLayer = parseInt(match[1]);
            if (newLayer !== currentLayer) {
              currentLayer = newLayer;
              layers.add(currentLayer);
              // Add all active tools to the new layer for color persistence
              layerColorMap.push([currentLayer, Array.from(activeTools)]);
            }
          }
        } else if (
          (trimmed.includes('extruder_colour') || trimmed.includes('filament_colour')) &&
          !colorDefs
        ) {
          const parts = trimmed.split('=');
          if (parts.length > 1) {
            colorDefs = parts[1].split(';').map((c) => c.trim());
          }
        } else if (trimmed.includes('generated by') && !slicerInfo) {
          const match = trimmed.match(/generated by\s+(.+?)\s+(.+)/);
          if (match) {
            slicerInfo = { software: match[1], version: match[2] };
          }
        }
      } else {
        const command = trimmed.split(' ')[0].toUpperCase();
        if (command === 'G0' || command === 'G1') {
          const match = trimmed.match(/Z([-+]?\d*\.?\d+)/);
          if (match) {
            const z = parseFloat(match[1]);
            if (!isNaN(z) && z > maxZ) {
              maxZ = z;
            }
          }
        } else if (
          command.length === 2 &&
          command[0] === 'T' &&
          command[1] >= '0' &&
          command[1] <= '7'
        ) {
          tools.add(command);
          activeTools.add(command); // Track as active tool
          if (command !== currentTool) {
            toolChanges.push({
              fromTool: currentTool,
              toTool: command,
              layer: currentLayer,
              lineNumber: localLineNumber,
            });
            currentTool = command;
            // Update current layer with new tool
            const existingEntry = layerColorMap.find(([layer]) => layer === currentLayer);
            if (existingEntry) {
              existingEntry[1] = Array.from(activeTools);
            }
          }
        } else if (command === 'M600') {
          hasM600 = true;
        }
      }
    }

    // Finalize the last layer if it hasn't been added yet
    if (layers.has(currentLayer)) {
      const existingEntry = layerColorMap.find(([layer]) => layer === currentLayer);
      if (!existingEntry) {
        layerColorMap.push([currentLayer, [currentTool]]);
      }
    }

    // Progress update
    if (this.onProgress) {
      const progress = 20 + ((chunkIndex + 1) / totalChunks) * 60;
      this.onProgress(progress, `Worker ${chunkIndex + 1}/${totalChunks} complete`);
    }

    return {
      layers,
      tools,
      activeTools, // Include active tools for merging
      toolChanges,
      maxZ,
      hasM600,
      colorDefs,
      slicerInfo,
      printTime,
      filamentWeights,
      lineCount: localLineNumber,
      layerColorMap,
    };
  }

  private mergeWorkerResults(results: any[]): {
    layers: Set<number>;
    tools: Set<string>;
    toolChanges: any[];
    maxZ: number;
    hasM600: boolean;
    colorDefs?: string[];
    slicerInfo?: { software: string; version: string };
    printTime?: string;
    estimatedPrintTime?: number;
    filamentWeights?: number[];
    layerColorMap: Map<number, string[]>;
    colorFirstSeen: Map<string, number>;
    colorLastSeen: Map<string, number>;
  } {
    const merged = {
      layers: new Set<number>([0]),
      tools: new Set<string>(['T0']),
      activeTools: new Set<string>(['T0']), // Global active tools
      toolChanges: [] as any[],
      maxZ: 0,
      hasM600: false,
      colorDefs: undefined as string[] | undefined,
      slicerInfo: undefined as { software: string; version: string } | undefined,
      printTime: undefined as string | undefined,
      estimatedPrintTime: undefined as number | undefined,
      filamentWeights: undefined as number[] | undefined,
      layerColorMap: new Map<number, string[]>(),
      colorFirstSeen: new Map<string, number>(),
      colorLastSeen: new Map<string, number>(),
    };

    // Merge all results
    let globalLineOffset = 0;
    for (const result of results) {
      // Merge layers
      result.layers.forEach((layer: number) => merged.layers.add(layer));

      // Merge tools
      result.tools.forEach((tool: string) => merged.tools.add(tool));

      // Merge active tools (if present from chunks)
      if (result.activeTools) {
        result.activeTools.forEach((tool: string) => merged.activeTools.add(tool));
      }

      // Merge tool changes with corrected line numbers
      result.toolChanges.forEach((tc: any) => {
        merged.toolChanges.push({
          ...tc,
          lineNumber: tc.lineNumber + globalLineOffset,
        });
      });

      // Update max Z
      if (result.maxZ > merged.maxZ) {
        merged.maxZ = result.maxZ;
      }

      // Merge boolean flags
      merged.hasM600 = merged.hasM600 || result.hasM600;

      // Take first found metadata
      if (!merged.colorDefs && result.colorDefs) {
        merged.colorDefs = result.colorDefs;
      }
      if (!merged.slicerInfo && result.slicerInfo) {
        merged.slicerInfo = result.slicerInfo;
      }
      if (!merged.printTime && result.printTime) {
        merged.printTime = result.printTime;
        // Calculate estimated time in seconds
        const match = result.printTime.match(/(\d+)h\s*(\d+)m\s*(\d+)s/);
        if (match) {
          merged.estimatedPrintTime =
            parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
        }
      }
      if (!merged.filamentWeights && result.filamentWeights) {
        merged.filamentWeights = result.filamentWeights;
      }

      // Merge layer color maps
      result.layerColorMap.forEach(([layer, tools]: [number, string[]]) => {
        const existingTools = merged.layerColorMap.get(layer) || [];
        const mergedTools = [...new Set([...existingTools, ...tools])];
        merged.layerColorMap.set(layer, mergedTools);

        // Update color first/last seen
        tools.forEach((tool) => {
          if (!merged.colorFirstSeen.has(tool)) {
            merged.colorFirstSeen.set(tool, layer);
          }
          merged.colorLastSeen.set(tool, layer);
        });
      });

      globalLineOffset += result.lineCount;
    }

    // Ensure layer 0 is in the map
    if (!merged.layerColorMap.has(0)) {
      merged.layerColorMap.set(0, ['T0']);
    }

    // Apply color persistence: ensure all active tools are present in all layers
    const allLayers = Array.from(merged.layers).sort((a, b) => a - b);
    const processedLayers = new Map<number, string[]>();

    for (const layer of allLayers) {
      const layerTools = merged.layerColorMap.get(layer) || [];
      // Add any new tools found in this layer to active set
      layerTools.forEach((tool) => merged.activeTools.add(tool));
      // Set this layer to have all active tools
      processedLayers.set(layer, Array.from(merged.activeTools));
    }

    // Replace layerColorMap with processed version
    merged.layerColorMap = processedLayers;

    // Update color first/last seen based on processed layers
    merged.colorFirstSeen.clear();
    merged.colorLastSeen.clear();
    processedLayers.forEach((tools, layer) => {
      tools.forEach((tool) => {
        if (!merged.colorFirstSeen.has(tool)) {
          merged.colorFirstSeen.set(tool, layer);
        }
        merged.colorLastSeen.set(tool, layer);
      });
    });

    return merged;
  }
}
