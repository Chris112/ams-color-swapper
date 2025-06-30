import { Color } from '../models/Color';
import { ColorOverlapAnalyzer, SlotOptimizationResult, SwapDetail } from './ColorOverlapAnalyzer';

interface Assignment {
  [colorId: string]: number; // Maps color ID to AMS slot number
}

export class SimulatedAnnealingOptimizer {
  private colors: Color[];
  private maxSlots: number;
  private initialTemperature: number;
  private coolingRate: number;
  private iterations: number;

  constructor(
    colors: Color[],
    maxSlots: number,
    initialTemperature: number = 10000,
    coolingRate: number = 0.995,
    iterations: number = 10000
  ) {
    this.colors = colors;
    this.maxSlots = maxSlots;
    this.initialTemperature = initialTemperature;
    this.coolingRate = coolingRate;
    this.iterations = iterations;
  }

  /**
   * Runs the Simulated Annealing algorithm to find an optimized color assignment.
   */
  optimize(): SlotOptimizationResult {
    // Safety check for invalid configuration
    if (this.maxSlots < 1) {
      throw new Error(`Invalid maxSlots: ${this.maxSlots}. Must be at least 1.`);
    }

    if (this.colors.length <= this.maxSlots) {
      // If colors are less than or equal to max slots, no optimization needed, each gets its own slot
      const assignments = new Map<number, Color[]>();
      this.colors.forEach((color, index) => {
        assignments.set(index + 1, [color]);
      });
      return { assignments, totalSwaps: 0, swapDetails: [] };
    }

    let currentAssignment: Assignment = this.generateInitialAssignment();
    let currentCost = this.calculateCost(currentAssignment);
    let bestAssignment = { ...currentAssignment };
    let bestCost = currentCost;

    let temperature = this.initialTemperature;

    for (let i = 0; i < this.iterations; i++) {
      const newAssignment = this.generateNeighbor(currentAssignment);
      const newCost = this.calculateCost(newAssignment);

      if (
        newCost < currentCost ||
        Math.random() < Math.exp((currentCost - newCost) / temperature)
      ) {
        currentAssignment = newAssignment;
        currentCost = newCost;
      }

      if (currentCost < bestCost) {
        bestAssignment = { ...currentAssignment };
        bestCost = currentCost;
      }

      temperature *= this.coolingRate;
      if (temperature < 0.1) {
        // Stop if temperature is too low
        temperature = 0.1;
      }
    }

    return this.formatResult(bestAssignment, bestCost);
  }

  /**
   * Generates a random initial assignment of colors to slots.
   * Tries to distribute colors somewhat evenly.
   */
  private generateInitialAssignment(): Assignment {
    const assignment: Assignment = {};
    this.colors.forEach((color, index) => {
      assignment[color.id] = (index % this.maxSlots) + 1; // Assign to slots 1 to maxSlots
    });
    return assignment;
  }

  /**
   * Calculates the total number of manual swaps for a given assignment.
   * This is the cost function for the SA algorithm.
   */
  private calculateCost(assignment: Assignment): number {
    const slots: Map<number, Color[]> = new Map();
    for (let i = 1; i <= this.maxSlots; i++) {
      slots.set(i, []);
    }

    this.colors.forEach((color) => {
      const slot = assignment[color.id];
      if (slot) {
        slots.get(slot)?.push(color);
      }
    });

    let totalSwaps = 0;
    slots.forEach((colorsInSlot) => {
      totalSwaps += ColorOverlapAnalyzer.calculateSwapsForGroup(colorsInSlot);
    });

    return totalSwaps;
  }

  /**
   * Generates a neighboring assignment by making a small random change.
   * Options:
   * 1. Move a random color to a different random slot.
   * 2. Swap two random colors between their assigned slots.
   */
  private generateNeighbor(currentAssignment: Assignment): Assignment {
    const newAssignment = { ...currentAssignment };
    const colorIds = this.colors.map((c) => c.id);

    if (colorIds.length === 0) return newAssignment;

    const changeType = Math.random();

    if (changeType < 0.7) {
      // 70% chance to move a single color
      const randomColorId = colorIds[Math.floor(Math.random() * colorIds.length)];

      // If we only have 1 slot, we can't move colors to different slots
      if (this.maxSlots === 1) {
        return newAssignment;
      }

      let newSlot = Math.floor(Math.random() * this.maxSlots) + 1;
      let attempts = 0;
      while (newSlot === newAssignment[randomColorId] && attempts < 10) {
        newSlot = Math.floor(Math.random() * this.maxSlots) + 1;
        attempts++;
      }

      if (newSlot !== newAssignment[randomColorId]) {
        newAssignment[randomColorId] = newSlot;
      }
    } else {
      // 30% chance to swap two colors
      if (colorIds.length < 2) return newAssignment; // Need at least two colors to swap

      const idx1 = Math.floor(Math.random() * colorIds.length);
      let idx2 = Math.floor(Math.random() * colorIds.length);
      while (idx1 === idx2) {
        idx2 = Math.floor(Math.random() * colorIds.length);
      }

      const color1Id = colorIds[idx1];
      const color2Id = colorIds[idx2];

      const slot1 = newAssignment[color1Id];
      const slot2 = newAssignment[color2Id];

      newAssignment[color1Id] = slot2;
      newAssignment[color2Id] = slot1;
    }

    return newAssignment;
  }

  /**
   * Formats the best assignment found into the SlotOptimizationResult structure.
   */
  private formatResult(assignment: Assignment, totalSwaps: number): SlotOptimizationResult {
    const assignments = new Map<number, Color[]>();
    for (let i = 1; i <= this.maxSlots; i++) {
      assignments.set(i, []);
    }

    this.colors.forEach((color) => {
      const slot = assignment[color.id];
      if (slot) {
        assignments.get(slot)?.push(color);
      }
    });

    const manualSwaps: SwapDetail[] = [];
    assignments.forEach((colorsInSlot, slotNumber) => {
      if (colorsInSlot.length > 1) {
        const sortedColors = [...colorsInSlot].sort((a, b) => a.firstLayer - b.firstLayer);
        for (let i = 1; i < sortedColors.length; i++) {
          manualSwaps.push({
            slot: slotNumber,
            fromColor: sortedColors[i - 1].id,
            toColor: sortedColors[i].id,
            atLayer: sortedColors[i].firstLayer,
          });
        }
      }
    });

    return {
      assignments,
      totalSwaps,
      swapDetails: manualSwaps,
    };
  }
}
