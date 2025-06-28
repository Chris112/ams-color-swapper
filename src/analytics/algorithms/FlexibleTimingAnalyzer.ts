import { GcodeStats, ManualSwap } from '../../types';
import { Logger } from '../../utils/logger';

/**
 * Flexible timing analysis for manual swaps
 * Calculates earliest/latest possible timing and provides users with options
 */

export interface TimingConstraint {
  type: 'color_usage' | 'material_change' | 'buffer_zone' | 'print_quality' | 'user_preference';
  description: string;
  severity: 'hard' | 'soft'; // Hard constraints cannot be violated
  impact: number; // 0-100, impact on timing flexibility
}

export interface TimingAnalysis {
  swapId: string;
  recommendedLayer: number;
  timingOptions: {
    earliest: number;
    latest: number;
    optimal: number;
    adjacentOnly: boolean;
    bufferLayers: number;
  };
  swapWindow: {
    startLayer: number;
    endLayer: number;
    flexibilityScore: number;
    constraints: string[];
  };
  confidence: {
    timing: number;
    necessity: number;
    userControl: number;
  };
  alternatives: Array<{
    layer: number;
    score: number;
    tradeoffs: string[];
    risk: 'low' | 'medium' | 'high';
  }>;
  constraints: TimingConstraint[];
}

export class FlexibleTimingAnalyzer {
  private static logger = new Logger('FlexibleTimingAnalyzer');

  /**
   * Analyze timing flexibility for all manual swaps
   */
  static analyzeSwapTiming(
    stats: GcodeStats,
    manualSwaps: ManualSwap[],
    options: {
      bufferLayers?: number;
      allowEarlySwaps?: boolean;
      allowLateSwaps?: boolean;
      prioritizeFlexibility?: boolean;
    } = {}
  ): Map<string, TimingAnalysis> {
    this.logger.info('Analyzing timing flexibility for manual swaps');

    const {
      bufferLayers = 2,
      allowEarlySwaps = true,
      allowLateSwaps = true,
      prioritizeFlexibility = false,
    } = options;

    const timingAnalyses = new Map<string, TimingAnalysis>();

    for (const swap of manualSwaps) {
      const swapId = `${swap.fromColor}-${swap.toColor}-${swap.atLayer}`;
      const analysis = this.analyzeIndividualSwapTiming(swap, stats, {
        bufferLayers,
        allowEarlySwaps,
        allowLateSwaps,
        prioritizeFlexibility,
      });

      timingAnalyses.set(swapId, analysis);
    }

    // Optimize timing considering all swaps together
    this.optimizeGlobalTiming(timingAnalyses, stats);

    this.logger.info(`Timing analysis complete for ${manualSwaps.length} swaps`);
    return timingAnalyses;
  }

  /**
   * Analyze timing flexibility for a single swap
   */
  static analyzeIndividualSwapTiming(
    swap: ManualSwap,
    stats: GcodeStats,
    options: {
      bufferLayers: number;
      allowEarlySwaps: boolean;
      allowLateSwaps: boolean;
      prioritizeFlexibility: boolean;
    }
  ): TimingAnalysis {
    const swapId = `${swap.fromColor}-${swap.toColor}-${swap.atLayer}`;
    this.logger.debug(`Analyzing timing for swap: ${swapId}`);

    // Find color usage patterns
    const fromColorUsage = this.getColorUsagePattern(swap.fromColor, stats);
    const toColorUsage = this.getColorUsagePattern(swap.toColor, stats);

    // Calculate constraints
    const constraints = this.calculateTimingConstraints(
      swap,
      fromColorUsage,
      toColorUsage,
      stats,
      options
    );

    // Determine timing window
    const timingWindow = this.calculateTimingWindow(swap, constraints, options);

    // Generate alternatives
    const alternatives = this.generateTimingAlternatives(swap, timingWindow, constraints, stats);

    // Calculate confidence metrics
    const confidence = this.calculateTimingConfidence(
      swap,
      timingWindow,
      constraints,
      alternatives
    );

    return {
      swapId,
      recommendedLayer: swap.atLayer,
      timingOptions: {
        earliest: timingWindow.startLayer,
        latest: timingWindow.endLayer,
        optimal: swap.atLayer,
        adjacentOnly: this.isAdjacentOnly(swap, fromColorUsage, toColorUsage),
        bufferLayers: options.bufferLayers,
      },
      swapWindow: {
        startLayer: timingWindow.startLayer,
        endLayer: timingWindow.endLayer,
        flexibilityScore: timingWindow.flexibilityScore,
        constraints: constraints.map((c) => c.description),
      },
      confidence,
      alternatives,
      constraints,
    };
  }

