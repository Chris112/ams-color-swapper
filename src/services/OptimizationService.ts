import { GcodeStats, OptimizationResult, SystemConfiguration } from '../types';
import { PrintMapper, AmsConfigurationMapper } from '../domain/mappers';
import { AmsConfiguration } from '../domain/models';
import { Logger } from '../utils/logger';
import { SimulatedAnnealingOptimizer } from '../domain/services/SimulatedAnnealingOptimizer';
import { ColorOverlapAnalyzer } from '../domain/services/ColorOverlapAnalyzer'; // Needed for SA to calculate swaps

export enum OptimizationAlgorithm {
  Greedy = 'greedy',
  SimulatedAnnealing = 'simulatedAnnealing',
}

export class OptimizationService {
  private logger = new Logger('OptimizationService');

  /**
   * Generate optimization recommendations based on G-code statistics
   */
  generateOptimization(
    stats: GcodeStats,
    configuration?: SystemConfiguration,
    algorithm: OptimizationAlgorithm = OptimizationAlgorithm.Greedy // New parameter
  ): OptimizationResult {
    // Convert to domain model
    const print = PrintMapper.toDomain(stats);

    // Use provided configuration or default to single AMS unit
    const config = configuration || {
      type: 'ams' as const,
      unitCount: 1,
      totalSlots: 4,
    };

    let result: OptimizationResult;

    if (algorithm === OptimizationAlgorithm.SimulatedAnnealing) {
      this.logger.info('Using Simulated Annealing for optimization');
      const saOptimizer = new SimulatedAnnealingOptimizer(
        print.colors,
        config.totalSlots,
        10000, // Initial temperature
        0.995, // Cooling rate
        10000 // Iterations
      );
      const saResult = saOptimizer.optimize();

      // Map SA result to OptimizationResult structure
      const slotAssignments = Array.from(saResult.assignments.entries()).map(
        ([slotNum, colors]) => ({
          unit: 1, // Assuming single AMS unit for now
          slot: slotNum,
          colors: colors.map((c) => c.id),
          isPermanent: colors.length === 1,
        })
      );

      result = {
        totalColors: print.colors.length,
        requiredSlots: saResult.assignments.size,
        manualSwaps: saResult.manualSwaps,
        estimatedTimeSaved: 0, // SA doesn't calculate this directly, need to derive or estimate
        slotAssignments: slotAssignments,
        configuration: config,
      };

      // Calculate estimated time saved (simple estimation for now)
      // A more accurate calculation would involve comparing the original number of tool changes
      // with the optimized number of manual swaps.
      const originalToolChanges = stats.toolChanges?.length || 0;
      const optimizedSwaps = saResult.manualSwaps.length;
      result.estimatedTimeSaved = Math.max(0, (originalToolChanges - optimizedSwaps) * 5 * 60); // 5 mins per swap saved
    } else {
      this.logger.info('Using Greedy algorithm for optimization');
      // Create optimized AMS configuration
      const amsConfig = new AmsConfiguration(config.type, config.unitCount);
      amsConfig.assignColors(print.colors);

      // Convert back to infrastructure type
      result = AmsConfigurationMapper.toOptimizationResult(amsConfig, print.colors);
    }

    // Log optimization summary
    this.logger.info('Optimization Analysis Complete', {
      totalColors: result.totalColors,
      requiredSlots: result.requiredSlots,
      manualSwaps: result.manualSwaps.length,
      estimatedTimeSaved: `${Math.round(result.estimatedTimeSaved / 60)} minutes`,
    });

    // Log slot assignments
    result.slotAssignments.forEach((slot, index) => {
      this.logger.info(`Unit ${slot.unit} Slot ${slot.slot} Assignment`, {
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
          pauseRange:
            swap.pauseEndLayer >= swap.pauseStartLayer
              ? `${swap.pauseStartLayer}-${swap.pauseEndLayer}`
              : `at layer ${swap.atLayer}`,
          fromColor: swap.fromColor,
          toColor: swap.toColor,
          unit: swap.unit,
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
      const slotName =
        optimization.configuration?.type === 'toolhead'
          ? `Toolhead ${slot.unit}`
          : `Unit ${slot.unit} Slot ${slot.slot}`;
      lines.push(`  ${slotName}: ${colorNames} ${status}`);
    });

    // Add manual swap instructions
    if (optimization.manualSwaps.length > 0) {
      lines.push('', 'MANUAL SWAP INSTRUCTIONS:');
      optimization.manualSwaps.forEach((swap, index) => {
        const fromName = stats.colors.find((c) => c.id === swap.fromColor)?.name || swap.fromColor;
        const toName = stats.colors.find((c) => c.id === swap.toColor)?.name || swap.toColor;
        const pauseInfo =
          swap.pauseEndLayer >= swap.pauseStartLayer
            ? `Pause between layers ${swap.pauseStartLayer}-${swap.pauseEndLayer}`
            : `Pause at layer ${swap.atLayer}`;
        const slotLocation =
          optimization.configuration?.type === 'toolhead'
            ? `Toolhead ${swap.unit}`
            : `Unit ${swap.unit} Slot ${swap.slot}`;
        lines.push(
          `  ${index + 1}. ${pauseInfo} (Z=${swap.zHeight}mm):`,
          `     Remove ${fromName} from ${slotLocation}`,
          `     Insert ${toName} into ${slotLocation}`
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
