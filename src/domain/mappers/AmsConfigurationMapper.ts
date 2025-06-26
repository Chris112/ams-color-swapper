import { OptimizationResult, SlotAssignment, ColorPair } from '../../types';
import { AmsConfiguration, Color } from '../models';

/**
 * Maps between AMS configuration domain model and infrastructure types
 */
export class AmsConfigurationMapper {
  /**
   * Convert AmsConfiguration to OptimizationResult
   */
  static toOptimizationResult(config: AmsConfiguration, _colors: Color[]): OptimizationResult {
    // Include ALL slots, even empty ones, to ensure proper display in UI
    const slotAssignments: SlotAssignment[] = config.getAllSlots().map((slot) => ({
      unit: slot.unitNumber,
      slot: slot.slotNumber,
      slotId: slot.slotId,
      colors: slot.colorIds,
      isPermanent: slot.isPermanent,
    }));

    const manualSwaps = config.getManualSwaps();

    // Find colors that can share slots
    const canShareSlots: ColorPair[] = [];
    config.getAllSlots().forEach((slot) => {
      if (slot.requiresSwaps && slot.colorIds.length > 1) {
        // For each pair of colors in a shared slot
        for (let i = 0; i < slot.colorIds.length - 1; i++) {
          for (let j = i + 1; j < slot.colorIds.length; j++) {
            canShareSlots.push({
              color1: slot.colorIds[i],
              color2: slot.colorIds[j],
              canShare: true,
              reason: `Colors share ${slot.displayName} with manual swaps`,
            });
          }
        }
      }
    });

    return {
      totalColors: config.getTotalColors(),
      requiredSlots: slotAssignments.length,
      slotAssignments,
      manualSwaps,
      estimatedTimeSaved: config.getTimeSaved(),
      canShareSlots,
      configuration: config.getConfiguration(),
    };
  }

  /**
   * Create AmsConfiguration from colors
   */
  static fromColors(colors: Color[]): AmsConfiguration {
    const config = new AmsConfiguration();
    config.assignColors(colors);
    return config;
  }
}
