import { AmsConfigurationMapper, PrintMapper } from '../domain/mappers';
import { AmsConfiguration } from '../domain/models';
import { SimulatedAnnealingOptimizer } from '../domain/services/SimulatedAnnealingOptimizer';
import { GcodeStats } from '../types/gcode';
import { OptimizationResult } from '../types/optimization';
import { SystemConfiguration } from '../types/configuration';
import { Logger } from '../utils/logger';
import { LayerConstraintAnalyzer } from './LayerConstraintAnalyzer';

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
    // Use provided configuration or default to single AMS unit
    const config = configuration || {
      type: 'ams' as const,
      unitCount: 1,
      totalSlots: 4,
    };

    // Run constraint validation first
    const constraintValidation = LayerConstraintAnalyzer.validateLayerConstraints(stats, config);

    // Log constraint validation results
    if (constraintValidation.hasViolations) {
      this.logger.warn(
        `Constraint violations detected: ${constraintValidation.summary.impossibleLayerCount} impossible layers`
      );
      constraintValidation.violations.forEach((violation, index) => {
        this.logger.warn(`Violation ${index + 1}`, {
          layers: `${violation.startLayer}-${violation.endLayer}`,
          maxColors: violation.maxColorsRequired,
          availableSlots: violation.availableSlots,
          suggestions: violation.suggestions.length,
        });
      });
    } else {
      this.logger.info(
        'No constraint violations detected - print is valid for current configuration'
      );
    }

    // Attach constraint validation to stats for UI consumption
    stats.constraintValidation = constraintValidation;

    // Convert to domain model
    const print = PrintMapper.toDomain(stats);

    // Log deduplication info if present
    if (stats.deduplicationInfo) {
      this.logger.info(
        `Color deduplication freed ${stats.deduplicationInfo.freedSlots.length} slots: ${stats.deduplicationInfo.freedSlots.join(', ')}`
      );
    }

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
          slotId: `1-${slotNum}`,
          colors: colors.map((c) => c.id),
          isPermanent: colors.length === 1,
        })
      );

      result = {
        totalColors: print.colors.length,
        requiredSlots: saResult.assignments.size,
        manualSwaps: saResult.swapDetails.map((swap) => {
          // Find the colors to understand their usage patterns
          const fromColor = stats.colors.find((c) => c.id === swap.fromColor);
          const toColor = stats.colors.find((c) => c.id === swap.toColor);

          // Calculate meaningful pause window
          let pauseStart = swap.atLayer;
          let pauseEnd = swap.atLayer;
          let earliest = swap.atLayer;
          let latest = swap.atLayer;

          if (fromColor && toColor) {
            // For a swap, we need to remove fromColor and insert toColor
            // The swap should happen after fromColor is no longer needed
            // and before toColor is needed

            // Find the actual transition point
            const lastFromColorUse = fromColor.lastLayer;
            const firstToColorUse = toColor.firstLayer;

            if (firstToColorUse > lastFromColorUse) {
              // There's a gap - we can swap anytime in this window
              pauseStart = lastFromColorUse + 1;
              pauseEnd = firstToColorUse - 1;
              earliest = pauseStart;
              latest = pauseEnd;
            } else {
              // Colors overlap or are adjacent - must swap at the exact transition
              // Use the swap layer calculated by the optimization algorithm
              pauseStart = pauseEnd = swap.atLayer;
              earliest = latest = swap.atLayer;
            }
          }

          const flexibilityRange = latest - earliest;
          const flexibilityScore = Math.min(100, (flexibilityRange / 10) * 100);

          return {
            unit: Math.ceil(swap.slot / 4),
            slot: ((swap.slot - 1) % 4) + 1,
            fromColor: swap.fromColor,
            toColor: swap.toColor,
            atLayer: swap.atLayer,
            pauseStartLayer: pauseStart,
            pauseEndLayer: pauseEnd,
            zHeight: 0,
            reason:
              flexibilityRange > 0
                ? `Swap ${swap.fromColor} → ${swap.toColor} (${flexibilityRange + 1} layer window)`
                : `Critical swap ${swap.fromColor} → ${swap.toColor} at exact layer`,
            timingOptions: {
              earliest,
              latest,
              optimal: swap.atLayer,
              adjacentOnly: flexibilityRange === 0,
              bufferLayers: Math.max(0, Math.floor(flexibilityRange / 2)),
            },
            swapWindow: {
              startLayer: earliest,
              endLayer: latest,
              flexibilityScore,
              constraints: flexibilityRange === 0 ? ['Colors are adjacent - no flexibility'] : [],
            },
            confidence: {
              timing: flexibilityRange > 5 ? 95 : 75,
              necessity: 100,
              userControl: flexibilityRange > 0 ? 90 : 30,
            },
          };
        }),
        estimatedTimeSaved: 0, // SA doesn't calculate this directly, need to derive or estimate
        slotAssignments: slotAssignments,
        canShareSlots: [], // TODO: Calculate actual color sharing pairs
        configuration: config,
      };

      // Calculate estimated time saved (simple estimation for now)
      // A more accurate calculation would involve comparing the original number of tool changes
      // with the optimized number of manual swaps.
      const originalToolChanges = stats.toolChanges?.length || 0;
      const optimizedSwaps = saResult.swapDetails.length;
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
