import { IGcodeRepository } from './interfaces';
import { Result, GcodeStats, ValidationError, ParseError } from '../types';
import { GcodeParser } from '../parser/gcodeParser';

export class GcodeRepository implements IGcodeRepository {
  private parser: GcodeParser;

  constructor() {
    this.parser = new GcodeParser();
  }

  async parseFile(file: File): Promise<Result<GcodeStats>> {
    // First validate the file
    const validationResult = this.validateFile(file);
    if (!validationResult.ok) {
      return validationResult;
    }

    try {
      // For now, we'll use the regular parser for all files
      // TODO: Implement streaming parser for large files

      // For smaller files, read content and use regular parser
      const content = await file.text();
      return await this.parseContent(content, file.name);
    } catch (error) {
      return Result.err(
        new ParseError(
          `Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          error
        )
      );
    }
  }

  async parseContent(content: string, fileName: string): Promise<Result<GcodeStats>> {
    try {
      const startTime = Date.now();
      const stats = await this.parser.parse(content, fileName);
      stats.parseTime = Date.now() - startTime;
      return Result.ok(stats);
    } catch (error) {
      return Result.err(
        new ParseError(
          `Failed to parse content: ${error instanceof Error ? error.message : 'Unknown error'}`,
          undefined,
          error
        )
      );
    }
  }

  validateFile(file: File): Result<void> {
    // Check file extension
    const validExtensions = ['.gcode', '.gco', '.g', '.nc'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      return Result.err(
        new ValidationError(
          `Invalid file type. Expected G-code file (${validExtensions.join(', ')})`,
          'fileExtension'
        )
      );
    }

    // Check file size (max 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      return Result.err(
        new ValidationError(
          `File too large. Maximum size is 500MB`,
          'fileSize'
        )
      );
    }

    // Check if file is not empty
    if (file.size === 0) {
      return Result.err(
        new ValidationError(
          `File is empty`,
          'fileSize'
        )
      );
    }

    return Result.ok(undefined);
  }

}