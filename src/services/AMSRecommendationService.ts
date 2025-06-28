import { GcodeStats } from '../types';
import { AMSSlotOptimizer } from '../analytics/algorithms/AMSSlotOptimizer';
import { ColorOverlapAnalyzer } from '../analytics/algorithms/ColorOverlapAnalyzer';
import { Logger } from '../utils/logger';

/**
 * Interface for AMS optimization recommendations displayed in the UI
 */
export interface AMSRecommendations {
  slotAssignments: Array<{
    slot: number;
    colors: string[];
    utilization: number;
    conflicts: number;
    efficiency: number;
    reasoning: string[];
  }>;
  currentStrategy: {
    type: string;
    efficiency: number;
    issues: string[];
  };
  recommendedStrategies: Array<{
    name: string;
    description: string;
    estimatedImprovement: number;
    feasibility: number;
    complexity: 'low' | 'medium' | 'high';
    estimatedSavings: {
      material: number;
      time: number;
    };
  }>;
  conflicts: Array<{
    id: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
    affectedLayers: number[];
    colors: string[];
    recommendation: string;
    priority: number;
  }>;
  potentialSavings: {
    totalMaterialSaving: number;
    totalTimeSaving: number;
    efficiencyImprovement: number;
    conflictReduction: number;
  };
  summary: {
    overallEfficiency: number;
    totalConflicts: number;
    implementationDifficulty: 'easy' | 'moderate' | 'complex';
    recommendedActions: string[];
  };
}

/**
 * Service to generate AMS optimization recommendations from analytics data
 */
export class AMSRecommendationService {
  private static logger = new Logger('AMSRecommendationService');

  /**
   * Generate comprehensive AMS optimization recommendations
   */
  static generateRecommendations(stats: GcodeStats): AMSRecommendations {
    this.logger.info('Generating AMS optimization recommendations');

    try {
      // Get AMS optimization data
      const optimization = AMSSlotOptimizer.optimizeSlotAssignments(stats, {
        maxSlots: 4,
        prioritizeFrequency: true,
        considerProximity: true,
        minimizeWaste: true,
      });

      // Get color overlap analysis
      const overlaps = ColorOverlapAnalyzer.analyzeColorOverlaps(stats);

      // Get strategy analysis
      const strategies = AMSSlotOptimizer.analyzeSwapStrategies(stats);

      // Get optimization opportunities
      const opportunities = AMSSlotOptimizer.detectOptimizationOpportunities(stats);

      // Format slot assignments
      const slotAssignments = optimization.assignments.map((assignment) => ({
        slot: assignment.slot,
        colors: assignment.colors,
        utilization: assignment.utilization,
        conflicts: assignment.conflicts,
        efficiency: assignment.efficiency,
        reasoning: assignment.reasoning,
      }));

      // Format current strategy
      const currentStrategy = {
        type: strategies.currentStrategy.type,
        efficiency: strategies.currentStrategy.efficiency,
        issues: strategies.currentStrategy.issues,
      };

      // Format recommended strategies
      const recommendedStrategies = strategies.strategies.map((strategy) => ({
        name: strategy.name,
        description: strategy.description,
        estimatedImprovement: strategy.feasibility,
        feasibility: strategy.feasibility,
        complexity: strategy.complexity,
        estimatedSavings: strategy.estimatedSavings,
      }));

      // Format conflicts
      const conflicts = this.formatConflicts(overlaps.conflictingColors, overlaps);

      // Calculate potential savings
      const potentialSavings = {
        totalMaterialSaving: optimization.metrics.wasteReduction,
        totalTimeSaving: opportunities.reduce((sum, opp) => sum + opp.impact.timeSaving, 0),
        efficiencyImprovement: optimization.metrics.overallEfficiency,
        conflictReduction: optimization.metrics.conflictScore,
      };

      // Generate summary
      const summary = this.generateSummary(optimization, conflicts, opportunities);

      const recommendations: AMSRecommendations = {
        slotAssignments,
        currentStrategy,
        recommendedStrategies,
        conflicts,
        potentialSavings,
        summary,
      };

      this.logger.info(
        `Generated ${conflicts.length} conflict recommendations and ${recommendedStrategies.length} strategy options`
      );

      return recommendations;
    } catch (error) {
      this.logger.error('Failed to generate AMS recommendations', error);
      throw error;
    }
  }

