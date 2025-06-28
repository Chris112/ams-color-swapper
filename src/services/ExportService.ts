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
          color.hexValue || '',
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

  /**
   * Export G-code with pause commands (M600) inserted at manual swap points
   */
  exportGcodeWithPauses(stats: GcodeStats, optimization: OptimizationResult): Result<void> {
    if (!stats.rawContent) {
      return {
        ok: false,
        error: new Error('Original G-code content not available'),
      };
    }

    if (optimization.manualSwaps.length === 0) {
      return {
        ok: false,
        error: new Error('No manual swaps required - original G-code can be used as-is'),
      };
    }

    // Split the G-code into lines
    const lines = stats.rawContent.split('\n');
    const modifiedLines: string[] = [];
    let currentLayer = 0;

    // Create a map of pause layers for quick lookup
    const pauseLayers = new Map<number, (typeof optimization.manualSwaps)[0]>();
    optimization.manualSwaps.forEach((swap) => {
      pauseLayers.set(swap.pauseStartLayer, swap);
    });

    // Process each line
    for (const line of lines) {
      // Check for layer changes in various formats
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
        currentLayer = parseInt(layerMatch[1]);

        // Check if we need to insert a pause before this layer
        const swap = pauseLayers.get(currentLayer);
        if (swap) {
          // Find color information
          const fromColor = stats.colors.find((c) => c.id === swap.fromColor);
          const toColor = stats.colors.find((c) => c.id === swap.toColor);

          // Add pause command with detailed comments
          modifiedLines.push('');
          modifiedLines.push('; ========================================');
          modifiedLines.push('; AMS COLOR SWAP REQUIRED');
          modifiedLines.push(`; Layer ${swap.pauseStartLayer} to ${swap.pauseEndLayer}`);
          modifiedLines.push(`; Z Height: ${swap.zHeight.toFixed(2)}mm`);
          modifiedLines.push('; ----------------------------------------');
          modifiedLines.push(
            `; REMOVE: ${swap.fromColor} - ${fromColor?.name || 'Unknown'} (${fromColor?.hexValue || 'N/A'})`
          );
          modifiedLines.push(
            `; INSERT: ${swap.toColor} - ${toColor?.name || 'Unknown'} (${toColor?.hexValue || 'N/A'}) → Slot ${swap.slot}`
          );
          modifiedLines.push('; ----------------------------------------');
          modifiedLines.push(`; Reason: ${swap.reason}`);
          modifiedLines.push('; ========================================');
          modifiedLines.push('M600 ; Filament change pause');
          modifiedLines.push('');
        }
      }

      // Add the original line
      modifiedLines.push(line);
    }

    // Join lines back together
    const modifiedGcode = modifiedLines.join('\n');

    // Create filename with _pauses suffix
    const baseName = stats.fileName.replace(/\.[^.]+$/, '');
    const extension = stats.fileName.match(/\.[^.]+$/)?.[0] || '.gcode';
    const fileName = `${baseName}_with_pauses${extension}`;

    return this.fileRepository.downloadFile(modifiedGcode, fileName, 'text/plain');
  }
}
