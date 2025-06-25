import { Result, GcodeStats, OptimizationResult } from '../types';
import { IFileRepository } from '../repositories';
import { OptimizationService } from './OptimizationService';

export interface ExportData {
  fileName: string;
  analysis: {
    colors: GcodeStats['colors'];
    optimization: OptimizationResult;
  };
  instructions: string;
  exportedAt: string;
}

export class ExportService {
  constructor(
    private fileRepository: IFileRepository,
    private optimizationService: OptimizationService
  ) {}

  /**
   * Export analysis results as JSON
   */
  exportAsJson(stats: GcodeStats, optimization: OptimizationResult): Result<void> {
    const exportData: ExportData = {
      fileName: stats.fileName,
      analysis: {
        colors: stats.colors,
        optimization,
      },
      instructions: this.optimizationService.generateInstructions(stats, optimization),
      exportedAt: new Date().toISOString(),
    };

    const content = JSON.stringify(exportData, null, 2);
    const fileName = `ams-optimization-${Date.now()}.json`;

    return this.fileRepository.downloadFile(content, fileName, 'application/json');
  }

  /**
   * Export optimization instructions as text
   */
  exportAsText(stats: GcodeStats, optimization: OptimizationResult): Result<void> {
    const instructions = this.optimizationService.generateInstructions(stats, optimization);
    const fileName = `ams-instructions-${stats.fileName.replace(/\.[^.]+$/, '')}.txt`;

    return this.fileRepository.downloadFile(instructions, fileName, 'text/plain');
  }

  /**
   * Export as CSV for spreadsheet analysis
   */
  exportAsCsv(stats: GcodeStats, optimization: OptimizationResult): Result<void> {
    const lines: string[] = [
      'Color ID,Color Name,Hex Color,First Layer,Last Layer,Layer Count,Usage %,Slot Assignment',
    ];

    stats.colors.forEach((color) => {
      const slot = optimization.slotAssignments.find((s) => s.colors.includes(color.id));
      const slotInfo = slot
        ? `Slot ${slot.slot}${slot.isPermanent ? ' (Permanent)' : ' (Shared)'}`
        : 'N/A';

      lines.push(
        [
          color.id,
          color.name || 'Unknown',
          color.hexColor || '',
          color.firstLayer.toString(),
          color.lastLayer.toString(),
          color.layerCount.toString(),
          color.usagePercentage.toFixed(2),
          slotInfo,
        ].join(',')
      );
    });

    if (optimization.manualSwaps.length > 0) {
      lines.push('', 'Manual Swaps Required:');
      lines.push('Layer,Z Height,Slot,From Color,To Color');

      optimization.manualSwaps.forEach((swap) => {
        lines.push(
          [
            swap.atLayer.toString(),
            swap.zHeight.toFixed(2),
            swap.slot.toString(),
            swap.fromColor,
            swap.toColor,
          ].join(',')
        );
      });
    }

    const content = lines.join('\n');
    const fileName = `ams-analysis-${stats.fileName.replace(/\.[^.]+$/, '')}.csv`;

    return this.fileRepository.downloadFile(content, fileName, 'text/csv');
  }
}
