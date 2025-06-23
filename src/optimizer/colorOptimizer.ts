import { GcodeStats, OptimizationResult, SlotAssignment, ManualSwap, ColorPair } from '../types';
import { Logger } from '../debug/logger';

export class ColorOptimizer {
  private logger: Logger;
  private readonly MAX_AMS_SLOTS = 4;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  optimize(stats: GcodeStats): OptimizationResult {
    this.logger.info(`Starting optimization for ${stats.colors.length} colors`);

    // Filter out unused colors
    const usedColors = stats.colors.filter(c => c.layerCount > 0);
    const statsWithUsedColors = { ...stats, colors: usedColors };
    
    this.logger.info(`Found ${usedColors.length} used colors out of ${stats.colors.length} defined`);

    const colorPairs = this.analyzeColorOverlaps(statsWithUsedColors);
    const slotAssignments = this.assignSlots(statsWithUsedColors, colorPairs);
    const manualSwaps = this.calculateSwaps(statsWithUsedColors, slotAssignments);

    const result: OptimizationResult = {
      totalColors: usedColors.length,
      requiredSlots: Math.min(slotAssignments.length, this.MAX_AMS_SLOTS),
      slotAssignments,
      manualSwaps,
      estimatedTimeSaved: this.estimateTimeSaved(statsWithUsedColors, manualSwaps),
      canShareSlots: colorPairs.filter(p => p.canShare)
    };

    this.logger.info(`Optimization complete: ${result.requiredSlots} slots needed, ${manualSwaps.length} swaps required`);

    return result;
  }

  private analyzeColorOverlaps(stats: GcodeStats): ColorPair[] {
    const pairs: ColorPair[] = [];

    for (let i = 0; i < stats.colors.length; i++) {
      for (let j = i + 1; j < stats.colors.length; j++) {
        const color1 = stats.colors[i];
        const color2 = stats.colors[j];

        const overlap = this.checkOverlap(color1.firstLayer, color1.lastLayer, color2.firstLayer, color2.lastLayer);

        pairs.push({
          color1: color1.id,
          color2: color2.id,
          canShare: !overlap,
          reason: overlap 
            ? `Colors overlap between layers ${Math.max(color1.firstLayer, color2.firstLayer)}-${Math.min(color1.lastLayer, color2.lastLayer)}`
            : 'No overlap - can share slot'
        });

        if (!overlap) {
          this.logger.info(`${color1.id} and ${color2.id} can share a slot`);
        }
      }
    }

    return pairs;
  }

  private checkOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
    return start1 <= end2 && start2 <= end1;
  }

  private assignSlots(stats: GcodeStats, colorPairs: ColorPair[]): SlotAssignment[] {
    const assignments: SlotAssignment[] = [];
    const assignedColors = new Set<string>();

    if (stats.colors.length <= this.MAX_AMS_SLOTS) {
      stats.colors.forEach((color, index) => {
        assignments.push({
          slot: index + 1,
          colors: [color.id],
          isPermanent: true
        });
      });
      return assignments;
    }

    const colorGraph = this.buildColorGraph(stats.colors.map(c => c.id), colorPairs);
    const colorGroups = this.findColorGroups(colorGraph);

    colorGroups.forEach((group, index) => {
      if (index < this.MAX_AMS_SLOTS) {
        assignments.push({
          slot: index + 1,
          colors: group,
          isPermanent: group.length === 1
        });
        group.forEach(color => assignedColors.add(color));
      }
    });

    stats.colors.forEach(color => {
      if (!assignedColors.has(color.id)) {
        const bestSlot = this.findBestSlot(color, assignments, stats);
        if (bestSlot) {
          bestSlot.colors.push(color.id);
          bestSlot.isPermanent = false;
        }
      }
    });

    return assignments;
  }

  private buildColorGraph(colors: string[], pairs: ColorPair[]): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    
    colors.forEach(color => graph.set(color, new Set()));
    
    pairs.forEach(pair => {
      if (pair.canShare) {
        graph.get(pair.color1)?.add(pair.color2);
        graph.get(pair.color2)?.add(pair.color1);
      }
    });

    return graph;
  }

  private findColorGroups(graph: Map<string, Set<string>>): string[][] {
    const groups: string[][] = [];
    const visited = new Set<string>();

    for (const [color, neighbors] of graph.entries()) {
      if (!visited.has(color)) {
        const group = [color];
        visited.add(color);

        for (const neighbor of neighbors) {
          if (!visited.has(neighbor) && this.canAddToGroup(neighbor, group, graph)) {
            group.push(neighbor);
            visited.add(neighbor);
          }
        }

        groups.push(group);
      }
    }

    return groups.sort((a, b) => b.length - a.length);
  }

  private canAddToGroup(color: string, group: string[], graph: Map<string, Set<string>>): boolean {
    const neighbors = graph.get(color) || new Set();
    return group.every(member => neighbors.has(member));
  }

  private findBestSlot(color: any, assignments: SlotAssignment[], stats: GcodeStats): SlotAssignment | null {
    let bestSlot: SlotAssignment | null = null;
    let minSwapDistance = Infinity;

    for (const assignment of assignments) {
      if (assignment.isPermanent) continue;

      let canFit = true;
      let swapDistance = 0;

      for (const existingColor of assignment.colors) {
        const existing = stats.colors.find(c => c.id === existingColor);
        if (!existing) continue;

        if (this.checkOverlap(color.firstLayer, color.lastLayer, existing.firstLayer, existing.lastLayer)) {
          canFit = false;
          break;
        }

        const distance = Math.min(
          Math.abs(color.firstLayer - existing.lastLayer),
          Math.abs(existing.firstLayer - color.lastLayer)
        );
        swapDistance = Math.max(swapDistance, distance);
      }

      if (canFit && swapDistance < minSwapDistance) {
        minSwapDistance = swapDistance;
        bestSlot = assignment;
      }
    }

    return bestSlot;
  }

  private calculateSwaps(stats: GcodeStats, assignments: SlotAssignment[]): ManualSwap[] {
    const swaps: ManualSwap[] = [];

    assignments.forEach(assignment => {
      if (assignment.colors.length <= 1) return;

      const colorsInSlot = assignment.colors
        .map(id => stats.colors.find(c => c.id === id)!)
        .sort((a, b) => a.firstLayer - b.firstLayer);

      for (let i = 0; i < colorsInSlot.length - 1; i++) {
        const fromColor = colorsInSlot[i];
        const toColor = colorsInSlot[i + 1];

        const swapLayer = fromColor.lastLayer + 1;
        const zHeight = this.getZHeightAtLayer(swapLayer, stats);

        swaps.push({
          slot: assignment.slot,
          fromColor: fromColor.id,
          toColor: toColor.id,
          atLayer: swapLayer,
          zHeight,
          reason: `${fromColor.name || fromColor.id} ends at layer ${fromColor.lastLayer}, ${toColor.name || toColor.id} starts at layer ${toColor.firstLayer}`
        });
      }
    });

    return swaps.sort((a, b) => a.atLayer - b.atLayer);
  }

  private getZHeightAtLayer(layer: number, stats: GcodeStats): number {
    if (stats.totalLayers === 0) return 0;
    return (layer / stats.totalLayers) * stats.totalHeight;
  }

  private estimateTimeSaved(stats: GcodeStats, swaps: ManualSwap[]): number {
    const baseToolChanges = stats.toolChanges.length;
    const optimizedChanges = swaps.length;
    const savedChanges = Math.max(0, baseToolChanges - optimizedChanges);
    const timePerChange = 30;
    return savedChanges * timePerChange;
  }
}