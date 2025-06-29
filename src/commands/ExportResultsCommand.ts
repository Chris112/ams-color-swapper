import { ICommand } from './ICommand';
import { Result } from '../types/result';
import { GcodeStats } from '../types/gcode';
import { OptimizationResult } from '../types/optimization';
import { ExportService } from '../services/ExportService';

export enum ExportFormat {
  JSON = 'json',
  TEXT = 'text',
  CSV = 'csv',
}

/**
 * Command to export analysis results
 */
export class ExportResultsCommand implements ICommand<void> {
  constructor(
    private stats: GcodeStats,
    private optimization: OptimizationResult,
    private exportService: ExportService,
    private format: ExportFormat = ExportFormat.JSON
  ) {}

  async execute(): Promise<Result<void>> {
    switch (this.format) {
      case ExportFormat.JSON:
        return this.exportService.exportAsJson(this.stats, this.optimization);

      case ExportFormat.TEXT:
        return this.exportService.exportAsText(this.stats, this.optimization);

      case ExportFormat.CSV:
        return this.exportService.exportAsCsv(this.stats, this.optimization);

      default:
        return Result.err(new Error(`Unsupported export format: ${this.format}`));
    }
  }

  getDescription(): string {
    return `Export results as ${this.format.toUpperCase()} for ${this.stats.fileName}`;
  }
}
