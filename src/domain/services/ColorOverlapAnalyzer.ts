import { Color } from '../models/Color';
import { getFromMap } from '../../utils/typeGuards';

export interface ColorOverlap {
  color1: string;
  color2: string;
  overlapCount: number;
  overlapPercentage: number;
}

export interface ColorGroup {
  colors: Color[];
  requiredSwaps: number;
}

export interface SlotOptimizationResult {
  assignments: Map<number, Color[]>;
  totalSwaps: number;
  swapDetails: SwapDetail[];
}

export interface SwapDetail {
  slot: number;
  fromColor: string;
  toColor: string;
  atLayer: number;
}

/**
 * Analyzes color overlaps and provides optimization strategies
 */
export class ColorOverlapAnalyzer {
  /**
   * Build an overlap matrix for all colors
   */
  static buildOverlapMatrix(colors: Color[]): Map<string, Set<string>> {
    const overlaps = new Map<string, Set<string>>();

    // Initialize map for all colors
    colors.forEach((color) => {
      overlaps.set(color.id, new Set<string>());
    });

    // Check each pair of colors for overlap
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const color1 = colors[i];
        const color2 = colors[j];

        if (this.hasOverlap(color1, color2)) {
          getFromMap(
            overlaps,
            color1.id,
            `Color overlap set not found for color: ${color1.id}`
          ).add(color2.id);
          getFromMap(
            overlaps,
            color2.id,
            `Color overlap set not found for color: ${color2.id}`
          ).add(color1.id);
        }
      }
    }

    return overlaps;
  }

  /**
   * Check if two colors overlap in their layer ranges
   */
  static hasOverlap(color1: Color, color2: Color): boolean {
    return !(color1.lastLayer < color2.firstLayer || color2.lastLayer < color1.firstLayer);
  }

  /**
   * Find groups of colors that can share a slot (no overlaps within group)
   */
  static findNonOverlappingGroups(colors: Color[]): ColorGroup[] {
    const overlaps = this.buildOverlapMatrix(colors);
    const groups: ColorGroup[] = [];
    const assigned = new Set<string>();

    // Try to form groups using a greedy approach
    for (const color of colors) {
      if (assigned.has(color.id)) continue;

      // Start a new group with this color
      const group: Color[] = [color];
      assigned.add(color.id);

      // Try to add more colors that don't overlap with any in the group
      for (const candidate of colors) {
        if (assigned.has(candidate.id)) continue;

        // Check if candidate overlaps with any color in the group
        const overlapsWithGroup = group.some((groupColor) =>
          getFromMap(
            overlaps,
            groupColor.id,
            `Color overlap set not found for color: ${groupColor.id}`
          ).has(candidate.id)
        );

        if (!overlapsWithGroup) {
          group.push(candidate);
          assigned.add(candidate.id);
        }
      }

      // Calculate swaps needed for this group
      const swaps = this.calculateSwapsForGroup(group);
      groups.push({ colors: group, requiredSwaps: swaps });
    }

    return groups;
  }

  /**
   * Calculate the number of swaps needed for a group of colors sharing a slot
   */
  static calculateSwapsForGroup(colors: Color[]): number {
    if (colors.length <= 1) return 0;

    // Sort by first layer
    const sorted = [...colors].sort((a, b) => a.firstLayer - b.firstLayer);

    // Count transitions between colors
    return sorted.length - 1;
  }

  /**
   * Find optimal slot assignments to minimize total swaps
   */
  static optimizeSlotAssignments(colors: Color[], maxSlots: number = 4): SlotOptimizationResult {
    if (colors.length <= maxSlots) {
      // Simple case: each color gets its own slot
      const assignments = new Map<number, Color[]>();
      colors.forEach((color, index) => {
        assignments.set(index + 1, [color]);
      });

      return {
        assignments,
        totalSwaps: 0,
        swapDetails: [],
      };
    }

    // Complex case: need to share slots
    const groups = this.findNonOverlappingGroups(colors);

    // Sort groups by size (larger groups first) to maximize slot utilization
    groups.sort((a, b) => b.colors.length - a.colors.length);

    // Assign groups to slots
    const assignments = new Map<number, Color[]>();
    const swapDetails: SwapDetail[] = [];
    let totalSwaps = 0;

    // First, assign as many complete groups as possible
    let slotIndex = 1;
    let groupIndex = 0;

    while (slotIndex <= maxSlots && groupIndex < groups.length) {
      const group = groups[groupIndex];
      assignments.set(slotIndex, group.colors);

      // Calculate swap details for this slot
      if (group.colors.length > 1) {
        const sorted = [...group.colors].sort((a, b) => a.firstLayer - b.firstLayer);
        for (let i = 1; i < sorted.length; i++) {
          swapDetails.push({
            slot: slotIndex,
            fromColor: sorted[i - 1].id,
            toColor: sorted[i].id,
            atLayer: sorted[i].firstLayer,
          });
          totalSwaps++;
        }
      }

      slotIndex++;
      groupIndex++;
    }

    // Handle remaining groups by merging into existing slots
    while (groupIndex < groups.length) {
      const remainingGroup = groups[groupIndex];

      // Find the best slot to merge into (least increase in swaps)
      let bestSlot = 1;
      let bestSwapIncrease = Infinity;

      for (let slot = 1; slot <= Math.min(slotIndex - 1, maxSlots); slot++) {
        const existingColors = getFromMap(
          assignments,
          slot,
          `Slot assignment not found for slot: ${slot}`
        );
        const mergedColors = [...existingColors, ...remainingGroup.colors];
        const newSwaps = this.calculateSwapsForGroup(mergedColors);
        const currentSwaps = this.calculateSwapsForGroup(existingColors);
        const swapIncrease = newSwaps - currentSwaps;

        if (swapIncrease < bestSwapIncrease) {
          bestSwapIncrease = swapIncrease;
          bestSlot = slot;
        }
      }

      // Merge into best slot
      const existingColors = getFromMap(
        assignments,
        bestSlot,
        `Slot assignment not found for slot: ${bestSlot}`
      );
      assignments.set(bestSlot, [...existingColors, ...remainingGroup.colors]);
      totalSwaps += bestSwapIncrease;

      // Update swap details
      const mergedSorted = [
        ...getFromMap(assignments, bestSlot, `Slot assignment not found for slot: ${bestSlot}`),
      ].sort((a, b) => a.firstLayer - b.firstLayer);
      // Clear old swaps for this slot and recalculate
      swapDetails.filter((s) => s.slot !== bestSlot);
      for (let i = 1; i < mergedSorted.length; i++) {
        swapDetails.push({
          slot: bestSlot,
          fromColor: mergedSorted[i - 1].id,
          toColor: mergedSorted[i].id,
          atLayer: mergedSorted[i].firstLayer,
        });
      }

      groupIndex++;
    }

    return {
      assignments,
      totalSwaps,
      swapDetails,
    };
  }

  /**
   * Alternative optimization: Interval scheduling approach
   */
  static optimizeByIntervals(colors: Color[], maxSlots: number = 4): SlotOptimizationResult {
    // If we have more colors than slots, we MUST share slots
    const mustShareSlots = colors.length > maxSlots;

    // Sort colors by start layer
    const sorted = [...colors].sort((a, b) => a.firstLayer - b.firstLayer);

    // Initialize slots
    const slots: Color[][] = Array(maxSlots)
      .fill(null)
      .map(() => []);
    const slotEndLayers: number[] = Array(maxSlots).fill(-1);

    // If we must share slots, distribute colors more evenly
    if (mustShareSlots) {
      // Calculate how many colors per slot on average
      // const colorsPerSlot = Math.ceil(colors.length / maxSlots);

      // For even distribution, assign colors round-robin to ensure all slots get used
      sorted.forEach((color, index) => {
        const slotIndex = index % maxSlots;
        slots[slotIndex].push(color);
      });
    } else {
      // Original algorithm for when we have enough slots
      for (const color of sorted) {
        // Find a slot where this color can fit without overlap
        let assigned = false;

        for (let i = 0; i < maxSlots; i++) {
          if (slotEndLayers[i] < color.firstLayer) {
            // This color can go in this slot
            slots[i].push(color);
            slotEndLayers[i] = color.lastLayer;
            assigned = true;
            break;
          }
        }

        if (!assigned) {
          // Need to share with an existing slot - find the best one
          let bestSlot = 0;
          let earliestEnd = slotEndLayers[0];

          for (let i = 1; i < maxSlots; i++) {
            if (slotEndLayers[i] < earliestEnd) {
              earliestEnd = slotEndLayers[i];
              bestSlot = i;
            }
          }

          slots[bestSlot].push(color);
          slotEndLayers[bestSlot] = Math.max(slotEndLayers[bestSlot], color.lastLayer);
        }
      }
    }

    // Convert to result format
    const assignments = new Map<number, Color[]>();
    const swapDetails: SwapDetail[] = [];
    let totalSwaps = 0;

    slots.forEach((slotColors, index) => {
      if (slotColors.length > 0) {
        assignments.set(index + 1, slotColors);

        // Calculate swaps for this slot
        if (slotColors.length > 1) {
          const sorted = [...slotColors].sort((a, b) => a.firstLayer - b.firstLayer);

          // For shared slots, we need swaps between ALL colors, not just overlapping ones
          // This is because the user expects to see swaps when more colors than slots
          for (let i = 1; i < sorted.length; i++) {
            const prevColor = sorted[i - 1];
            const nextColor = sorted[i];

            // Determine swap point: after previous color's last use, before next color's first use
            // If they overlap, swap at the beginning of the overlap
            const swapLayer =
              prevColor.lastLayer < nextColor.firstLayer
                ? Math.floor((prevColor.lastLayer + nextColor.firstLayer) / 2)
                : nextColor.firstLayer;

            swapDetails.push({
              slot: index + 1,
              fromColor: prevColor.id,
              toColor: nextColor.id,
              atLayer: swapLayer,
            });
            totalSwaps++;
          }
        }
      }
    });

    return {
      assignments,
      totalSwaps,
      swapDetails,
    };
  }
}
