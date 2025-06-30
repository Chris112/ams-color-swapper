import { Result } from '../types/result';
import { GcodeStats } from '../types/gcode';
import { OptimizationResult } from '../types/optimization';
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
    const instructions = this.generateEnhancedInstructions(stats, optimization);
    const fileName = `ams-instructions-${stats.fileName.replace(/\.[^.]+$/, '')}.txt`;

    return this.fileRepository.downloadFile(instructions, fileName, 'text/plain');
  }

  /**
   * Generate enhanced instructions with better formatting
   */
  private generateEnhancedInstructions(
    stats: GcodeStats,
    optimization: OptimizationResult
  ): string {
    const lines: string[] = [
      '════════════════════════════════════════════════════════════════',
      '                    AMS COLOR SWAP INSTRUCTIONS                  ',
      '════════════════════════════════════════════════════════════════',
      '',
      `File: ${stats.fileName}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      '────────────────────────────────────────────────────────────────',
      '                          SUMMARY                               ',
      '────────────────────────────────────────────────────────────────',
      '',
      `• Total Colors: ${optimization.totalColors}`,
      `• Required AMS Slots: ${optimization.requiredSlots}`,
      `• Manual Swaps Needed: ${optimization.manualSwaps.length}`,
      `• Estimated Swap Time: ~${optimization.manualSwaps.length * 5} minutes`,
      `• Time Saved vs Tool Changes: ~${Math.round(optimization.estimatedTimeSaved / 60)} minutes`,
      '',
      '────────────────────────────────────────────────────────────────',
      '                      SLOT ASSIGNMENTS                          ',
      '────────────────────────────────────────────────────────────────',
      '',
    ];

    // Group slots by unit
    const groupedSlots = optimization.slotAssignments.reduce(
      (acc, slot) => {
        const unit = slot.unit;
        if (!acc[unit]) acc[unit] = [];
        acc[unit].push(slot);
        return acc;
      },
      {} as Record<number, typeof optimization.slotAssignments>
    );

    Object.entries(groupedSlots).forEach(([unit, unitSlots]) => {
      lines.push(`AMS Unit ${unit}:`);
      unitSlots.forEach((slot) => {
        const colorNames = slot.colors
          .map((colorId) => {
            const color = stats.colors.find((c) => c.id === colorId);
            return color?.name || colorId;
          })
          .join(', ');
        const status = slot.isPermanent ? 'PERMANENT' : 'SHARED';
        lines.push(`  Slot ${slot.slot}: ${colorNames} [${status}]`);
      });
      lines.push('');
    });

    if (optimization.manualSwaps.length > 0) {
      lines.push(
        '────────────────────────────────────────────────────────────────',
        '                   MANUAL SWAP INSTRUCTIONS                     ',
        '────────────────────────────────────────────────────────────────',
        '',
        '⚠️  IMPORTANT: Follow these steps in order during your print',
        ''
      );

      optimization.manualSwaps.forEach((swap, index) => {
        const fromColor = stats.colors.find((c) => c.id === swap.fromColor);
        const toColor = stats.colors.find((c) => c.id === swap.toColor);

        lines.push(
          `┌─── SWAP ${index + 1} OF ${optimization.manualSwaps.length} ${'─'.repeat(48 - (index + 1).toString().length - optimization.manualSwaps.length.toString().length)}┐`
        );
        lines.push('│                                                              │');
        lines.push(
          `│  📍 PAUSE AT: Layer ${swap.atLayer}${swap.zHeight ? ` (Z: ${swap.zHeight.toFixed(2)}mm)` : ''}${' '.repeat(Math.max(0, 28 - swap.atLayer.toString().length - (swap.zHeight ? ` (Z: ${swap.zHeight.toFixed(2)}mm)`.length : 0)))} │`
        );

        if (swap.timingOptions) {
          lines.push(
            `│  ⏱️  Timing Window: Layers ${swap.timingOptions.earliest} - ${swap.timingOptions.latest}${' '.repeat(Math.max(0, 21 - swap.timingOptions.earliest.toString().length - swap.timingOptions.latest.toString().length))} │`
          );
        }

        lines.push('│                                                              │');
        lines.push(`│  🔴 REMOVE: ${(fromColor?.name || swap.fromColor).padEnd(47)} │`);
        lines.push(`│      From: Unit ${swap.unit} Slot ${swap.slot}${' '.repeat(39)} │`);
        lines.push('│                                                              │');
        lines.push(`│  🟢 INSERT: ${(toColor?.name || swap.toColor).padEnd(47)} │`);
        lines.push(`│      Into: Unit ${swap.unit} Slot ${swap.slot}${' '.repeat(39)} │`);
        lines.push('│                                                              │');
        lines.push(
          `│  📝 Reason: ${swap.reason.length > 47 ? swap.reason.substring(0, 44) + '...' : swap.reason.padEnd(47)} │`
        );
        lines.push('└──────────────────────────────────────────────────────────────┘');
        lines.push('');
      });
    }

    lines.push(
      '────────────────────────────────────────────────────────────────',
      '                         TIPS & NOTES                           ',
      '────────────────────────────────────────────────────────────────',
      '',
      '✓ Pause the print at the specified layers',
      '✓ Ensure filaments are properly loaded before resuming',
      '✓ Check that removed filaments are stored properly',
      '✓ Verify correct slot assignments before resuming',
      '✓ Consider color compatibility (temperature, material type)',
      '',
      '────────────────────────────────────────────────────────────────',
      '                          CHECKLIST                             ',
      '────────────────────────────────────────────────────────────────',
      '',
      '□ All filament colors are ready and accessible',
      '□ Printer is properly calibrated',
      '□ You understand the pause/resume process',
      '□ Workspace is organized for quick changes',
      '□ You have taken a photo of initial AMS setup',
      '',
      '════════════════════════════════════════════════════════════════'
    );

    return lines.join('\n');
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
            swap.zHeight ? swap.zHeight.toFixed(2) : 'N/A',
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
  async exportGcodeWithPauses(
    stats: GcodeStats,
    optimization: OptimizationResult,
    originalFile?: File
  ): Promise<Result<void>> {
    // Load raw content on-demand if not already available
    let rawContent = stats.rawContent;
    if (!rawContent && originalFile) {
      try {
        rawContent = await originalFile.text();
      } catch (error) {
        return {
          ok: false,
          error: new Error(`Failed to read original file: ${error}`),
        };
      }
    }

    if (!rawContent) {
      return {
        ok: false,
        error: new Error('Original G-code content not available. Please re-upload the file.'),
      };
    }

    if (optimization.manualSwaps.length === 0) {
      return {
        ok: false,
        error: new Error('No manual swaps required - original G-code can be used as-is'),
      };
    }

    // Split the G-code into lines
    const lines = rawContent.split('\n');
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
          modifiedLines.push(
            `; Z Height: ${swap.zHeight ? swap.zHeight.toFixed(2) + 'mm' : 'N/A'}`
          );
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