  /**
   * Calculate earliest and latest possible swap timing
   */
  static calculateSwapWindow(
    fromColor: string,
    toColor: string,
    stats: GcodeStats,
    bufferLayers: number = 2
  ): {
    earliest: number;
    latest: number;
    flexibility: number;
    reasoning: string[];
  } {
    const fromColorObj = stats.colors.find((c) => c.id === fromColor);
    const toColorObj = stats.colors.find((c) => c.id === toColor);

    if (!fromColorObj || !toColorObj) {
      return { earliest: 0, latest: 0, flexibility: 0, reasoning: ['Color not found'] };
    }

    const fromLayers = Array.from(fromColorObj.layersUsed).sort((a, b) => a - b);
    const toLayers = Array.from(toColorObj.layersUsed).sort((a, b) => a - b);

    // Earliest: After last use of fromColor + buffer
    const lastFromLayer = fromLayers[fromLayers.length - 1];
    const earliest = Math.max(0, lastFromLayer + bufferLayers);

    // Latest: Before first use of toColor - buffer
    const firstToLayer = toLayers[0];
    const latest = Math.max(earliest, firstToLayer - bufferLayers);

    // Calculate flexibility score
    const windowSize = latest - earliest + 1;
    const flexibility = Math.min(100, Math.max(0, (windowSize - 1) * 10));

    const reasoning: string[] = [];
    reasoning.push(`Earliest after ${fromColor} usage ends (layer ${lastFromLayer})`);
    reasoning.push(`Latest before ${toColor} usage begins (layer ${firstToLayer})`);

    if (windowSize <= 1) {
      reasoning.push('Very tight timing window - consider adjacent swap');
    } else if (windowSize <= 3) {
      reasoning.push('Limited timing flexibility');
    } else {
      reasoning.push('Good timing flexibility available');
    }

    return {
      earliest,
      latest,
      flexibility,
      reasoning,
    };
  }

  /**
   * Suggest optimal timing alternatives
   */
  static suggestTimingAlternatives(
    originalLayer: number,
    swapWindow: { earliest: number; latest: number },
    stats: GcodeStats,
    preferences: {
      preferEarly?: boolean;
      avoidComplexLayers?: boolean;
      minimizeInterruptions?: boolean;
    } = {}
  ): Array<{
    layer: number;
    score: number;
    benefits: string[];
    drawbacks: string[];
  }> {
    const alternatives: Array<{
      layer: number;
      score: number;
      benefits: string[];
      drawbacks: string[];
    }> = [];

    const { earliest, latest } = swapWindow;
    const {
      preferEarly = false,
      avoidComplexLayers = true,
      minimizeInterruptions = true,
    } = preferences;

    // Generate alternatives within the window
    for (let layer = earliest; layer <= latest; layer++) {
      if (layer === originalLayer) continue; // Skip original recommendation

      let score = 50; // Base score
      const benefits: string[] = [];
      const drawbacks: string[] = [];

      // Early vs late preference
      if (preferEarly && layer < originalLayer) {
        score += 15;
        benefits.push('Earlier timing reduces material waste');
      } else if (!preferEarly && layer > originalLayer) {
        score += 10;
        benefits.push('Later timing allows for better preparation');
      }

      // Avoid complex layers
      if (avoidComplexLayers) {
        const layerColors = stats.layerColorMap.get(layer) || [];
        if (layerColors.length <= 1) {
          score += 20;
          benefits.push('Simple layer with minimal tool changes');
        } else if (layerColors.length > 3) {
          score -= 15;
          drawbacks.push('Complex layer with multiple colors');
        }
      }

      // Minimize interruptions
      if (minimizeInterruptions) {
        const nearbyLayers = this.getNearbyLayerComplexity(layer, stats, 3);
        if (nearbyLayers.avgComplexity < 2) {
          score += 10;
          benefits.push('Low complexity area for easier swapping');
        } else if (nearbyLayers.avgComplexity > 4) {
          score -= 10;
          drawbacks.push('High complexity area may complicate swap');
        }
      }

      // Distance from original recommendation
      const distance = Math.abs(layer - originalLayer);
      if (distance <= 1) {
        score += 5;
        benefits.push('Close to original timing recommendation');
      } else if (distance > 5) {
        score -= distance;
        drawbacks.push('Significantly different from original recommendation');
      }

      alternatives.push({
        layer,
        score: Math.max(0, Math.min(100, score)),
        benefits,
        drawbacks,
      });
    }

    // Sort by score
    alternatives.sort((a, b) => b.score - a.score);

    return alternatives.slice(0, 5); // Return top 5 alternatives
  }

