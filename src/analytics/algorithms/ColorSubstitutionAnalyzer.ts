import { GcodeStats, Color } from '../../types';
import { Logger } from '../../utils/logger';

/**
 * Color substitution analysis for reducing manual swaps in multicolor 3D printing
 * Analyzes color usage patterns to suggest substitutions that minimize manual interventions
 */

export interface ColorSubstitution {
  originalColor: string;
  substituteColor: string;
  similarity: {
    visualDistance: number; // 0-100, lower is more similar
    perceptualDifference: number; // Delta E color difference
    rgbDistance: number;
  };
  impact: {
    swapsReduced: number; // Number of manual swaps eliminated
    percentageReduction: number; // Percentage reduction in manual swaps
    affectedLayers: number[];
    qualityImpact: 'minimal' | 'low' | 'moderate' | 'high';
  };
  feasibility: {
    score: number; // 0-100, higher is more feasible
    considerations: string[];
    warnings: string[];
  };
  recommendation: {
    confidence: number; // 0-100, higher confidence
    reasoning: string[];
    priority: 'high' | 'medium' | 'low';
  };
}

export interface SubstitutionAnalysis {
  substitutions: ColorSubstitution[];
  overallImpact: {
    totalSwapsReduced: number;
    percentageImprovement: number;
    feasibilityScore: number;
    qualityRisk: 'low' | 'medium' | 'high';
  };
  recommendations: {
    bestSubstitutions: ColorSubstitution[];
    alternativeStrategies: string[];
    implementationGuide: string[];
  };
}

export class ColorSubstitutionAnalyzer {
  private static logger = new Logger('ColorSubstitutionAnalyzer');

  /**
   * Analyze all possible color substitutions to reduce manual swaps
   */
  static analyzeSubstitutionOpportunities(
    stats: GcodeStats,
    options: {
      maxVisualDistance?: number;
      prioritizeSwapReduction?: boolean;
      considerPrintQuality?: boolean;
      allowPartialSubstitution?: boolean;
    } = {}
  ): SubstitutionAnalysis {
    this.logger.info('Starting color substitution analysis');

    const {
      maxVisualDistance = 25,
      prioritizeSwapReduction = true,
      considerPrintQuality = true,
      allowPartialSubstitution = false,
    } = options;

    // Step 1: Identify substitution candidates
    const candidates = this.identifySubstitutionCandidates(stats, {
      maxVisualDistance,
      considerPrintQuality,
    });

    // Step 2: Calculate impact for each substitution
    const substitutions = candidates.map((candidate) =>
      this.calculateSubstitutionImpact(candidate, stats, {
        prioritizeSwapReduction,
        allowPartialSubstitution,
      })
    );

    // Step 3: Filter and rank substitutions
    const viableSubstitutions = substitutions
      .filter((sub) => sub.feasibility.score >= 60 && sub.impact.swapsReduced > 0)
      .sort((a, b) => {
        if (prioritizeSwapReduction) {
          return b.impact.swapsReduced - a.impact.swapsReduced;
        }
        return b.recommendation.confidence - a.recommendation.confidence;
      });

    // Step 4: Calculate overall impact
    const overallImpact = this.calculateOverallImpact(viableSubstitutions, stats);

    // Step 5: Generate recommendations
    const recommendations = this.generateRecommendations(viableSubstitutions, overallImpact);

    this.logger.info(`Analysis complete: ${viableSubstitutions.length} viable substitutions found`);

    return {
      substitutions: viableSubstitutions,
      overallImpact,
      recommendations,
    };
  }

