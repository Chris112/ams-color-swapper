import { Logger } from '../utils/logger';
import { GcodeStats } from '../types/gcode';
import { Color } from '../domain/models/Color';
import {
  is3mfFile,
  extractGcodeFrom3mf,
  createVirtualGcodeFile,
  validateThreeMfMetadata,
  ThreeMfMetadata,
  ThreeMfExtractionResult,
} from '../utils/3mfUtils';
import { IGcodeParser } from './parserFactory';

/**
 * Enhanced G-code parser that supports 3MF files with metadata
 * Acts as a wrapper around existing parser implementations
 */
export class Gcode3mfParser implements IGcodeParser {
  private baseParser: IGcodeParser;
  private logger: Logger;

  constructor(baseParser: IGcodeParser, logger?: Logger) {
    this.baseParser = baseParser;
    this.logger = logger || new Logger('Gcode3mfParser');
  }

  async parse(file: File): Promise<GcodeStats> {
    // Check if this is a 3MF file
    if (!is3mfFile(file)) {
      // Not a 3MF file, use the base parser directly
      this.logger.debug(`File ${file.name} is not a 3MF file, using base parser`);
      return this.baseParser.parse(file);
    }

    this.logger.info(`Processing 3MF file: ${file.name}`);

    try {
      // Extract G-code and metadata from 3MF file
      const extractionResult = await extractGcodeFrom3mf(file);

      // Create a virtual G-code file for the base parser
      const virtualGcodeFile = createVirtualGcodeFile(extractionResult);

      // Parse the extracted G-code using the base parser
      const baseStats = await this.baseParser.parse(virtualGcodeFile);

      // Removed verbose logging to prevent performance issues

      // Enhance the stats with 3MF metadata if available
      const enhancedStats = await this.enhanceStatsWithMetadata(baseStats, extractionResult);

      // Store original filename and 3MF indicator
      enhancedStats.fileName = file.name;
      enhancedStats.is3mfFile = true;
      enhancedStats.threeMfMetadata = extractionResult.metadata;

      // Removed verbose logging to prevent performance issues

      this.logger.info(
        `Successfully processed 3MF file with ${enhancedStats.colors.length} colors`
      );

      return enhancedStats;
    } catch (error) {
      this.logger.error(
        'Failed to process 3MF file, falling back to treating as regular file',
        error
      );

      // Fallback: try to parse as a regular file
      // This handles cases where the file might be misnamed or partially corrupt
      try {
        return await this.baseParser.parse(file);
      } catch (fallbackError) {
        this.logger.error('Both 3MF and fallback parsing failed', fallbackError);
        throw new Error(
          `Failed to parse file ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Enhance parsed G-code statistics with 3MF metadata
   */
  private async enhanceStatsWithMetadata(
    baseStats: GcodeStats,
    extractionResult: ThreeMfExtractionResult
  ): Promise<GcodeStats> {
    const { metadata } = extractionResult;

    if (!metadata || !validateThreeMfMetadata(metadata)) {
      this.logger.debug('No valid 3MF metadata found, returning base stats');
      return baseStats;
    }

    this.logger.info('Enhancing stats with 3MF metadata');

    // Clone the base stats to avoid mutations - ensure ALL fields are preserved
    const enhancedStats: GcodeStats = {
      ...baseStats,
      colors: await this.enhanceColorsWithMetadata(baseStats.colors, metadata),
      // Explicitly preserve important fields from base stats
      printCost: baseStats.printCost,
      filamentEstimates: baseStats.filamentEstimates,
      filamentUsageStats: baseStats.filamentUsageStats,
    };

    // Add 3MF-specific information to slicer info
    if (!enhancedStats.slicerInfo) {
      enhancedStats.slicerInfo = {
        software: 'Unknown',
        version: 'Unknown',
      };
    }

    // Update slicer info with 3MF metadata
    enhancedStats.slicerInfo.colorDefinitions = metadata.filament_colors;
    enhancedStats.slicerInfo.threeMfVersion = metadata.version;
    enhancedStats.slicerInfo.bedType = metadata.bed_type;
    enhancedStats.slicerInfo.nozzleDiameter = metadata.nozzle_diameter;

    this.logger.info('Enhanced stats with 3MF metadata', {
      originalColors: baseStats.colors.length,
      enhancedColors: enhancedStats.colors.length,
      metadataColors: metadata.filament_colors.length,
      printCost: enhancedStats.printCost,
      filamentEstimates: enhancedStats.filamentEstimates?.length || 0,
      filamentUsageStats: enhancedStats.filamentUsageStats,
    });

    return enhancedStats;
  }

  /**
   * Enhance color information with 3MF metadata
   */
  private async enhanceColorsWithMetadata(
    baseColors: Color[],
    metadata: ThreeMfMetadata
  ): Promise<Color[]> {
    const { filament_colors, filament_ids } = metadata;

    if (!filament_colors || !Array.isArray(filament_colors)) {
      return baseColors;
    }

    // Import FilamentDatabase once, outside the loop
    const { FilamentDatabase } = await import('../services/FilamentDatabase');
    const filamentDb = FilamentDatabase.getInstance();

    const enhancedColors: Color[] = [];

    // Process each base color and enhance with metadata
    for (const baseColor of baseColors) {
      // Extract tool index from color ID (e.g., "T0" -> 0)
      const toolIndex = this.extractToolIndex(baseColor.id);

      // Find corresponding filament ID and color
      let filamentColor: string | undefined;
      let actualFilamentId: number | undefined;

      if (toolIndex !== null) {
        // Map tool index to actual filament ID
        actualFilamentId = filament_ids?.[toolIndex];

        // Get color from either the tool index or the mapped filament ID
        if (actualFilamentId !== undefined && filament_colors[actualFilamentId]) {
          filamentColor = filament_colors[actualFilamentId];
        } else if (filament_colors[toolIndex]) {
          filamentColor = filament_colors[toolIndex];
        }
      }

      // Get enhanced name if we have a hex color
      let enhancedName = baseColor.name;
      if (filamentColor) {
        // Use FilamentDatabase to get an enhanced name
        enhancedName = await filamentDb.getEnhancedColorName(filamentColor, baseColor.name);
      }

      // Create enhanced color with metadata
      const enhancedColor = new Color({
        id: baseColor.id,
        name: enhancedName,
        hexValue: filamentColor || baseColor.hexValue,
        firstLayer: baseColor.firstLayer,
        lastLayer: baseColor.lastLayer,
        layersUsed: baseColor.layersUsed,
        partialLayers: baseColor.partialLayers,
        // Add 3MF-specific metadata
        threeMfFilamentId: actualFilamentId,
        threeMfToolIndex: toolIndex,
      });

      enhancedColors.push(enhancedColor);

      this.logger.debug(`Enhanced color ${baseColor.id}`, {
        originalHex: baseColor.hexValue,
        enhancedHex: filamentColor,
        toolIndex,
        filamentId: actualFilamentId,
      });
    }

    // Check if there are defined colors that weren't used in the print
    if (filament_colors.length > enhancedColors.length) {
      this.logger.info(
        `3MF defines ${filament_colors.length} colors but only ${enhancedColors.length} were used in print`
      );
    }

    return enhancedColors;
  }

  /**
   * Extract tool index from color ID (e.g., "T0" -> 0, "T1" -> 1)
   */
  private extractToolIndex(colorId: string): number | null {
    const match = colorId.match(/^T(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }
}