  // Private helper methods

  private static getColorUsagePattern(
    colorId: string,
    stats: GcodeStats
  ): { layers: number[]; firstLayer: number; lastLayer: number; gaps: number[] } {
    const color = stats.colors.find((c) => c.id === colorId);
    if (!color) {
      return { layers: [], firstLayer: 0, lastLayer: 0, gaps: [] };
    }

    const layers = Array.from(color.layersUsed).sort((a, b) => a - b);
    const gaps: number[] = [];

    for (let i = 1; i < layers.length; i++) {
      const gap = layers[i] - layers[i - 1] - 1;
      if (gap > 0) gaps.push(gap);
    }

    return {
      layers,
      firstLayer: layers[0] || 0,
      lastLayer: layers[layers.length - 1] || 0,
      gaps,
    };
  }

  private static calculateTimingConstraints(
    swap: ManualSwap,
    fromColorUsage: any,
    toColorUsage: any,
    stats: GcodeStats,
    options: any
  ): TimingConstraint[] {
    const constraints: TimingConstraint[] = [];

    // Color usage constraints
    constraints.push({
      type: 'color_usage',
      description: `Must swap after ${swap.fromColor} usage ends`,
      severity: 'hard',
      impact: 90,
    });

    constraints.push({
      type: 'color_usage',
      description: `Must swap before ${swap.toColor} usage begins`,
      severity: 'hard',
      impact: 90,
    });

    // Buffer zone constraints
    if (options.bufferLayers > 0) {
      constraints.push({
        type: 'buffer_zone',
        description: `${options.bufferLayers} layer buffer for material settling`,
        severity: 'soft',
        impact: 50,
      });
    }

    // Material change constraints
    const isSignificantColorChange = this.isSignificantColorChange(
      swap.fromColor,
      swap.toColor,
      stats
    );
    if (isSignificantColorChange) {
      constraints.push({
        type: 'material_change',
        description: 'Significant color change requires careful timing',
        severity: 'soft',
        impact: 30,
      });
    }

    return constraints;
  }

  private static calculateTimingWindow(
    swap: ManualSwap,
    constraints: TimingConstraint[],
    options: any
  ): {
    startLayer: number;
    endLayer: number;
    flexibilityScore: number;
  } {
    // Start with wide window
    let startLayer = Math.max(0, swap.atLayer - 10);
    let endLayer = swap.atLayer + 10;

    // Apply hard constraints
    const hardConstraints = constraints.filter((c) => c.severity === 'hard');
    for (const constraint of hardConstraints) {
      if (constraint.type === 'color_usage') {
        // Narrow window based on color usage
        startLayer = Math.max(startLayer, swap.atLayer - 5);
        endLayer = Math.min(endLayer, swap.atLayer + 5);
      }
    }

    // Calculate flexibility score
    const windowSize = endLayer - startLayer + 1;
    const flexibilityScore = Math.min(100, Math.max(0, windowSize * 8));

    return {
      startLayer,
      endLayer,
      flexibilityScore,
    };
  }

