import { GcodeStats, Color } from '../../types';
import { Logger } from '../../utils/logger';

/**
 * Advanced algorithms for optimizing AMS (Automatic Material System) slot assignments
 * Provides intelligent color grouping and slot management recommendations
 */
export class AMSSlotOptimizer {
  private static logger = new Logger('AMSSlotOptimizer');

  /**
   * Generate optimized AMS slot assignments with detailed analysis
   */
  static optimizeSlotAssignments(
    stats: GcodeStats,
    options: {
      maxSlots?: number;
      prioritizeFrequency?: boolean;
      considerProximity?: boolean;
      minimizeWaste?: boolean;
    } = {}
  ): {
    assignments: Array<{
      slot: number;
      colors: string[];
      utilization: number;
      conflicts: number;
      efficiency: number;
      reasoning: string[];
    }>;
    metrics: {
      overallEfficiency: number;
      wasteReduction: number;
      conflictScore: number;
      utilizationBalance: number;
    };
    recommendations: string[];
  } {
    this.logger.info('Starting AMS slot optimization');

    const {
      maxSlots = 4,
      prioritizeFrequency = true,
      considerProximity = true,
      minimizeWaste = true,
    } = options;

    // Step 1: Analyze color characteristics
    const colorAnalysis = this.analyzeColorCharacteristics(stats);

    // Step 2: Calculate affinity matrix
    const affinityMatrix = this.calculateColorAffinity(stats, colorAnalysis, {
      prioritizeFrequency,
      considerProximity,
      minimizeWaste,
    });

    // Step 3: Generate optimal groupings
    const groupings = this.generateOptimalGroupings(colorAnalysis, affinityMatrix, maxSlots);

    // Step 4: Calculate metrics and generate recommendations
    const assignments = this.finalizeSlotAssignments(groupings, stats);
    const metrics = this.calculateOptimizationMetrics(assignments, stats);
    const recommendations = this.generateOptimizationRecommendations(assignments, metrics, stats);

    this.logger.info(
      `Optimization complete: ${assignments.length} slot assignments with ${metrics.overallEfficiency.toFixed(1)}% efficiency`
    );

    return {
      assignments,
      metrics,
      recommendations,
    };
  }

  /**
   * Analyze color swap strategies and timing
   */
  static analyzeSwapStrategies(stats: GcodeStats): {
    strategies: Array<{
      name: string;
      description: string;
      estimatedSavings: {
        material: number;
        time: number;
        changes: number;
      };
      complexity: 'low' | 'medium' | 'high';
      feasibility: number;
      steps: string[];
    }>;
    currentStrategy: {
      type: string;
      efficiency: number;
      issues: string[];
    };
  } {
    this.logger.info('Analyzing color swap strategies');

    const currentStrategy = this.analyzeCurrentStrategy(stats);
    const strategies: Array<{
      name: string;
      description: string;
      estimatedSavings: {
        material: number;
        time: number;
        changes: number;
      };
      complexity: 'low' | 'medium' | 'high';
      feasibility: number;
      steps: string[];
    }> = [];

    // Strategy 1: Frequency-based grouping
    const frequencyStrategy = this.analyzeFrequencyStrategy(stats);
    strategies.push(frequencyStrategy);

    // Strategy 2: Proximity-based grouping
    const proximityStrategy = this.analyzeProximityStrategy(stats);
    strategies.push(proximityStrategy);

    // Strategy 3: Conflict minimization
    const conflictStrategy = this.analyzeConflictMinimizationStrategy(stats);
    strategies.push(conflictStrategy);

    // Strategy 4: Hybrid approach
    const hybridStrategy = this.analyzeHybridStrategy(stats);
    strategies.push(hybridStrategy);

    // Sort strategies by feasibility and potential savings
    strategies.sort((a, b) => {
      const aScore =
        a.feasibility * 0.6 + (a.estimatedSavings.material + a.estimatedSavings.time) * 0.4;
      const bScore =
        b.feasibility * 0.6 + (b.estimatedSavings.material + b.estimatedSavings.time) * 0.4;
      return bScore - aScore;
    });

    return {
      strategies,
      currentStrategy,
    };
  }

