import { OptimizationResult, SlotAssignment } from '../../types';
import { AmsConfiguration, Color } from '../models';

/**
 * Maps between AMS configuration domain model and infrastructure types
 */
export class AmsConfigurationMapper {
  /**
   * Convert AmsConfiguration to OptimizationResult
   */
  static toOptimizationResult(
    config: AmsConfiguration,
    colors: Color[]
  ): OptimizationResult {
    const slotAssignments: SlotAssignment[] = config.getAllSlots()
      .filter(slot => !slot.isEmpty)
      .map(slot => ({
        slot: slot.slotNumber,
        colors: slot.colorIds,
        isPermanent: slot.isPermanent
      }));

    const manualSwaps = config.getManualSwaps();
    
    // Find colors that can share slots
    const canShareSlots: string[] = [];
    config.getAllSlots().forEach(slot => {
      if (slot.requiresSwaps) {
        canShareSlots.push(...slot.colorIds);
      }
    });

    return {
      totalColors: config.getTotalColors(),
      requiredSlots: slotAssignments.length,
      slotAssignments,
      manualSwaps,
      estimatedTimeSaved: config.getTimeSaved(),
      canShareSlots
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