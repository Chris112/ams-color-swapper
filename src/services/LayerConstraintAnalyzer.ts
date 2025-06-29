import { GcodeStats } from '../types/gcode';
import { PrintConstraints, SystemConfiguration } from '../types/configuration';
import {
  LayerConstraintViolation,
  ConstraintViolationRange,
  ColorConsolidationSuggestion,
  ConstraintValidationResult,
} from '../types/constraints';
import { Color } from '../domain/models/Color';

/**
 * Analyzes G-code for layer constraints and generates smart suggestions
 * for resolving violations where more colors are required than available slots.
 */
export class LayerConstraintAnalyzer {
  /**
   * Validates all layers against printer constraints
   */
  static validateLayerConstraints(
    stats: GcodeStats,
    configuration: SystemConfiguration
  ): ConstraintValidationResult {
    const constraints: PrintConstraints = {
      maxSimultaneousColors: configuration.totalSlots,
      printerType: configuration.type,
    };

    const violations: LayerConstraintViolation[] = [];

    // Analyze each layer for constraint violations
    for (let layer = 1; layer <= stats.totalLayers; layer++) {
      const colorsInLayer = this.getColorsInLayer(stats, layer);
      const requiredColors = colorsInLayer.length;

      if (requiredColors > constraints.maxSimultaneousColors) {
        violations.push({
          layer,
          requiredColors,
          availableSlots: constraints.maxSimultaneousColors,
          colorsInLayer,
          violationType: 'impossible',
          severity: 'critical',
        });
      }
      // Removed suboptimal check - having exactly the number of slots is valid, not a violation
    }

    // Group consecutive violations into ranges
    const violationRanges = this.groupViolationsIntoRanges(violations, stats, constraints);

    // Generate summary
    const impossibleViolations = violations.filter((v) => v.violationType === 'impossible');
    const worstViolation = violationRanges.find((r) =>
      r.affectedLayers.some((l) => l.violationType === 'impossible')
    );

    return {
      isValid: violations.length === 0,
      hasViolations: violations.length > 0,
      violations: violationRanges,
      totalImpossibleLayers: impossibleViolations.length,
      worstViolation,
      summary: {
        impossibleLayerCount: impossibleViolations.length,
        maxColorsRequired: Math.max(...violations.map((v) => v.requiredColors), 0),
        availableSlots: constraints.maxSimultaneousColors,
        suggestionsCount: violationRanges.reduce((sum, r) => sum + r.suggestions.length, 0),
      },
    };
  }

  /**
   * Gets all colors used in a specific layer
   */
  private static getColorsInLayer(stats: GcodeStats, layer: number): string[] {
    // Check if we have layer color map
    if (stats.layerColorMap && stats.layerColorMap.has(layer)) {
      return stats.layerColorMap.get(layer) || [];
    }

    // Fallback: check color ranges
    const colorsInLayer = new Set<string>();
    stats.colorUsageRanges.forEach((range) => {
      if (layer >= range.startLayer && layer <= range.endLayer) {
        colorsInLayer.add(range.colorId);
      }
    });

    return Array.from(colorsInLayer);
  }

  /**
   * Groups consecutive violation layers into ranges for better user understanding
   */
  private static groupViolationsIntoRanges(
    violations: LayerConstraintViolation[],
    stats: GcodeStats,
    constraints: PrintConstraints
  ): ConstraintViolationRange[] {
    if (violations.length === 0) return [];

    const ranges: ConstraintViolationRange[] = [];
    const sortedViolations = [...violations].sort((a, b) => a.layer - b.layer);

    let currentRange: ConstraintViolationRange | null = null;

    for (const violation of sortedViolations) {
      // Start new range or continue existing one
      if (!currentRange || violation.layer > currentRange.endLayer + 1) {
        // Start new range
        if (currentRange) {
          currentRange.suggestions = this.generateSuggestions(currentRange, stats);
          ranges.push(currentRange);
        }

        currentRange = {
          startLayer: violation.layer,
          endLayer: violation.layer,
          maxColorsRequired: violation.requiredColors,
          availableSlots: constraints.maxSimultaneousColors,
          affectedLayers: [violation],
          suggestions: [],
        };
      } else {
        // Extend current range
        currentRange.endLayer = violation.layer;
        currentRange.maxColorsRequired = Math.max(
          currentRange.maxColorsRequired,
          violation.requiredColors
        );
        currentRange.affectedLayers.push(violation);
      }
    }

    // Don't forget the last range
    if (currentRange) {
      currentRange.suggestions = this.generateSuggestions(currentRange, stats);
      ranges.push(currentRange);
    }

    return ranges;
  }