  /**
   * Calculate specific impact of swapping one color for another
   */
  static calculateSwapImpact(
    originalColor: string,
    substituteColor: string,
    stats: GcodeStats
  ): {
    swapsReduced: number;
    percentageReduction: number;
    affectedLayers: number[];
    newConflicts: number;
  } {
    this.logger.debug(`Calculating impact of swapping ${originalColor} with ${substituteColor}`);

    const originalColorObj = stats.colors.find((c) => c.id === originalColor);
    const substituteColorObj = stats.colors.find((c) => c.id === substituteColor);

    if (!originalColorObj || !substituteColorObj) {
      return { swapsReduced: 0, percentageReduction: 0, affectedLayers: [], newConflicts: 0 };
    }

    // Get layers where original color is used
    const affectedLayers = Array.from(originalColorObj.layersUsed);

    // Calculate current swap count involving original color
    const currentSwaps = this.countSwapsInvolvingColor(originalColor, stats);

    // Simulate substitution and calculate new swap count
    const simulatedStats = this.simulateColorSubstitution(stats, originalColor, substituteColor);
    const newSwaps = this.countSwapsInvolvingColor(substituteColor, simulatedStats);

    const swapsReduced = Math.max(0, currentSwaps - newSwaps);
    const totalSwaps = this.countTotalSwaps(stats);
    const percentageReduction = totalSwaps > 0 ? (swapsReduced / totalSwaps) * 100 : 0;

    // Check for new conflicts introduced
    const newConflicts = this.countNewConflicts(substituteColor, affectedLayers, stats);

    return {
      swapsReduced,
      percentageReduction,
      affectedLayers,
      newConflicts,
    };
  }

  /**
   * Evaluate color similarity between two colors
   */
  static evaluateColorSimilarity(
    color1: Color,
    color2: Color
  ): {
    visualDistance: number;
    perceptualDifference: number;
    rgbDistance: number;
  } {
    const rgb1 = this.hexToRgb(color1.hexValue || '#888888');
    const rgb2 = this.hexToRgb(color2.hexValue || '#888888');

    if (!rgb1 || !rgb2) {
      return { visualDistance: 100, perceptualDifference: 100, rgbDistance: 100 };
    }

    // Calculate RGB distance
    const rgbDistance = Math.sqrt(
      Math.pow(rgb1.r - rgb2.r, 2) + Math.pow(rgb1.g - rgb2.g, 2) + Math.pow(rgb1.b - rgb2.b, 2)
    );

    // Normalize RGB distance to 0-100 scale
    const normalizedRgbDistance = (rgbDistance / Math.sqrt(3 * 255 * 255)) * 100;

    // Calculate Delta E color difference (simplified CIE76)
    const lab1 = this.rgbToLab(rgb1);
    const lab2 = this.rgbToLab(rgb2);
    const deltaE = Math.sqrt(
      Math.pow(lab1.l - lab2.l, 2) + Math.pow(lab1.a - lab2.a, 2) + Math.pow(lab1.b - lab2.b, 2)
    );

    // Visual distance combines RGB and perceptual factors
    const visualDistance = normalizedRgbDistance * 0.6 + Math.min(deltaE, 100) * 0.4;

    return {
      visualDistance: Math.round(visualDistance),
      perceptualDifference: Math.round(deltaE),
      rgbDistance: Math.round(normalizedRgbDistance),
    };
  }

  // Private helper methods

  private static identifySubstitutionCandidates(
    stats: GcodeStats,
    options: { maxVisualDistance: number; considerPrintQuality: boolean }
  ): Array<{ original: Color; substitute: Color; similarity: any }> {
    const candidates: Array<{ original: Color; substitute: Color; similarity: any }> = [];

    for (let i = 0; i < stats.colors.length; i++) {
      for (let j = 0; j < stats.colors.length; j++) {
        if (i === j) continue;

        const original = stats.colors[i];
        const substitute = stats.colors[j];
        const similarity = this.evaluateColorSimilarity(original, substitute);

        if (similarity.visualDistance <= options.maxVisualDistance) {
          candidates.push({ original, substitute, similarity });
        }
      }
    }

    return candidates;
  }

