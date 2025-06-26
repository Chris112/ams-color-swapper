import { AmsSlot } from './AmsSlot';
import { Color } from './Color';
import { ManualSwap } from '../../types';
import { ColorOverlapAnalyzer } from '../services/ColorOverlapAnalyzer';

/**
 * Domain model representing an optimized AMS configuration
 */
export type ParserAlgorithm =
  | 'optimized'
  | 'buffer'
  | 'streams'
  | 'regex'
  | 'fsm'
  | 'worker'
  | 'lazy';

export class AmsConfiguration {
  private slots: Map<string, AmsSlot> = new Map();
  private configType: 'ams' | 'toolhead';
  private unitCount: number;
  private slotsPerUnit: number;
  private totalSlots: number;
  private optimizationStrategy: 'legacy' | 'groups' | 'intervals' = 'intervals';
  private parserAlgorithm: ParserAlgorithm = 'optimized';

  constructor(
    configType: 'ams' | 'toolhead' = 'ams',
    unitCount: number = 1,
    strategy: 'legacy' | 'groups' | 'intervals' = 'intervals',
    parserAlgorithm: ParserAlgorithm = 'optimized'
  ) {
    this.configType = configType;
    this.unitCount = unitCount;
    this.slotsPerUnit = configType === 'ams' ? 4 : 1;
    this.totalSlots = this.unitCount * this.slotsPerUnit;
    this.optimizationStrategy = strategy;
    this.parserAlgorithm = parserAlgorithm;
    this.initializeSlots();
  }

  private initializeSlots(): void {
    for (let unit = 1; unit <= this.unitCount; unit++) {
      for (let slot = 1; slot <= this.slotsPerUnit; slot++) {
        const slotId = this.getSlotId(unit, slot);
        this.slots.set(slotId, new AmsSlot(unit, slot, true));
      }
    }
  }

  private getSlotId(unit: number, slot: number): string {
    return `${unit}-${slot}`;
  }

  /**
   * Get a specific slot by unit and slot number
   */
  getSlot(unitNumber: number, slotNumber: number): AmsSlot | undefined {
    const slotId = this.getSlotId(unitNumber, slotNumber);
    return this.slots.get(slotId);
  }

  /**
   * Get slot by ID
   */
  getSlotById(slotId: string): AmsSlot | undefined {
    return this.slots.get(slotId);
  }

  /**
   * Get all slots
   */
  getAllSlots(): AmsSlot[] {
    return Array.from(this.slots.values());
  }

  /**
   * Get system configuration
   */
  getConfiguration() {
    return {
      type: this.configType,
      unitCount: this.unitCount,
      totalSlots: this.totalSlots,
    };
  }

  /**
   * Assign colors to slots optimally
   */
  assignColors(colors: Color[]): void {
    // Clear existing assignments
    this.slots.forEach((slot) => slot.clear());

    if (colors.length <= this.totalSlots) {
      // Simple case: assign each color to its own slot
      let slotIndex = 0;
      const slotIds = Array.from(this.slots.keys()).sort();

      colors.forEach((color) => {
        if (slotIndex < slotIds.length) {
          const slot = this.slots.get(slotIds[slotIndex]);
          if (slot) {
            slot.assignColor(color);
          }
          slotIndex++;
        }
      });
    } else {
      // Complex case: need to share slots
      if (this.optimizationStrategy === 'legacy') {
        this.assignColorsWithSharing(colors);
      } else {
        this.assignColorsOptimized(colors);
      }
    }
  }

  /**
   * Get manual swaps required for this configuration
   */
  getManualSwaps(): ManualSwap[] {
    const swaps: ManualSwap[] = [];

    this.slots.forEach((slot) => {
      if (!slot.requiresSwaps) return;

      const colors = slot.colors;
      const sortedColors = [...colors].sort((a, b) => a.firstLayer - b.firstLayer);

      for (let i = 1; i < sortedColors.length; i++) {
        const fromColor = sortedColors[i - 1];
        const toColor = sortedColors[i];

        // Calculate the valid range for pausing
        // Can pause after the previous color ends and before the next color starts
        const pauseStartLayer = fromColor.lastLayer + 1;
        const pauseEndLayer = toColor.firstLayer - 1;

        swaps.push({
          unit: slot.unitNumber,
          slot: slot.slotNumber,
          fromColor: fromColor.id,
          toColor: toColor.id,
          atLayer: toColor.firstLayer,
          pauseStartLayer: pauseStartLayer,
          pauseEndLayer: pauseEndLayer,
          zHeight: 0, // Would be calculated from layer height
          reason:
            pauseEndLayer >= pauseStartLayer
              ? `Pause between layers ${pauseStartLayer}-${pauseEndLayer} to swap colors`
              : `Colors are adjacent - pause at layer ${toColor.firstLayer}`,
        });
      }
    });

    return swaps;
  }

  /**
   * Calculate time saved by this configuration
   */
  getTimeSaved(): number {
    const manualSwaps = this.getManualSwaps();
    return manualSwaps.length * 120; // 2 minutes per swap
  }

