import { AmsSlot } from './AmsSlot';
import { Color } from './Color';
import { ManualSwap } from '../../types';
import { ColorOverlapAnalyzer } from '../services/ColorOverlapAnalyzer';

/**
 * Domain model representing an optimized AMS configuration
 */
export class AmsConfiguration {
  private slots: Map<number, AmsSlot> = new Map();
  private readonly MAX_SLOTS = 4;
  private optimizationStrategy: 'legacy' | 'groups' | 'intervals' = 'intervals';

  constructor(strategy: 'legacy' | 'groups' | 'intervals' = 'intervals') {
    this.optimizationStrategy = strategy;
    // Initialize all 4 slots
    for (let i = 1; i <= this.MAX_SLOTS; i++) {
      this.slots.set(i, new AmsSlot(i, true));
    }
  }

  /**
   * Get a specific slot
   */
  getSlot(slotNumber: number): AmsSlot | undefined {
    return this.slots.get(slotNumber);
  }

  /**
   * Get all slots
   */
  getAllSlots(): AmsSlot[] {
    return Array.from(this.slots.values());
  }

  /**
   * Assign colors to slots optimally
   */
  assignColors(colors: Color[]): void {
    // Clear existing assignments
    this.slots.forEach(slot => slot.clear());

    if (colors.length <= this.MAX_SLOTS) {
      // Simple case: assign each color to its own slot
      colors.forEach((color, index) => {
        const slot = this.slots.get(index + 1);
        if (slot) {
          slot.assignColor(color);
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

    this.slots.forEach(slot => {
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
          slot: slot.slotNumber,
          fromColor: fromColor.id,
          toColor: toColor.id,
          atLayer: toColor.firstLayer,
          pauseStartLayer: pauseStartLayer,
          pauseEndLayer: pauseEndLayer,
          zHeight: 0, // Would be calculated from layer height
          reason: pauseEndLayer >= pauseStartLayer 
            ? `Pause between layers ${pauseStartLayer}-${pauseEndLayer} to swap colors`
            : `Colors are adjacent - pause at layer ${toColor.firstLayer}`
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
    this.slots.forEach(slot => {
      slot.colorIds.forEach(id => uniqueColors.add(id));
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
    const result = this.optimizationStrategy === 'groups' 
      ? ColorOverlapAnalyzer.optimizeSlotAssignments(colors, this.MAX_SLOTS)
      : ColorOverlapAnalyzer.optimizeByIntervals(colors, this.MAX_SLOTS);
    
    // Clear all slots first
    this.slots.clear();
    
    // Apply the optimized assignments
    result.assignments.forEach((slotColors, slotNumber) => {
      // Determine if slot should be permanent (only one color) or shared
      const isPermanent = slotColors.length === 1;
      const slot = new AmsSlot(slotNumber, isPermanent);
      
      // Assign all colors to the slot (allow overlaps for shared slots)
      slotColors.forEach(color => {
        slot.assignColor(color, !isPermanent);
      });
      
      this.slots.set(slotNumber, slot);
    });
    
    // Ensure we have all 4 slots initialized (even if empty)
    for (let i = 1; i <= this.MAX_SLOTS; i++) {
      if (!this.slots.has(i)) {
        this.slots.set(i, new AmsSlot(i, true));
      }
    }
  }

  private assignColorsWithSharing(colors: Color[]): void {
    // Sort colors by usage (layer count) - most used get permanent slots
    const sortedColors = [...colors].sort((a, b) => b.layerCount - a.layerCount);

    // Assign top 3 colors to permanent slots
    for (let i = 0; i < 3 && i < sortedColors.length; i++) {
      const slot = this.slots.get(i + 1);
      if (slot) {
        slot.assignColor(sortedColors[i]);
      }
    }

    // Make slot 4 non-permanent for sharing
    const slot4 = new AmsSlot(4, false);
    this.slots.set(4, slot4);

    // Assign ALL remaining colors to slot 4
    const remainingColors = sortedColors.slice(3);
    
    // First, try to group non-overlapping colors
    const groups = this.groupNonOverlappingColors(remainingColors);
    
    // Assign the largest non-overlapping group
    if (groups.length > 0) {
      const largestGroup = groups.reduce((a, b) => a.length > b.length ? a : b);
      largestGroup.forEach(color => slot4.assignColor(color, true));
      
      // Now assign any remaining colors that weren't in the largest group
      // These will require manual swaps but at least they'll be assigned
      const assignedColorIds = new Set(largestGroup.map(c => c.id));
      remainingColors.forEach(color => {
        if (!assignedColorIds.has(color.id)) {
          slot4.assignColor(color, true);
        }
      });
    } else {
      // If no groups found, just assign all remaining colors
      remainingColors.forEach(color => slot4.assignColor(color, true));
    }
  }

  private groupNonOverlappingColors(colors: Color[]): Color[][] {
    const groups: Color[][] = [];

    for (const color of colors) {
      // Try to add to existing group
      let added = false;
      for (const group of groups) {
        if (group.every(c => !c.overlapsWith(color))) {
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
}