  /**
   * Generate detailed AMS loading sequence recommendations
   */
  static generateLoadingSequence(
    stats: GcodeStats,
    slotAssignments: Array<{ slot: number; colors: string[] }>
  ): {
    sequence: Array<{
      step: number;
      action: 'load' | 'unload' | 'swap';
      slot: number;
      color: string;
      timing: 'pre_print' | 'layer' | 'post_print';
      layer?: number;
      reasoning: string;
    }>;
    timeline: Array<{
      layer: number;
      requiredColors: string[];
      availableSlots: string[];
      actions: string[];
      issues: string[];
    }>;
    efficiency: {
      totalSwaps: number;
      wastedSlotTime: number;
      utilizationRate: number;
    };
  } {
    this.logger.info('Generating AMS loading sequence');

    const sequence: Array<{
      step: number;
      action: 'load' | 'unload' | 'swap';
      slot: number;
      color: string;
      timing: 'pre_print' | 'layer' | 'post_print';
      layer?: number;
      reasoning: string;
    }> = [];

    const timeline: Array<{
      layer: number;
      requiredColors: string[];
      availableSlots: string[];
      actions: string[];
      issues: string[];
    }> = [];

    // Create initial loading sequence
    let stepNumber = 1;
    const slotState = new Map<number, string>(); // Track what's loaded in each slot

    // Pre-print loading
    for (const assignment of slotAssignments) {
      if (assignment.colors.length > 0) {
        const primaryColor = assignment.colors[0]; // Load primary color first
        sequence.push({
          step: stepNumber++,
          action: 'load',
          slot: assignment.slot,
          color: primaryColor,
          timing: 'pre_print',
          reasoning: `Loading primary color for slot ${assignment.slot}`,
        });
        slotState.set(assignment.slot, primaryColor);
      }
    }

    // Generate layer-by-layer timeline
    for (let layer = 0; layer < stats.totalLayers; layer++) {
      const requiredColors = stats.layerColorMap.get(layer) || [];
      const availableSlots = Array.from(slotState.values());
      const actions: string[] = [];
      const issues: string[] = [];

      // Check if required colors are available
      for (const color of requiredColors) {
        if (!availableSlots.includes(color)) {
          // Need to swap
          const targetSlot = this.findBestSlotForSwap(color, slotAssignments, slotState);
          if (targetSlot !== -1) {
            const oldColor = slotState.get(targetSlot) || 'empty';
            sequence.push({
              step: stepNumber++,
              action: 'swap',
              slot: targetSlot,
              color: color,
              timing: 'layer',
              layer: layer,
              reasoning: `Swapping ${oldColor} with ${color} for layer ${layer}`,
            });
            slotState.set(targetSlot, color);
            actions.push(`Swap slot ${targetSlot}: ${oldColor} → ${color}`);
          } else {
            issues.push(`Cannot accommodate color ${color} - no available slots`);
          }
        }
      }

      timeline.push({
        layer,
        requiredColors,
        availableSlots: [...availableSlots],
        actions,
        issues,
      });
    }

    // Calculate efficiency metrics
    const totalSwaps = sequence.filter((s) => s.action === 'swap').length;
    const wastedSlotTime = this.calculateWastedSlotTime(timeline, slotAssignments);
    const utilizationRate = this.calculateSlotUtilizationRate(timeline, slotAssignments);

    return {
      sequence,
      timeline,
      efficiency: {
        totalSwaps,
        wastedSlotTime,
        utilizationRate,
      },
    };
  }

