import { AmsSlot } from './AmsSlot';
import { Color } from './Color';
import { ManualSwap } from '../../types';

/**
 * Domain model representing an optimized AMS configuration
 */
export class AmsConfiguration {
  private slots: Map<number, AmsSlot> = new Map();
  private readonly MAX_SLOTS = 4;

  constructor() {
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
      this.assignColorsWithSharing(colors);
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

        swaps.push({
          slot: slot.slotNumber,
          fromColor: fromColor.id,
          toColor: toColor.id,
          atLayer: toColor.firstLayer,
          zHeight: 0, // Would be calculated from layer height
          reason: `Color ${toColor.displayName} starts at layer ${toColor.firstLayer}`
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

    // Assign remaining colors to slot 4
    const remainingColors = sortedColors.slice(3);
    
    // Group non-overlapping colors
    const groups = this.groupNonOverlappingColors(remainingColors);
    
    // Assign the largest group to slot 4
    if (groups.length > 0) {
      const largestGroup = groups.reduce((a, b) => a.length > b.length ? a : b);
      largestGroup.forEach(color => slot4.assignColor(color));
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