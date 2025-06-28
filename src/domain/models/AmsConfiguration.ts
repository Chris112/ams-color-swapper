import { AmsSlot } from './AmsSlot';
import { Color } from './Color';
import { ManualSwap } from '../../types';
import { ColorOverlapAnalyzer, SwapDetail } from '../services/ColorOverlapAnalyzer';

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
  private lastOptimizationResult?: {
    assignments: Map<number, Color[]>;
    totalSwaps: number;
    swapDetails: SwapDetail[];
  };

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
    // If using optimization strategies, get swaps from the optimization result
    if (this.optimizationStrategy !== 'legacy' && this.lastOptimizationResult) {
      return this.getSwapsFromOptimizationResult();
    }

    // Legacy behavior for backwards compatibility
    const swaps: ManualSwap[] = [];

    this.slots.forEach((slot) => {
      if (!slot.requiresSwaps) return;

      const colors = slot.colors;
      const sortedColors = [...colors].sort((a, b) => a.firstLayer - b.firstLayer);

      // Generate swaps for all adjacent colors in shared slots
      for (let i = 0; i < sortedColors.length - 1; i++) {
        const fromColor = sortedColors[i];
        const toColor = sortedColors[i + 1];

        // Calculate the valid range for pausing
        const pauseStart = fromColor.lastLayer;
        const pauseEnd = toColor.firstLayer;

        // Determine optimal pause layer
        const atLayer =
          pauseStart < pauseEnd
            ? Math.floor((pauseStart + pauseEnd) / 2) // Non-overlapping: pause in the middle
            : pauseEnd; // Overlapping: pause at start of overlap

        swaps.push({
          unit: slot.unitNumber,
          slot: slot.slotNumber,
          fromColor: fromColor.id,
          toColor: toColor.id,
          atLayer,
          pauseStartLayer: Math.max(0, atLayer - 1),
          pauseEndLayer: atLayer,
          zHeight: 0, // Would be calculated from layer height
          reason: `Swap ${fromColor.id} → ${toColor.id} in Unit ${slot.unitNumber} Slot ${slot.slotNumber}`,
          timingOptions: {
            earliest: Math.max(0, fromColor.lastLayer - 10),
            latest: Math.min(toColor.firstLayer + 10, fromColor.lastLayer + 50),
            optimal: atLayer,
            adjacentOnly: false,
            bufferLayers: 5,
          },
          swapWindow: {
            startLayer: Math.max(0, fromColor.lastLayer - 10),
            endLayer: Math.min(toColor.firstLayer + 10, fromColor.lastLayer + 50),
            flexibilityScore: 80,
            constraints: [],
          },
          confidence: {
            timing: 85,
            necessity: 100,
            userControl: 70,
          },
        });
      }
    });

    // Sort swaps by layer to ensure they're in print order
    swaps.sort((a, b) => a.atLayer - b.atLayer);

    // Remove duplicate swaps (same colors at same layer)
    const uniqueSwaps = swaps.filter(
      (swap, index, self) =>
        index ===
        self.findIndex(
          (s) =>
            s.fromColor === swap.fromColor &&
            s.toColor === swap.toColor &&
            s.atLayer === swap.atLayer
        )
    );

    return uniqueSwaps;
  }

  /**
   * Get swaps from optimization result
   */
  private getSwapsFromOptimizationResult(): ManualSwap[] {
    if (!this.lastOptimizationResult) return [];

    const swaps: ManualSwap[] = [];
    const { swapDetails } = this.lastOptimizationResult;

    swapDetails.forEach((detail) => {
      // Convert slot number to unit and slot
      const unit = Math.ceil(detail.slot / this.slotsPerUnit);
      const slotInUnit = ((detail.slot - 1) % this.slotsPerUnit) + 1;

      // Calculate timing options based on swap details
      const fromColorObj = this.getColorById(detail.fromColor);
      const toColorObj = this.getColorById(detail.toColor);

      if (!fromColorObj || !toColorObj) return;

      const earliest = Math.max(0, fromColorObj.lastLayer - 10);
      const latest = Math.min(toColorObj.firstLayer + 10, fromColorObj.lastLayer + 50);
      const optimal = detail.atLayer;

      swaps.push({
        unit,
        slot: slotInUnit,
        fromColor: detail.fromColor,
        toColor: detail.toColor,
        atLayer: detail.atLayer,
        pauseStartLayer: Math.max(0, detail.atLayer - 1),
        pauseEndLayer: detail.atLayer,
        reason: `Swap ${detail.fromColor} → ${detail.toColor} in Unit ${unit} Slot ${slotInUnit}`,
        timingOptions: {
          earliest,
          latest,
          optimal,
          adjacentOnly: false,
          bufferLayers: 5,
        },
        swapWindow: {
          startLayer: earliest,
          endLayer: latest,
          flexibilityScore: ((latest - earliest) / 10) * 10, // 0-100 score
          constraints: [],
        },
        confidence: {
          timing: 0.9,
          necessity: 1.0,
          userControl: 0.8,
        },
      });
    });

    return swaps;
  }

  /**
   * Get color by ID from all slots
   */
  private getColorById(colorId: string): Color | undefined {
    for (const slot of this.slots.values()) {
      const color = slot.colors.find((c) => c.id === colorId);
      if (color) return color;
    }
    return undefined;
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

    // Store the optimization result
    this.lastOptimizationResult = result;

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