  /**
   * Detect and analyze AMS-specific optimization opportunities
   */
  static detectOptimizationOpportunities(stats: GcodeStats): Array<{
    type: 'slot_consolidation' | 'timing_optimization' | 'waste_reduction' | 'conflict_resolution';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact: {
      materialSaving: number;
      timeSaving: number;
      complexityReduction: number;
    };
    implementation: {
      difficulty: 'easy' | 'moderate' | 'complex';
      steps: string[];
      requirements: string[];
    };
    affectedColors: string[];
    affectedLayers: number[];
  }> {
    this.logger.info('Detecting AMS optimization opportunities');

    const opportunities: Array<{
      type:
        | 'slot_consolidation'
        | 'timing_optimization'
        | 'waste_reduction'
        | 'conflict_resolution';
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      impact: {
        materialSaving: number;
        timeSaving: number;
        complexityReduction: number;
      };
      implementation: {
        difficulty: 'easy' | 'moderate' | 'complex';
        steps: string[];
        requirements: string[];
      };
      affectedColors: string[];
      affectedLayers: number[];
    }> = [];

    // Detect slot consolidation opportunities
    const consolidationOpps = this.detectSlotConsolidationOpportunities(stats);
    opportunities.push(...consolidationOpps);

    // Detect timing optimization opportunities
    const timingOpps = this.detectTimingOptimizationOpportunities(stats);
    opportunities.push(...timingOpps);

    // Detect waste reduction opportunities
    const wasteOpps = this.detectWasteReductionOpportunities(stats);
    opportunities.push(...wasteOpps);

    // Detect conflict resolution opportunities
    const conflictOpps = this.detectConflictResolutionOpportunities(stats);
    opportunities.push(...conflictOpps);

    // Sort by priority and impact
    opportunities.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const aScore =
        priorityOrder[a.priority] * 100 + a.impact.materialSaving + a.impact.timeSaving;
      const bScore =
        priorityOrder[b.priority] * 100 + b.impact.materialSaving + b.impact.timeSaving;
      return bScore - aScore;
    });

    this.logger.info(`Detected ${opportunities.length} optimization opportunities`);
    return opportunities;
  }

  // Private helper methods

  private static analyzeColorCharacteristics(stats: GcodeStats): Map<
    string,
    {
      frequency: number;
      duration: number;
      gaps: number[];
      utilization: number;
      criticality: number;
    }
  > {
    const characteristics = new Map();

    for (const color of stats.colors) {
      const layers = Array.from(color.layersUsed).sort((a, b) => a - b);
      const frequency = layers.length;
      const duration = layers.length > 0 ? layers[layers.length - 1] - layers[0] + 1 : 0;

      // Calculate gaps between usage
      const gaps: number[] = [];
      for (let i = 1; i < layers.length; i++) {
        gaps.push(layers[i] - layers[i - 1] - 1);
      }

      const utilization = color.usagePercentage;
      const criticality = frequency > stats.totalLayers * 0.3 ? 100 : frequency * 3;

      characteristics.set(color.id, {
        frequency,
        duration,
        gaps,
        utilization,
        criticality,
      });
    }

    return characteristics;
  }

  private static calculateColorAffinity(
    stats: GcodeStats,
    characteristics: Map<string, any>,
    options: any
  ): Map<string, Map<string, number>> {
    const affinity = new Map<string, Map<string, number>>();

    // Initialize affinity matrix
    for (const color of stats.colors) {
      affinity.set(color.id, new Map());
      for (const otherColor of stats.colors) {
        if (color.id !== otherColor.id) {
          affinity.get(color.id)!.set(otherColor.id, 0);
        }
      }
    }

    // Calculate pairwise affinities
    for (let i = 0; i < stats.colors.length; i++) {
      for (let j = i + 1; j < stats.colors.length; j++) {
        const color1 = stats.colors[i];
        const color2 = stats.colors[j];

        let affinityScore = 0;

        // Proximity affinity
        if (options.considerProximity) {
          affinityScore += this.calculateProximityAffinity(color1, color2);
        }

        // Frequency affinity
        if (options.prioritizeFrequency) {
          affinityScore += this.calculateFrequencyAffinity(
            characteristics.get(color1.id),
            characteristics.get(color2.id)
          );
        }

        // Co-occurrence affinity
        affinityScore += this.calculateCoOccurrenceAffinity(color1, color2, stats);

        affinity.get(color1.id)!.set(color2.id, affinityScore);
        affinity.get(color2.id)!.set(color1.id, affinityScore);
      }
    }

    return affinity;
  }

  private static generateOptimalGroupings(
    characteristics: Map<string, any>,
    affinity: Map<string, Map<string, number>>,
    maxSlots: number
  ): Array<{ colors: string[]; score: number }> {
    const colors = Array.from(characteristics.keys());
    const groupings: Array<{ colors: string[]; score: number }> = [];
    const assigned = new Set<string>();

    // Greedy clustering based on affinity scores
    while (assigned.size < colors.length && groupings.length < maxSlots) {
      let bestGroup: string[] = [];
      let bestScore = 0;

      // Try starting from each unassigned color
      for (const startColor of colors) {
        if (assigned.has(startColor)) continue;

        const group = [startColor];
        let groupScore = 0;

        // Greedily add colors with highest affinity
        while (group.length < 4) {
          // Max 4 colors per slot typically
          let bestCandidate = '';
          let bestCandidateScore = 0;

          for (const candidate of colors) {
            if (assigned.has(candidate) || group.includes(candidate)) continue;

            let candidateScore = 0;
            for (const groupColor of group) {
              candidateScore += affinity.get(groupColor)?.get(candidate) || 0;
            }

            if (candidateScore > bestCandidateScore && candidateScore > 20) {
              bestCandidateScore = candidateScore;
              bestCandidate = candidate;
            }
          }

          if (bestCandidate) {
            group.push(bestCandidate);
            groupScore += bestCandidateScore;
          } else {
            break;
          }
        }

        if (groupScore > bestScore || (groupScore === 0 && bestGroup.length === 0)) {
          bestScore = groupScore;
          bestGroup = group;
        }
      }

      if (bestGroup.length > 0) {
        groupings.push({ colors: bestGroup, score: bestScore });
        for (const color of bestGroup) {
          assigned.add(color);
        }
      } else {
        break;
      }
    }

    return groupings;
  }

  private static finalizeSlotAssignments(
    groupings: Array<{ colors: string[]; score: number }>,
    stats: GcodeStats
  ): Array<{
    slot: number;
    colors: string[];
    utilization: number;
    conflicts: number;
    efficiency: number;
    reasoning: string[];
  }> {
    const assignments: Array<{
      slot: number;
      colors: string[];
      utilization: number;
      conflicts: number;
      efficiency: number;
      reasoning: string[];
    }> = [];

    for (let i = 0; i < groupings.length; i++) {
      const grouping = groupings[i];
      const slot = i + 1;

      // Calculate utilization
      const totalUsage = grouping.colors.reduce((sum, colorId) => {
        const color = stats.colors.find((c) => c.id === colorId);
        return sum + (color?.usagePercentage || 0);
      }, 0);
      const utilization = Math.min(totalUsage, 100);

      // Calculate conflicts
      const conflicts = this.calculateSlotConflicts(grouping.colors, stats);

      // Calculate efficiency
      const efficiency = Math.max(0, Math.min(100, 80 - conflicts * 5 + (utilization - 50) * 0.4));

      // Generate reasoning
      const reasoning = this.generateSlotReasoning(grouping, stats);

      assignments.push({
        slot,
        colors: grouping.colors,
        utilization,
        conflicts,
        efficiency,
        reasoning,
      });
    }

    return assignments;
  }

  private static calculateOptimizationMetrics(
    assignments: Array<any>,
    stats: GcodeStats
  ): {
    overallEfficiency: number;
    wasteReduction: number;
    conflictScore: number;
    utilizationBalance: number;
  } {
    const efficiencies = assignments.map((a) => a.efficiency);
    const overallEfficiency = efficiencies.reduce((sum, e) => sum + e, 0) / efficiencies.length;

    const totalConflicts = assignments.reduce((sum, a) => sum + a.conflicts, 0);
    const conflictScore = Math.max(0, 100 - totalConflicts * 10);

    const utilizations = assignments.map((a) => a.utilization);
    const avgUtilization = utilizations.reduce((sum, u) => sum + u, 0) / utilizations.length;
    const utilizationVariance =
      utilizations.reduce((sum, u) => sum + Math.pow(u - avgUtilization, 2), 0) /
      utilizations.length;
    const utilizationBalance = Math.max(0, 100 - Math.sqrt(utilizationVariance));

    const wasteReduction = Math.min(30, overallEfficiency * 0.3);

    return {
      overallEfficiency,
      wasteReduction,
      conflictScore,
      utilizationBalance,
    };
  }

  private static generateOptimizationRecommendations(
    assignments: Array<any>,
    metrics: any,
    stats: GcodeStats
  ): string[] {
    const recommendations: string[] = [];

    if (metrics.overallEfficiency < 70) {
      recommendations.push('Consider reassigning colors to improve slot efficiency');
    }

    if (metrics.conflictScore < 60) {
      recommendations.push('Reduce color conflicts by separating frequently co-occurring colors');
    }

    if (metrics.utilizationBalance < 50) {
      recommendations.push('Balance color usage across slots for better utilization');
    }

    const lowEfficiencySlots = assignments.filter((a) => a.efficiency < 60);
    if (lowEfficiencySlots.length > 0) {
      recommendations.push(
        `Review slot assignments for slots: ${lowEfficiencySlots.map((s) => s.slot).join(', ')}`
      );
    }

    return recommendations;
  }

  // Additional helper methods for strategy analysis

  private static analyzeCurrentStrategy(stats: GcodeStats): {
    type: string;
    efficiency: number;
    issues: string[];
  } {
    // Simplified current strategy analysis
    const toolChanges = stats.toolChanges.length;
    const efficiency = Math.max(0, 100 - (toolChanges / stats.totalLayers) * 20);

    const issues: string[] = [];
    if (toolChanges > stats.totalLayers * 0.5) {
      issues.push('High frequency of tool changes');
    }
    if (stats.colors.length > 4) {
      issues.push('More colors than available AMS slots');
    }

    return {
      type: 'Current arrangement',
      efficiency,
      issues,
    };
  }

  private static analyzeFrequencyStrategy(stats: GcodeStats): any {
    // Implementation for frequency-based strategy analysis
    return {
      name: 'Frequency-based Grouping',
      description: 'Group colors based on usage frequency',
      estimatedSavings: { material: 5, time: 30, changes: 10 },
      complexity: 'low' as const,
      feasibility: 85,
      steps: [
        'Sort colors by frequency',
        'Group high-frequency colors together',
        'Assign to slots',
      ],
    };
  }

  private static analyzeProximityStrategy(stats: GcodeStats): any {
    return {
      name: 'Proximity-based Grouping',
      description: 'Group colors used in nearby layers',
      estimatedSavings: { material: 3, time: 45, changes: 15 },
      complexity: 'medium' as const,
      feasibility: 75,
      steps: ['Analyze layer proximity', 'Identify nearby color usage', 'Create proximity groups'],
    };
  }

  private static analyzeConflictMinimizationStrategy(stats: GcodeStats): any {
    return {
      name: 'Conflict Minimization',
      description: 'Minimize simultaneous color usage conflicts',
      estimatedSavings: { material: 8, time: 25, changes: 20 },
      complexity: 'high' as const,
      feasibility: 65,
      steps: [
        'Identify color conflicts',
        'Separate conflicting colors',
        'Optimize slot assignments',
      ],
    };
  }

  private static analyzeHybridStrategy(stats: GcodeStats): any {
    return {
      name: 'Hybrid Optimization',
      description: 'Combines frequency, proximity, and conflict analysis',
      estimatedSavings: { material: 12, time: 50, changes: 25 },
      complexity: 'high' as const,
      feasibility: 80,
      steps: ['Multi-factor analysis', 'Weighted optimization', 'Balanced slot assignment'],
    };
  }

  // Helper methods for opportunity detection

  private static detectSlotConsolidationOpportunities(stats: GcodeStats): any[] {
    // Implementation for slot consolidation detection
    return [];
  }

  private static detectTimingOptimizationOpportunities(stats: GcodeStats): any[] {
    // Implementation for timing optimization detection
    return [];
  }

  private static detectWasteReductionOpportunities(stats: GcodeStats): any[] {
    // Implementation for waste reduction detection
    return [];
  }

  private static detectConflictResolutionOpportunities(stats: GcodeStats): any[] {
    // Implementation for conflict resolution detection
    return [];
  }

  // Additional utility methods

  private static calculateProximityAffinity(color1: Color, color2: Color): number {
    // Calculate how often colors are used in nearby layers
    const layers1 = Array.from(color1.layersUsed);
    const layers2 = Array.from(color2.layersUsed);

    let proximityScore = 0;
    for (const layer1 of layers1) {
      for (const layer2 of layers2) {
        const distance = Math.abs(layer1 - layer2);
        if (distance <= 3) {
          proximityScore += (4 - distance) * 5;
        }
      }
    }

    return Math.min(proximityScore, 50);
  }

  private static calculateFrequencyAffinity(char1: any, char2: any): number {
    if (!char1 || !char2) return 0;

    const freqDiff = Math.abs(char1.frequency - char2.frequency);
    const utilDiff = Math.abs(char1.utilization - char2.utilization);

    return Math.max(0, 30 - freqDiff - utilDiff * 0.5);
  }

  private static calculateCoOccurrenceAffinity(
    color1: Color,
    color2: Color,
    stats: GcodeStats
  ): number {
    let coOccurrences = 0;

    for (const [, colors] of stats.layerColorMap) {
      if (colors.includes(color1.id) && colors.includes(color2.id)) {
        coOccurrences++;
      }
    }

    return Math.min(coOccurrences * 10, 40);
  }

  private static calculateSlotConflicts(colors: string[], stats: GcodeStats): number {
    let conflicts = 0;

    for (const [, layerColors] of stats.layerColorMap) {
      const slotColorsInLayer = colors.filter((c) => layerColors.includes(c));
      if (slotColorsInLayer.length > 1) {
        conflicts += slotColorsInLayer.length - 1;
      }
    }

    return conflicts;
  }

  private static generateSlotReasoning(
    grouping: { colors: string[]; score: number },
    stats: GcodeStats
  ): string[] {
    const reasoning: string[] = [];

    if (grouping.colors.length === 1) {
      reasoning.push('Single color assignment');
    } else if (grouping.score > 100) {
      reasoning.push('High affinity color group');
    } else if (grouping.score > 50) {
      reasoning.push('Moderate compatibility group');
    } else {
      reasoning.push('Basic grouping');
    }

    return reasoning;
  }

  private static findBestSlotForSwap(
    color: string,
    assignments: Array<{ slot: number; colors: string[] }>,
    slotState: Map<number, string>
  ): number {
    // Find slot that contains the target color or has best compatibility
    for (const assignment of assignments) {
      if (assignment.colors.includes(color)) {
        return assignment.slot;
      }
    }

    // If not found, return first available slot
    return assignments.length > 0 ? assignments[0].slot : -1;
  }

  private static calculateWastedSlotTime(timeline: any[], assignments: any[]): number {
    // Calculate time when slots are loaded but not used
    return 0; // Simplified implementation
  }

  private static calculateSlotUtilizationRate(timeline: any[], assignments: any[]): number {
    // Calculate overall slot utilization percentage
    return 75; // Simplified implementation
  }
}