  /**
   * Get total number of unique colors
   */
  getTotalColors(): number {
    const uniqueColors = new Set<string>();
    this.slots.forEach((slot) => {
      slot.colorIds.forEach((id) => uniqueColors.add(id));
    });
    return uniqueColors.size;
  }

  /**
   * Check if configuration is valid
   */
  isValid(): boolean {
    // Check that no colors overlap within a slot
    for (const slot of this.slots.values()) {
      const colors = slot.colors;
      for (let i = 0; i < colors.length; i++) {
        for (let j = i + 1; j < colors.length; j++) {
          if (colors[i].overlapsWith(colors[j])) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * New optimized color assignment using advanced algorithms
   */
  private assignColorsOptimized(colors: Color[]): void {
    // Choose optimization strategy
    const result =
      this.optimizationStrategy === 'groups'
        ? ColorOverlapAnalyzer.optimizeSlotAssignments(colors, this.totalSlots)
        : ColorOverlapAnalyzer.optimizeByIntervals(colors, this.totalSlots);

    // Clear colors from all existing slots
    this.slots.forEach((slot) => slot.clear());

    // Apply the optimized assignments
    result.assignments.forEach((slotColors, slotNumber) => {
      // Convert slot number to unit and slot
      const unit = Math.ceil(slotNumber / this.slotsPerUnit);
      const slot = ((slotNumber - 1) % this.slotsPerUnit) + 1;
      const slotId = this.getSlotId(unit, slot);

      let amsSlot = this.slots.get(slotId);
      if (!amsSlot) {
        // This should ideally not happen if initializeSlots is called correctly
        // but as a fallback, create it.
        amsSlot = new AmsSlot(unit, slot, true);
        this.slots.set(slotId, amsSlot);
      }

      // Determine if slot should be permanent (only one color) or shared
      amsSlot.isPermanent = slotColors.length === 1;

      // Assign all colors to the slot (allow overlaps for shared slots)
      slotColors.forEach((color) => {
        amsSlot.assignColor(color, !amsSlot.isPermanent);
      });
    });
  }

  private assignColorsWithSharing(colors: Color[]): void {
    // Sort colors by usage (layer count) - most used get permanent slots
    const sortedColors = [...colors].sort((a, b) => b.layerCount - a.layerCount);

    // Assign top colors to permanent slots (all but last slot)
    const permanentSlots = this.totalSlots - 1;
    const slotIds = Array.from(this.slots.keys()).sort();

    for (let i = 0; i < permanentSlots && i < sortedColors.length; i++) {
      const slot = this.slots.get(slotIds[i]);
      if (slot) {
        slot.assignColor(sortedColors[i]);
      }
    }

    // Make last slot non-permanent for sharing
    const lastSlotId = slotIds[slotIds.length - 1];
    const [unitStr, slotStr] = lastSlotId.split('-');
    const lastSlot = new AmsSlot(parseInt(unitStr), parseInt(slotStr), false);
    this.slots.set(lastSlotId, lastSlot);

    // Assign ALL remaining colors to last slot
    const remainingColors = sortedColors.slice(permanentSlots);

    // First, try to group non-overlapping colors
    const groups = this.groupNonOverlappingColors(remainingColors);

    // Assign the largest non-overlapping group
    if (groups.length > 0) {
      const largestGroup = groups.reduce((a, b) => (a.length > b.length ? a : b));
      largestGroup.forEach((color) => lastSlot.assignColor(color, true));

      // Now assign any remaining colors that weren't in the largest group
      // These will require manual swaps but at least they'll be assigned
      const assignedColorIds = new Set(largestGroup.map((c) => c.id));
      remainingColors.forEach((color) => {
        if (!assignedColorIds.has(color.id)) {
          lastSlot.assignColor(color, true);
        }
      });
    } else {
      // If no groups found, just assign all remaining colors
      remainingColors.forEach((color) => lastSlot.assignColor(color, true));
    }
  }

  private groupNonOverlappingColors(colors: Color[]): Color[][] {
    const groups: Color[][] = [];

    for (const color of colors) {
      // Try to add to existing group
      let added = false;
      for (const group of groups) {
        if (group.every((c) => !c.overlapsWith(color))) {
          group.push(color);
          added = true;
          break;
        }
      }

      // Create new group if needed
      if (!added) {
        groups.push([color]);
      }
    }

    return groups;
  }

  /**
   * Get the current optimization strategy
   */
  getStrategy(): 'legacy' | 'groups' | 'intervals' {
    return this.optimizationStrategy;
  }

  /**
   * Set the optimization strategy
   */
  setStrategy(strategy: 'legacy' | 'groups' | 'intervals'): void {
    this.optimizationStrategy = strategy;
  }

  /**
   * Get the current parser algorithm
   */
  getParserAlgorithm(): ParserAlgorithm {
    return this.parserAlgorithm;
  }

  /**
   * Set the parser algorithm
   */
  setParserAlgorithm(algorithm: ParserAlgorithm): void {
    this.parserAlgorithm = algorithm;
  }
}