  /**
   * Generates smart suggestions for resolving constraint violations
   */
  private static generateSuggestions(
    range: ConstraintViolationRange,
    stats: GcodeStats
  ): ColorConsolidationSuggestion[] {
    const suggestions: ColorConsolidationSuggestion[] = [];

    // Get all colors used in this range
    const colorsInRange = new Set<string>();
    range.affectedLayers.forEach((layer) => {
      layer.colorsInLayer.forEach((color) => colorsInRange.add(color));
    });

    const rangeColors = Array.from(colorsInRange);
    const colorObjects = rangeColors
      .map((colorId) => stats.colors.find((c) => c.id === colorId))
      .filter(Boolean) as Color[];

    // Strategy 1: Find colors with minimal usage in this range
    const colorUsageInRange = this.calculateColorUsageInRange(range, stats);
    const lowUsageColors = colorUsageInRange
      .filter((usage) => usage.percentage < 5) // Less than 5% usage
      .sort((a, b) => a.percentage - b.percentage);

    lowUsageColors.forEach((usage) => {
      const color = stats.colors.find((c) => c.id === usage.colorId);
      if (color) {
        suggestions.push({
          type: 'remove',
          primaryColor: usage.colorId,
          reason: `Minimal usage (${usage.percentage.toFixed(1)}%) in problematic layers`,
          impact: {
            visualImpact: usage.percentage < 2 ? 'minimal' : 'low',
            usagePercentage: usage.percentage,
            layersAffected: usage.layers,
          },
          instruction: `Remove or replace "${color.name || usage.colorId}" from layers ${range.startLayer}-${range.endLayer} in your slicer`,
        });
      }
    });

    // Strategy 2: Find similar colors that can be merged
    const similarColorPairs = this.findSimilarColors(colorObjects);
    similarColorPairs.forEach(({ color1, color2, similarity }) => {
      const usage1 = colorUsageInRange.find((u) => u.colorId === color1.id);
      const usage2 = colorUsageInRange.find((u) => u.colorId === color2.id);

      if (usage1 && usage2) {
        const lessUsedColor = usage1.percentage < usage2.percentage ? color1 : color2;
        const moreUsedColor = usage1.percentage < usage2.percentage ? color2 : color1;

        suggestions.push({
          type: 'merge',
          primaryColor: moreUsedColor.id,
          secondaryColor: lessUsedColor.id,
          reason: `Colors are visually similar (${similarity.rgbDistance.toFixed(0)} RGB distance)`,
          impact: {
            visualImpact: similarity.visuallySimilar ? 'minimal' : 'low',
            usagePercentage: Math.min(usage1.percentage, usage2.percentage),
            layersAffected: range.affectedLayers.map((l) => l.layer),
          },
          similarity,
          instruction: `Replace "${lessUsedColor.name || lessUsedColor.id}" with "${moreUsedColor.name || moreUsedColor.id}" in your slicer`,
        });
      }
    });

    // Strategy 3: Identify accent colors that could be simplified
    const accentColors = colorUsageInRange.filter(
      (usage) => usage.percentage < 10 && usage.isDetail
    );

    accentColors.forEach((usage) => {
      const color = stats.colors.find((c) => c.id === usage.colorId);
      if (color) {
        suggestions.push({
          type: 'remove',
          primaryColor: usage.colorId,
          reason: 'Used only for small details/accents',
          impact: {
            visualImpact: 'low',
            usagePercentage: usage.percentage,
            layersAffected: usage.layers,
          },
          instruction: `Consider removing accent color "${color.name || usage.colorId}" or merging with a primary color`,
        });
      }
    });

    // Sort suggestions by impact (lowest visual impact first)
    return suggestions
      .sort((a, b) => {
        const impactOrder = { minimal: 0, low: 1, medium: 2, high: 3 };
        return impactOrder[a.impact.visualImpact] - impactOrder[b.impact.visualImpact];
      })
      .slice(0, 5); // Limit to top 5 suggestions
  }

