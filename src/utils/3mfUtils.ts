import { unzipSync } from 'fflate';
import { Logger } from './logger';

const logger = new Logger('3MFUtils');

/**
 * 3MF file structure and metadata types
 */
export interface ThreeMfMetadata {
  filament_colors: string[];
  filament_ids: number[];
  first_extruder: number;
  nozzle_diameter: number;
  bed_type: string;
  bbox_objects: Array<{
    id: number;
    name: string;
    layer_height: number;
    bbox: [number, number, number, number];
    area: number;
  }>;
  version: number;
  is_seq_print: boolean;
}

export interface ThreeMfExtractionResult {
  gcode: string;
  metadata?: ThreeMfMetadata;
  originalFileName: string;
}

/**
 * Detect if a file is a 3MF file based on extension
 */
export function is3mfFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.gcode.3mf') || file.name.toLowerCase().endsWith('.3mf');
}

/**
 * Extract G-code and metadata from a 3MF file
 */
export async function extractGcodeFrom3mf(file: File): Promise<ThreeMfExtractionResult> {
  logger.info(`Extracting G-code from 3MF file: ${file.name}`);

  try {
    // Read the file as an array buffer
    const buffer = await file.arrayBuffer();
    const zipData = new Uint8Array(buffer);

    // Extract the ZIP contents
    const files = unzipSync(zipData);

    // Find the G-code file (usually Metadata/plate_1.gcode)
    const gcodeEntry = findGcodeEntry(files);
    if (!gcodeEntry) {
      throw new Error('No G-code file found in 3MF archive');
    }

    // Extract G-code content
    const gcode = new TextDecoder().decode(gcodeEntry.data);
    logger.info(`Extracted G-code: ${gcode.length} characters`);

    // Try to extract metadata
    let metadata: ThreeMfMetadata | undefined;
    try {
      const metadataEntry = findMetadataEntry(files);
      if (metadataEntry) {
        const metadataText = new TextDecoder().decode(metadataEntry.data);
        metadata = JSON.parse(metadataText) as ThreeMfMetadata;
        logger.info('Extracted 3MF metadata', {
          colors: metadata.filament_colors?.length || 0,
          filamentIds: metadata.filament_ids?.length || 0,
          bedType: metadata.bed_type,
          nozzleDiameter: metadata.nozzle_diameter,
        });
      }
    } catch (metadataError) {
      logger.warn('Failed to extract 3MF metadata, continuing with G-code only', metadataError);
    }

    return {
      gcode,
      metadata,
      originalFileName: file.name,
    };
  } catch (error) {
    logger.error('Failed to extract G-code from 3MF file', error);
    throw new Error(
      `Failed to extract G-code from 3MF file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Find the G-code entry in the extracted ZIP files
 */
function findGcodeEntry(
  files: Record<string, Uint8Array>
): { data: Uint8Array; path: string } | null {
  // Common G-code file patterns in 3MF files
  const gcodePatterns = [/^Metadata\/plate_\d+\.gcode$/, /^.*\.gcode$/, /^gcode\/.*$/];

  for (const [path, data] of Object.entries(files)) {
    for (const pattern of gcodePatterns) {
      if (pattern.test(path)) {
        logger.debug(`Found G-code file: ${path}`);
        return { data, path };
      }
    }
  }

  return null;
}

/**
 * Find the metadata JSON entry in the extracted ZIP files
 */
function findMetadataEntry(
  files: Record<string, Uint8Array>
): { data: Uint8Array; path: string } | null {
  // Common metadata file patterns in 3MF files
  const metadataPatterns = [
    /^Metadata\/plate_\d+\.json$/,
    /^.*plate.*\.json$/,
    /^metadata.*\.json$/i,
  ];

  for (const [path, data] of Object.entries(files)) {
    for (const pattern of metadataPatterns) {
      if (pattern.test(path)) {
        logger.debug(`Found metadata file: ${path}`);
        return { data, path };
      }
    }
  }

  return null;
}

/**
 * Create a virtual File object from extracted G-code content
 * This allows the extracted G-code to be processed by existing parsers
 */
export function createVirtualGcodeFile(extractionResult: ThreeMfExtractionResult): File {
  const { gcode, originalFileName } = extractionResult;

  // Create a filename that preserves the original name but indicates it's extracted
  const virtualFileName = originalFileName.replace(/\.3mf$|\.gcode\.3mf$/, '.gcode');

  // Create a Blob from the G-code content
  const blob = new Blob([gcode], { type: 'text/plain' });

  // Create a File object with the correct name and type
  const virtualFile = new File([blob], virtualFileName, {
    type: 'text/plain',
    lastModified: Date.now(),
  });

  logger.debug(`Created virtual G-code file: ${virtualFileName} (${gcode.length} bytes)`);

  return virtualFile;
}

/**
 * Validate that extracted metadata has expected structure
 */
export function validateThreeMfMetadata(metadata: any): metadata is ThreeMfMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  // Check for required fields
  const hasBasicStructure =
    Array.isArray(metadata.filament_colors) &&
    Array.isArray(metadata.filament_ids) &&
    typeof metadata.nozzle_diameter === 'number';

  if (!hasBasicStructure) {
    logger.warn('3MF metadata missing required fields');
    return false;
  }

  return true;
}