  private static generateTimingAlternatives(
    swap: ManualSwap,
    timingWindow: any,
    constraints: TimingConstraint[],
    stats: GcodeStats
  ): Array<{
    layer: number;
    score: number;
    tradeoffs: string[];
    risk: 'low' | 'medium' | 'high';
  }> {
    const alternatives: Array<{
      layer: number;
      score: number;
      tradeoffs: string[];
      risk: 'low' | 'medium' | 'high';
    }> = [];

    // Generate 3-5 alternatives within the window
    const windowSize = timingWindow.endLayer - timingWindow.startLayer + 1;
    const step = Math.max(1, Math.floor(windowSize / 4));

    for (let i = 0; i < windowSize; i += step) {
      const layer = timingWindow.startLayer + i;
      if (layer === swap.atLayer) continue; // Skip original

      let score = 70; // Base score
      const tradeoffs: string[] = [];
      let risk: 'low' | 'medium' | 'high' = 'low';

      // Earlier timing
      if (layer < swap.atLayer) {
        score += 5;
        tradeoffs.push('Earlier swap reduces waste but may be premature');
        if (layer < swap.atLayer - 3) {
          risk = 'medium';
        }
      }

      // Later timing
      if (layer > swap.atLayer) {
        score -= 5;
        tradeoffs.push('Later swap allows more preparation but increases risk');
        if (layer > swap.atLayer + 3) {
          risk = 'high';
        }
      }

      alternatives.push({
        layer,
        score: Math.max(0, Math.min(100, score)),
        tradeoffs,
        risk,
      });
    }

    return alternatives.slice(0, 5);
  }

  private static calculateTimingConfidence(
    swap: ManualSwap,
    timingWindow: any,
    constraints: TimingConstraint[],
    alternatives: any[]
  ): {
    timing: number;
    necessity: number;
    userControl: number;
  } {
    // Timing confidence based on window size and constraints
    const timing = Math.min(100, 60 + timingWindow.flexibilityScore * 0.4);

    // Necessity based on impact
    const necessity = constraints.reduce((sum, c) => sum + c.impact, 0) / constraints.length;

    // User control based on alternatives available
    const userControl = Math.min(100, 50 + alternatives.length * 10);

    return {
      timing: Math.round(timing),
      necessity: Math.round(necessity),
      userControl: Math.round(userControl),
    };
  }

  private static isAdjacentOnly(swap: ManualSwap, fromColorUsage: any, toColorUsage: any): boolean {
    // Check if swap must be immediately adjacent to color usage
    const gap = toColorUsage.firstLayer - fromColorUsage.lastLayer;
    return gap <= 3; // If gap is 3 layers or less, consider it adjacent-only
  }

  private static optimizeGlobalTiming(
    timingAnalyses: Map<string, TimingAnalysis>,
    stats: GcodeStats
  ): void {
    // Global optimization to avoid conflicting swap times
    const swapLayers = Array.from(timingAnalyses.values()).map((a) => a.recommendedLayer);

    // Check for conflicts and adjust if needed
    for (const [, analysis] of timingAnalyses) {
      const conflicts = swapLayers.filter(
        (layer) =>
          layer !== analysis.recommendedLayer && Math.abs(layer - analysis.recommendedLayer) <= 1
      );

      if (conflicts.length > 0) {
        // Reduce flexibility score due to conflicts
        analysis.swapWindow.flexibilityScore = Math.max(
          0,
          analysis.swapWindow.flexibilityScore - 20
        );
        analysis.swapWindow.constraints.push('Timing conflicts with other swaps');
      }
    }
  }

  private static isSignificantColorChange(
    fromColor: string,
    toColor: string,
    stats: GcodeStats
  ): boolean {
    // Simplified check - could be enhanced with actual color analysis
    return fromColor !== toColor;
  }

  private static getNearbyLayerComplexity(
    layer: number,
    stats: GcodeStats,
    range: number
  ): { avgComplexity: number; maxComplexity: number } {
    let totalComplexity = 0;
    let maxComplexity = 0;
    let count = 0;

    for (let l = layer - range; l <= layer + range; l++) {
      if (l >= 0 && l < stats.totalLayers) {
        const layerColors = stats.layerColorMap.get(l) || [];
        const complexity = layerColors.length;
        totalComplexity += complexity;
        maxComplexity = Math.max(maxComplexity, complexity);
        count++;
      }
    }

    return {
      avgComplexity: count > 0 ? totalComplexity / count : 0,
      maxComplexity,
    };
  }
}