  /**
   * Calculates color usage statistics within a specific layer range
   */
  private static calculateColorUsageInRange(
    range: ConstraintViolationRange,
    stats: GcodeStats
  ): Array<{
    colorId: string;
    percentage: number;
    layers: number[];
    isDetail: boolean;
  }> {
    const colorUsage = new Map<string, { layers: Set<number>; totalLayers: number }>();

    // Count usage for each color in the range
    for (let layer = range.startLayer; layer <= range.endLayer; layer++) {
      const colorsInLayer = this.getColorsInLayer(stats, layer);
      colorsInLayer.forEach((colorId) => {
        if (!colorUsage.has(colorId)) {
          colorUsage.set(colorId, { layers: new Set(), totalLayers: 0 });
        }
        colorUsage.get(colorId)!.layers.add(layer);
      });
    }

    const totalLayersInRange = range.endLayer - range.startLayer + 1;

    return Array.from(colorUsage.entries()).map(([colorId, usage]) => {
      const layers = Array.from(usage.layers);
      const percentage = (layers.length / totalLayersInRange) * 100;

      // Heuristic: if a color is used in less than 30% of layers, it's likely a detail
      const isDetail = percentage < 30;

      return {
        colorId,
        percentage,
        layers,
        isDetail,
      };
    });
  }

  /**
   * Finds pairs of similar colors that could potentially be merged
   */
  private static findSimilarColors(colors: Color[]): Array<{
    color1: Color;
    color2: Color;
    similarity: {
      rgbDistance: number;
      hslSimilarity: number;
      visuallySimilar: boolean;
    };
  }> {
    const pairs: Array<{
      color1: Color;
      color2: Color;
      similarity: {
        rgbDistance: number;
        hslSimilarity: number;
        visuallySimilar: boolean;
      };
    }> = [];

    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const color1 = colors[i];
        const color2 = colors[j];

        if (!color1.hexValue || !color2.hexValue) continue;

        const similarity = this.calculateColorSimilarity(color1.hexValue, color2.hexValue);

        // Only include pairs that are reasonably similar
        if (similarity.rgbDistance < 150 && similarity.visuallySimilar) {
          pairs.push({ color1, color2, similarity });
        }
      }
    }

    return pairs.sort((a, b) => a.similarity.rgbDistance - b.similarity.rgbDistance);
  }

  /**
   * Calculates similarity between two colors
   */
  private static calculateColorSimilarity(
    hex1: string,
    hex2: string
  ): {
    rgbDistance: number;
    hslSimilarity: number;
    visuallySimilar: boolean;
  } {
    const rgb1 = this.hexToRgb(hex1);
    const rgb2 = this.hexToRgb(hex2);

    if (!rgb1 || !rgb2) {
      return { rgbDistance: 999, hslSimilarity: 0, visuallySimilar: false };
    }

    // Calculate RGB distance (Euclidean distance in RGB space)
    const rgbDistance = Math.sqrt(
      Math.pow(rgb1.r - rgb2.r, 2) + Math.pow(rgb1.g - rgb2.g, 2) + Math.pow(rgb1.b - rgb2.b, 2)
    );

    // Convert to HSL for perceptual similarity
    const hsl1 = this.rgbToHsl(rgb1.r, rgb1.g, rgb1.b);
    const hsl2 = this.rgbToHsl(rgb2.r, rgb2.g, rgb2.b);

    // Calculate HSL similarity (focusing on hue and saturation)
    const hueDiff = Math.min(Math.abs(hsl1.h - hsl2.h), 360 - Math.abs(hsl1.h - hsl2.h));
    const satDiff = Math.abs(hsl1.s - hsl2.s);
    const lightDiff = Math.abs(hsl1.l - hsl2.l);

    const hslSimilarity = 100 - ((hueDiff / 180) * 50 + satDiff * 25 + lightDiff * 25);

    // Determine if visually similar (threshold-based)
    const visuallySimilar = rgbDistance < 100 || (hueDiff < 30 && satDiff < 0.3 && lightDiff < 0.3);

    return {
      rgbDistance,
      hslSimilarity,
      visuallySimilar,
    };
  }

  /**
   * Converts hex color to RGB
   */
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

  /**
   * Converts RGB to HSL
   */
  private static rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return {
      h: h * 360,
      s: s,
      l: l,
    };
  }
}