  private static calculateSubstitutionImpact(
    candidate: { original: Color; substitute: Color; similarity: any },
    stats: GcodeStats,
    options: { prioritizeSwapReduction: boolean; allowPartialSubstitution: boolean }
  ): ColorSubstitution {
    const { original, substitute, similarity } = candidate;

    // Calculate swap impact
    const swapImpact = this.calculateSwapImpact(original.id, substitute.id, stats);

    // Determine quality impact
    const qualityImpact = this.determineQualityImpact(similarity);

    // Calculate feasibility
    const feasibility = this.calculateFeasibility(original, substitute, swapImpact, similarity);

    // Generate recommendation
    const recommendation = this.generateSubstitutionRecommendation(
      original,
      substitute,
      swapImpact,
      feasibility,
      options
    );

    return {
      originalColor: original.id,
      substituteColor: substitute.id,
      similarity,
      impact: {
        swapsReduced: swapImpact.swapsReduced,
        percentageReduction: swapImpact.percentageReduction,
        affectedLayers: swapImpact.affectedLayers,
        qualityImpact,
      },
      feasibility,
      recommendation,
    };
  }

  private static determineQualityImpact(similarity: any): 'minimal' | 'low' | 'moderate' | 'high' {
    if (similarity.visualDistance <= 5) return 'minimal';
    if (similarity.visualDistance <= 15) return 'low';
    if (similarity.visualDistance <= 25) return 'moderate';
    return 'high';
  }

  private static calculateFeasibility(
    original: Color,
    substitute: Color,
    swapImpact: any,
    similarity: any
  ): { score: number; considerations: string[]; warnings: string[] } {
    let score = 100;
    const considerations: string[] = [];
    const warnings: string[] = [];

    // Penalize high visual difference
    score -= similarity.visualDistance * 1.5;

    // Reward swap reduction
    score += swapImpact.swapsReduced * 10;

    // Consider usage frequency compatibility
    const frequencyDiff = Math.abs(original.usagePercentage - substitute.usagePercentage);
    if (frequencyDiff > 20) {
      score -= 15;
      considerations.push('Significant usage frequency difference');
    }

    // Check for new conflicts
    if (swapImpact.newConflicts > 0) {
      score -= swapImpact.newConflicts * 20;
      warnings.push(`Introduces ${swapImpact.newConflicts} new conflicts`);
    }

    // Visual similarity bonus
    if (similarity.visualDistance <= 10) {
      score += 20;
      considerations.push('Highly similar colors');
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      considerations,
      warnings,
    };
  }

  private static generateSubstitutionRecommendation(
    original: Color,
    substitute: Color,
    swapImpact: any,
    feasibility: any,
    options: any
  ): { confidence: number; reasoning: string[]; priority: 'high' | 'medium' | 'low' } {
    const reasoning: string[] = [];
    let confidence = feasibility.score;

    // Add reasoning based on impact
    if (swapImpact.swapsReduced > 0) {
      reasoning.push(
        `Reduces ${swapImpact.swapsReduced} manual swaps (${swapImpact.percentageReduction.toFixed(1)}% improvement)`
      );
    }

    if (swapImpact.swapsReduced >= 3) {
      confidence += 10;
      reasoning.push('Significant swap reduction potential');
    }

    // Priority determination
    let priority: 'high' | 'medium' | 'low' = 'low';
    if (confidence >= 80 && swapImpact.swapsReduced >= 2) {
      priority = 'high';
    } else if (confidence >= 65 && swapImpact.swapsReduced >= 1) {
      priority = 'medium';
    }

    return {
      confidence: Math.min(100, confidence),
      reasoning,
      priority,
    };
  }

  private static calculateOverallImpact(
    substitutions: ColorSubstitution[],
    stats: GcodeStats
  ): {
    totalSwapsReduced: number;
    percentageImprovement: number;
    feasibilityScore: number;
    qualityRisk: 'low' | 'medium' | 'high';
  } {
    const totalSwapsReduced = substitutions.reduce((sum, sub) => sum + sub.impact.swapsReduced, 0);
    const totalSwaps = this.countTotalSwaps(stats);
    const percentageImprovement = totalSwaps > 0 ? (totalSwapsReduced / totalSwaps) * 100 : 0;

    const avgFeasibility =
      substitutions.length > 0
        ? substitutions.reduce((sum, sub) => sum + sub.feasibility.score, 0) / substitutions.length
        : 0;

    // Assess overall quality risk
    const highQualityImpacts = substitutions.filter(
      (sub) => sub.impact.qualityImpact === 'high' || sub.impact.qualityImpact === 'moderate'
    ).length;

    let qualityRisk: 'low' | 'medium' | 'high' = 'low';
    if (highQualityImpacts > substitutions.length * 0.5) {
      qualityRisk = 'high';
    } else if (highQualityImpacts > substitutions.length * 0.25) {
      qualityRisk = 'medium';
    }

    return {
      totalSwapsReduced,
      percentageImprovement,
      feasibilityScore: avgFeasibility,
      qualityRisk,
    };
  }