  /**
   * Format conflict data for UI display
   */
  private static formatConflicts(
    rawConflicts: any[],
    overlaps: any
  ): AMSRecommendations['conflicts'] {
    return rawConflicts
      .map((conflict, index) => {
        const severity = this.determineSeverity(conflict);

        return {
          id: `conflict-${index}`,
          severity,
          description: this.generateConflictDescription(conflict),
          affectedLayers: conflict.overlapLayers || [],
          colors: [conflict.color1, conflict.color2],
          recommendation: this.generateConflictRecommendation(conflict),
          priority: severity === 'high' ? 1 : severity === 'medium' ? 2 : 3,
        };
      })
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Determine conflict severity based on impact
   */
  private static determineSeverity(conflict: any): 'high' | 'medium' | 'low' {
    if (
      conflict.conflictSeverity === 'high' ||
      (conflict.overlapLayers && conflict.overlapLayers.length > 10)
    ) {
      return 'high';
    } else if (
      conflict.conflictSeverity === 'medium' ||
      (conflict.overlapLayers && conflict.overlapLayers.length > 5)
    ) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Generate human-readable conflict description
   */
  private static generateConflictDescription(conflict: any): string {
    const layerCount = conflict.overlapLayers ? conflict.overlapLayers.length : 0;

    if (layerCount > 0) {
      return `${conflict.color1} and ${conflict.color2} overlap on ${layerCount} layers, causing frequent tool changes`;
    } else {
      return `${conflict.color1} and ${conflict.color2} have conflicting usage patterns`;
    }
  }

  /**
   * Generate conflict resolution recommendation
   */
  private static generateConflictRecommendation(conflict: any): string {
    const layerCount = conflict.overlapLayers ? conflict.overlapLayers.length : 0;

    if (layerCount > 10) {
      return `Consider consolidating these colors or redesigning affected layers to reduce transitions`;
    } else if (layerCount > 5) {
      return `Group these colors in adjacent AMS slots to minimize swap time`;
    } else {
      return `Optimize tool change sequence to reduce back-and-forth patterns`;
    }
  }

  /**
   * Generate summary with overall assessment
   */
  private static generateSummary(
    optimization: any,
    conflicts: AMSRecommendations['conflicts'],
    opportunities: any[]
  ): AMSRecommendations['summary'] {
    const highPriorityConflicts = conflicts.filter((c) => c.severity === 'high').length;
    const overallEfficiency = optimization.metrics.overallEfficiency;

    let implementationDifficulty: 'easy' | 'moderate' | 'complex';
    if (highPriorityConflicts === 0 && overallEfficiency > 80) {
      implementationDifficulty = 'easy';
    } else if (highPriorityConflicts <= 2 && overallEfficiency > 60) {
      implementationDifficulty = 'moderate';
    } else {
      implementationDifficulty = 'complex';
    }

    const recommendedActions = this.generateRecommendedActions(
      conflicts,
      opportunities,
      overallEfficiency
    );

    return {
      overallEfficiency,
      totalConflicts: conflicts.length,
      implementationDifficulty,
      recommendedActions,
    };
  }

  /**
   * Generate list of recommended actions based on analysis
   */
  private static generateRecommendedActions(
    conflicts: AMSRecommendations['conflicts'],
    opportunities: any[],
    efficiency: number
  ): string[] {
    const actions: string[] = [];

    // Address high-priority conflicts first
    const highPriorityConflicts = conflicts.filter((c) => c.severity === 'high');
    if (highPriorityConflicts.length > 0) {
      actions.push(`Address ${highPriorityConflicts.length} high-priority color conflicts`);
    }

    // Efficiency improvements
    if (efficiency < 70) {
      actions.push('Implement slot optimization to improve efficiency');
    }

    // Top opportunities
    const topOpportunities = opportunities.filter((opp) => opp.priority === 'high').slice(0, 2);

    topOpportunities.forEach((opp) => {
      actions.push(opp.title);
    });

    // General recommendations
    if (actions.length === 0) {
      actions.push('Current AMS setup is well optimized');
      actions.push('Monitor for new optimization opportunities');
    }

    return actions.slice(0, 4); // Limit to 4 actions for UI
  }

  /**
   * Get color-coded efficiency status
   */
  static getEfficiencyStatus(efficiency: number): {
    status: 'good' | 'fair' | 'poor';
    color: string;
    message: string;
  } {
    if (efficiency >= 80) {
      return {
        status: 'good',
        color: 'text-vibrant-green',
        message: 'Excellent efficiency',
      };
    } else if (efficiency >= 60) {
      return {
        status: 'fair',
        color: 'text-vibrant-orange',
        message: 'Room for improvement',
      };
    } else {
      return {
        status: 'poor',
        color: 'text-vibrant-red',
        message: 'Needs optimization',
      };
    }
  }

  /**
   * Get conflict severity styling
   */
  static getConflictSeverityStyle(severity: 'high' | 'medium' | 'low'): {
    color: string;
    bgColor: string;
    icon: string;
  } {
    switch (severity) {
      case 'high':
        return {
          color: 'text-vibrant-red',
          bgColor: 'bg-red-500/20',
          icon: '🚨',
        };
      case 'medium':
        return {
          color: 'text-vibrant-orange',
          bgColor: 'bg-orange-500/20',
          icon: '⚠️',
        };
      case 'low':
        return {
          color: 'text-vibrant-cyan',
          bgColor: 'bg-cyan-500/20',
          icon: 'ℹ️',
        };
    }
  }
}
