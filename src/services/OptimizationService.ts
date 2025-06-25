import { GcodeStats, OptimizationResult } from '../types';
import { PrintMapper, AmsConfigurationMapper } from '../domain/mappers';
import { AmsConfiguration } from '../domain/models';
import { Logger } from '../utils/logger';

export class OptimizationService {
  private logger = new Logger('OptimizationService');
  /**
   * Generate optimization recommendations based on G-code statistics
   */
  generateOptimization(stats: GcodeStats): OptimizationResult {
    // Convert to domain model
    const print = PrintMapper.toDomain(stats);

    // Create optimized AMS configuration
    const amsConfig = new AmsConfiguration();
    amsConfig.assignColors(print.colors);

    // Convert back to infrastructure type
    const result = AmsConfigurationMapper.toOptimizationResult(amsConfig, print.colors);

    // Log optimization summary
    this.logger.info('Optimization Analysis Complete', {
      totalColors: result.totalColors,
      requiredSlots: result.requiredSlots,
      manualSwaps: result.manualSwaps.length,
      estimatedTimeSaved: `${Math.round(result.estimatedTimeSaved / 60)} minutes`,
    });

    // Log slot assignments
    result.slotAssignments.forEach((slot, index) => {
      this.logger.info(`Slot ${slot.slot} Assignment`, {
        colors: slot.colors,
        type: slot.isPermanent ? 'Permanent' : 'Shared',
        colorCount: slot.colors.length,
      });
    });

    // Log manual swaps if any
    if (result.manualSwaps.length > 0) {
      this.logger.info(`Manual swaps required: ${result.manualSwaps.length}`);
      result.manualSwaps.forEach((swap, index) => {
        this.logger.debug(`Swap ${index + 1}`, {
          pauseRange: swap.pauseEndLayer >= swap.pauseStartLayer 
            ? `${swap.pauseStartLayer}-${swap.pauseEndLayer}` 
            : `at layer ${swap.atLayer}`,
          fromColor: swap.fromColor,
          toColor: swap.toColor,
          slot: swap.slot,
          atLayer: swap.atLayer,
        });
      });
    }

    return result;
  }

  /**
   * Generate human-readable optimization instructions
   */
  generateInstructions(stats: GcodeStats, optimization: OptimizationResult): string {
    const lines: string[] = [
      'AMS COLOR OPTIMIZATION REPORT',
      '============================',
      '',
      `File: ${stats.fileName}`,
      `Total Colors: ${optimization.totalColors}`,
      `Required AMS Slots: ${optimization.requiredSlots}`,
      `Manual Swaps Needed: ${optimization.manualSwaps.length}`,
      `Time Saved: ~${Math.round(optimization.estimatedTimeSaved / 60)} minutes`,
      '',
      'SLOT ASSIGNMENTS:',
    ];

    // Add slot assignments
    optimization.slotAssignments.forEach((slot) => {
      const colorNames = slot.colors
        .map((colorId) => {
          const color = stats.colors.find((c) => c.id === colorId);
          return color?.name || colorId;
        })
        .join(', ');

      const status = slot.isPermanent ? '(Permanent)' : '(Shared)';
      lines.push(`  Slot ${slot.slot}: ${colorNames} ${status}`);
    });

    // Add manual swap instructions
    if (optimization.manualSwaps.length > 0) {
      lines.push('', 'MANUAL SWAP INSTRUCTIONS:');
      optimization.manualSwaps.forEach((swap, index) => {
        const fromName = stats.colors.find((c) => c.id === swap.fromColor)?.name || swap.fromColor;
        const toName = stats.colors.find((c) => c.id === swap.toColor)?.name || swap.toColor;
        const pauseInfo = swap.pauseEndLayer >= swap.pauseStartLayer 
          ? `Pause between layers ${swap.pauseStartLayer}-${swap.pauseEndLayer}` 
          : `Pause at layer ${swap.atLayer}`;
        lines.push(
          `  ${index + 1}. ${pauseInfo} (Z=${swap.zHeight}mm):`,
          `     Remove ${fromName} from Slot ${swap.slot}`,
          `     Insert ${toName} into Slot ${swap.slot}`
        );
      });
    }

    // Add tips
    lines.push(
      '',
      'TIPS:',
      '- Pause the print at the specified layers to perform swaps',
      '- Ensure filaments are properly loaded before resuming',
      '- Consider color usage percentages when deciding permanent slots'
    );

    return lines.join('\n');
  }
}