  private static generateRecommendations(
    substitutions: ColorSubstitution[],
    overallImpact: any
  ): {
    bestSubstitutions: ColorSubstitution[];
    alternativeStrategies: string[];
    implementationGuide: string[];
  } {
    const bestSubstitutions = substitutions
      .filter((sub) => sub.recommendation.priority === 'high')
      .slice(0, 3);

    const alternativeStrategies: string[] = [];
    if (bestSubstitutions.length === 0) {
      alternativeStrategies.push('Consider manual slot optimization instead of color substitution');
      alternativeStrategies.push('Evaluate print design for color consolidation opportunities');
    }

    if (overallImpact.qualityRisk === 'high') {
      alternativeStrategies.push('Review color substitutions for visual impact on final print');
    }

    const implementationGuide: string[] = [
      'Start with highest confidence substitutions',
      'Test visual appearance with small samples first',
      'Apply substitutions one at a time to verify impact',
      'Monitor print quality and adjust if necessary',
    ];

    return {
      bestSubstitutions,
      alternativeStrategies,
      implementationGuide,
    };
  }

  // Utility methods for color calculations and simulations

  private static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  private static rgbToLab(rgb: { r: number; g: number; b: number }): {
    l: number;
    a: number;
    b: number;
  } {
    // Simplified RGB to LAB conversion for Delta E calculation
    // This is a basic implementation - could be enhanced with proper color space conversion
    let r = rgb.r / 255;
    let g = rgb.g / 255;
    let b = rgb.b / 255;

    // Apply gamma correction
    r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    // Convert to XYZ
    let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
    let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

    // Convert to LAB
    x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
    y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
    z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

    return {
      l: 116 * y - 16,
      a: 500 * (x - y),
      b: 200 * (y - z),
    };
  }

  private static countSwapsInvolvingColor(colorId: string, stats: GcodeStats): number {
    return stats.toolChanges.filter(
      (change) => change.fromTool === colorId || change.toTool === colorId
    ).length;
  }

  private static countTotalSwaps(stats: GcodeStats): number {
    return stats.toolChanges.length;
  }

  private static simulateColorSubstitution(
    stats: GcodeStats,
    originalColor: string,
    substituteColor: string
  ): GcodeStats {
    // Create a deep copy for simulation
    const simulatedStats = JSON.parse(JSON.stringify(stats));

    // Replace original color with substitute in all data structures
    simulatedStats.colors = simulatedStats.colors.map((color: Color) =>
      color.id === originalColor ? { ...color, id: substituteColor } : color
    );

    simulatedStats.toolChanges = simulatedStats.toolChanges.map((change: any) => ({
      ...change,
      fromTool: change.fromTool === originalColor ? substituteColor : change.fromTool,
      toTool: change.toTool === originalColor ? substituteColor : change.toTool,
    }));

    return simulatedStats;
  }

  private static countNewConflicts(
    substituteColor: string,
    affectedLayers: number[],
    stats: GcodeStats
  ): number {
    let conflicts = 0;
    const substituteColorObj = stats.colors.find((c) => c.id === substituteColor);

    if (!substituteColorObj) return 0;

    // Check for conflicts in affected layers
    for (const layer of affectedLayers) {
      const layerColors = stats.layerColorMap.get(layer) || [];
      if (layerColors.includes(substituteColor)) {
        conflicts++;
      }
    }

    return conflicts;
  }
}
