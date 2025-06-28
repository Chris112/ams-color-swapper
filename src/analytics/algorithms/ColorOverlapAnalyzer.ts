import { GcodeStats, Color } from '../../types';
import { ColorOverlapStats } from '../../types/analytics';
import { Logger } from '../../utils/logger';

/**
 * Advanced algorithms for analyzing color overlaps, conflicts, and AMS optimization opportunities
 */
export class ColorOverlapAnalyzer {
  private static logger = new Logger('ColorOverlapAnalyzer');

  /**
   * Perform comprehensive color overlap analysis
   */
  static analyzeColorOverlaps(stats: GcodeStats): ColorOverlapStats {
    this.logger.info('Starting comprehensive color overlap analysis');

    const colorPairs = this.buildColorPairMatrix(stats);
    const conflictingColors = this.identifyConflictingColors(stats, colorPairs);
    const suggestedGroupings = this.generateAMSSlotGroupings(stats, colorPairs);

    const result: ColorOverlapStats = {
      colorPairs,
      conflictingColors,
      suggestedGroupings,
    };

    this.logger.info(
      `Analysis complete: found ${conflictingColors.length} color conflicts and ${suggestedGroupings.length} grouping suggestions`
    );
    return result;
  }

  /**
   * Build detailed color pair co-occurrence matrix
   */
  static buildColorPairMatrix(stats: GcodeStats): Map<string, Map<string, number>> {
    this.logger.info('Building color pair co-occurrence matrix');

    const colorPairs = new Map<string, Map<string, number>>();

    // Initialize matrix for all colors
    for (const color of stats.colors) {
      colorPairs.set(color.id, new Map());
      for (const otherColor of stats.colors) {
        if (color.id !== otherColor.id) {
          colorPairs.get(color.id)!.set(otherColor.id, 0);
        }
      }
    }

    // Count simultaneous usage
    for (const [, colors] of stats.layerColorMap) {
      if (colors.length > 1) {
        // Count all pairs in this layer
        for (let i = 0; i < colors.length; i++) {
          for (let j = i + 1; j < colors.length; j++) {
            const color1 = colors[i];
            const color2 = colors[j];

            // Increment both directions for symmetric matrix
            if (colorPairs.has(color1) && colorPairs.get(color1)!.has(color2)) {
              const currentCount = colorPairs.get(color1)!.get(color2) || 0;
              colorPairs.get(color1)!.set(color2, currentCount + 1);
            }

            if (colorPairs.has(color2) && colorPairs.get(color2)!.has(color1)) {
              const currentCount = colorPairs.get(color2)!.get(color1) || 0;
              colorPairs.get(color2)!.set(color1, currentCount + 1);
            }
          }
        }
      }
    }

    return colorPairs;
  }

  /**
   * Identify conflicting color combinations with severity assessment
   */
  static identifyConflictingColors(
    stats: GcodeStats,
    colorPairs: Map<string, Map<string, number>>
  ): Array<{
    color1: string;
    color2: string;
    overlapLayers: number[];
    conflictSeverity: 'low' | 'medium' | 'high';
  }> {
    this.logger.info('Identifying conflicting color combinations');

    const conflicts: Array<{
      color1: string;
      color2: string;
      overlapLayers: number[];
      conflictSeverity: 'low' | 'medium' | 'high';
    }> = [];

    for (const [color1, pairMap] of colorPairs) {
      for (const [color2, overlapCount] of pairMap) {
        if (overlapCount > 0 && color1 < color2) {
          // Avoid duplicates by using lexicographic order
          // Find all layers where these colors overlap
          const overlapLayers: number[] = [];

          for (const [layer, colors] of stats.layerColorMap) {
            if (colors.includes(color1) && colors.includes(color2)) {
              overlapLayers.push(layer);
            }
          }

          // Assess conflict severity
          const overlapPercentage = (overlapCount / stats.totalLayers) * 100;
          const overlapFrequency = overlapLayers.length;

          let conflictSeverity: 'low' | 'medium' | 'high';

          if (overlapPercentage >= 20 || overlapFrequency >= stats.totalLayers * 0.3) {
            conflictSeverity = 'high';
          } else if (overlapPercentage >= 10 || overlapFrequency >= stats.totalLayers * 0.15) {
            conflictSeverity = 'medium';
          } else {
            conflictSeverity = 'low';
          }

          conflicts.push({
            color1,
            color2,
            overlapLayers,
            conflictSeverity,
          });
        }
      }
    }

    // Sort by severity and overlap frequency
    conflicts.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      if (severityOrder[a.conflictSeverity] !== severityOrder[b.conflictSeverity]) {
        return severityOrder[b.conflictSeverity] - severityOrder[a.conflictSeverity];
      }
      return b.overlapLayers.length - a.overlapLayers.length;
    });

    this.logger.info(`Identified ${conflicts.length} color conflicts`);
    return conflicts;
  }

  /**
   * Generate optimized AMS slot groupings with efficiency analysis
   */
  static generateAMSSlotGroupings(
    stats: GcodeStats,
    colorPairs: Map<string, Map<string, number>>
  ): Array<{
    slot: number;
    colors: string[];
    reason: string;
    efficiency: number;
  }> {
    this.logger.info('Generating AMS slot groupings');

    const groupings: Array<{
      slot: number;
      colors: string[];
      reason: string;
      efficiency: number;
    }> = [];

    // Advanced grouping algorithm using graph clustering
    const affinityGraph = this.buildAffinityGraph(stats, colorPairs);
    const clusters = this.clusterColors(affinityGraph, 4); // Assume 4 AMS slots

    let slotNumber = 1;
    for (const cluster of clusters) {
      if (cluster.colors.length > 0) {
        const efficiency = this.calculateGroupingEfficiency(cluster, colorPairs);
        const reason = this.generateGroupingReason(cluster, colorPairs);

        groupings.push({
          slot: slotNumber++,
          colors: cluster.colors,
          reason,
          efficiency,
        });
      }
    }

    // Fill remaining slots if we have ungrouped colors
    const groupedColors = new Set(groupings.flatMap((g) => g.colors));
    const ungroupedColors = stats.colors
      .map((c) => c.id)
      .filter((colorId) => !groupedColors.has(colorId));

    for (const color of ungroupedColors) {
      if (slotNumber <= 4) {
        groupings.push({
          slot: slotNumber++,
          colors: [color],
          reason: 'Independent usage pattern',
          efficiency: 60, // Base efficiency for single colors
        });
      }
    }

    this.logger.info(`Generated ${groupings.length} slot groupings`);
    return groupings;
  }

  /**
   * Analyze color usage proximity patterns
   */
  static analyzeColorProximity(stats: GcodeStats): {
    proximityMatrix: Map<string, Map<string, number>>;
    nearbyPairs: Array<{
      color1: string;
      color2: string;
      averageDistance: number;
      proximityScore: number;
    }>;
    isolatedColors: string[];
  } {
    this.logger.info('Analyzing color usage proximity patterns');

    const proximityMatrix = new Map<string, Map<string, number>>();
    const proximityScores: Array<{
      color1: string;
      color2: string;
      averageDistance: number;
      proximityScore: number;
    }> = [];

    // Initialize proximity matrix
    for (const color of stats.colors) {
      proximityMatrix.set(color.id, new Map());
    }

    // Calculate average distance between color usages
    for (let i = 0; i < stats.colors.length; i++) {
      for (let j = i + 1; j < stats.colors.length; j++) {
        const color1 = stats.colors[i];
        const color2 = stats.colors[j];

        const distances = this.calculateColorDistances(color1, color2);

        if (distances.length > 0) {
          const averageDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
          const proximityScore = Math.max(0, 100 - averageDistance * 5); // Closer = higher score

          proximityMatrix.get(color1.id)!.set(color2.id, proximityScore);
          proximityMatrix.get(color2.id)!.set(color1.id, proximityScore);

          proximityScores.push({
            color1: color1.id,
            color2: color2.id,
            averageDistance,
            proximityScore,
          });
        }
      }
    }

    // Find nearby pairs (high proximity score)
    const nearbyPairs = proximityScores
      .filter((p) => p.proximityScore > 60)
      .sort((a, b) => b.proximityScore - a.proximityScore);

    // Find isolated colors (low proximity to all others)
    const isolatedColors: string[] = [];
    for (const color of stats.colors) {
      const maxProximity = Math.max(...Array.from(proximityMatrix.get(color.id)!.values()));

      if (maxProximity < 30) {
        isolatedColors.push(color.id);
      }
    }

    this.logger.info(
      `Found ${nearbyPairs.length} nearby color pairs and ${isolatedColors.length} isolated colors`
    );

    return {
      proximityMatrix,
      nearbyPairs,
      isolatedColors,
    };
  }

  /**
   * Detect color usage hotspots and cold zones
   */
  static detectUsageHotspots(stats: GcodeStats): {
    hotspots: Array<{
      startLayer: number;
      endLayer: number;
      activeColors: string[];
      intensity: number;
      characteristics: string[];
    }>;
    coldZones: Array<{
      startLayer: number;
      endLayer: number;
      dominantColor: string;
      intensity: number;
    }>;
  } {
    this.logger.info('Detecting color usage hotspots and cold zones');

    const hotspots: Array<{
      startLayer: number;
      endLayer: number;
      activeColors: string[];
      intensity: number;
      characteristics: string[];
    }> = [];

    const coldZones: Array<{
      startLayer: number;
      endLayer: number;
      dominantColor: string;
      intensity: number;
    }> = [];

    // Analyze in sliding windows
    const windowSize = Math.max(5, Math.floor(stats.totalLayers / 20));

    for (let start = 0; start < stats.totalLayers - windowSize; start += windowSize) {
      const end = Math.min(start + windowSize, stats.totalLayers);
      const windowColors = new Set<string>();
      let colorChanges = 0;
      let totalColors = 0;

      for (let layer = start; layer < end; layer++) {
        const layerColors = stats.layerColorMap.get(layer) || [];
        totalColors += layerColors.length;

        for (const color of layerColors) {
          windowColors.add(color);
        }

        // Count color changes within window
        if (layer > start) {
          const prevLayerColors = stats.layerColorMap.get(layer - 1) || [];
          const currentLayerColors = stats.layerColorMap.get(layer) || [];

          if (
            JSON.stringify(prevLayerColors.sort()) !== JSON.stringify(currentLayerColors.sort())
          ) {
            colorChanges++;
          }
        }
      }

      const averageColorsPerLayer = totalColors / (end - start);
      const changeFrequency = colorChanges / (end - start);
      const intensity = averageColorsPerLayer * 20 + changeFrequency * 30;

      if (intensity > 60 && windowColors.size > 2) {
        // Hotspot detected
        const characteristics: string[] = [];

        if (windowColors.size > 3) characteristics.push('High color diversity');
        if (changeFrequency > 0.5) characteristics.push('Frequent changes');
        if (averageColorsPerLayer > 2) characteristics.push('Multi-color layers');

        hotspots.push({
          startLayer: start,
          endLayer: end - 1,
          activeColors: Array.from(windowColors),
          intensity,
          characteristics,
        });
      } else if (intensity < 30 && windowColors.size <= 2) {
        // Cold zone detected
        const dominantColor = Array.from(windowColors)[0] || 'unknown';

        coldZones.push({
          startLayer: start,
          endLayer: end - 1,
          dominantColor,
          intensity,
        });
      }
    }

    this.logger.info(`Detected ${hotspots.length} hotspots and ${coldZones.length} cold zones`);

    return {
      hotspots,
      coldZones,
    };
  }

  // Private helper methods

  private static buildAffinityGraph(
    stats: GcodeStats,
    colorPairs: Map<string, Map<string, number>>
  ): Map<string, Map<string, number>> {
    const affinityGraph = new Map<string, Map<string, number>>();

    for (const color of stats.colors) {
      affinityGraph.set(color.id, new Map());
    }

    // Calculate affinity scores based on multiple factors
    for (const [color1, pairMap] of colorPairs) {
      for (const [color2, coOccurrence] of pairMap) {
        if (color1 !== color2) {
          // Factor 1: Co-occurrence frequency
          const coOccurrenceScore = Math.min(coOccurrence * 10, 50);

          // Factor 2: Usage pattern similarity
          const color1Data = stats.colors.find((c) => c.id === color1);
          const color2Data = stats.colors.find((c) => c.id === color2);

          let similarityScore = 0;
          if (color1Data && color2Data) {
            const usageDiff = Math.abs(color1Data.usagePercentage - color2Data.usagePercentage);
            similarityScore = Math.max(0, 30 - usageDiff);
          }

          // Factor 3: Proximity in layer sequence
          const proximityScore = this.calculateProximityScore(color1Data, color2Data);

          // Combined affinity score
          const totalAffinity = coOccurrenceScore + similarityScore + proximityScore;

          affinityGraph.get(color1)!.set(color2, totalAffinity);
        }
      }
    }

    return affinityGraph;
  }

  private static clusterColors(
    affinityGraph: Map<string, Map<string, number>>,
    maxClusters: number
  ): Array<{ colors: string[]; totalAffinity: number }> {
    const colors = Array.from(affinityGraph.keys());
    const clusters: Array<{ colors: string[]; totalAffinity: number }> = [];
    const assigned = new Set<string>();

    // Greedy clustering algorithm
    while (assigned.size < colors.length && clusters.length < maxClusters) {
      let bestCluster: string[] = [];
      let bestAffinity = 0;

      // Try to find the best cluster starting from each unassigned color
      for (const startColor of colors) {
        if (assigned.has(startColor)) continue;

        const cluster = [startColor];
        let clusterAffinity = 0;

        // Greedily add colors with highest affinity
        while (cluster.length < 4) {
          // Max 4 colors per AMS slot
          let bestAddition = '';
          let bestAdditionAffinity = 0;

          for (const candidate of colors) {
            if (assigned.has(candidate) || cluster.includes(candidate)) continue;

            let candidateAffinity = 0;
            for (const clusterColor of cluster) {
              candidateAffinity += affinityGraph.get(clusterColor)?.get(candidate) || 0;
            }

            if (candidateAffinity > bestAdditionAffinity) {
              bestAdditionAffinity = candidateAffinity;
              bestAddition = candidate;
            }
          }

          if (bestAddition && bestAdditionAffinity > 20) {
            // Minimum affinity threshold
            cluster.push(bestAddition);
            clusterAffinity += bestAdditionAffinity;
          } else {
            break;
          }
        }

        if (clusterAffinity > bestAffinity) {
          bestAffinity = clusterAffinity;
          bestCluster = cluster;
        }
      }

      if (bestCluster.length > 0) {
        clusters.push({
          colors: bestCluster,
          totalAffinity: bestAffinity,
        });

        for (const color of bestCluster) {
          assigned.add(color);
        }
      } else {
        // Add remaining colors individually
        const remainingColors = colors.filter((c) => !assigned.has(c));
        for (const color of remainingColors) {
          if (clusters.length < maxClusters) {
            clusters.push({
              colors: [color],
              totalAffinity: 0,
            });
            assigned.add(color);
          }
        }
        break;
      }
    }

    return clusters;
  }

  private static calculateGroupingEfficiency(
    cluster: { colors: string[]; totalAffinity: number },
    colorPairs: Map<string, Map<string, number>>
  ): number {
    if (cluster.colors.length === 1) return 60;

    let totalCoOccurrence = 0;
    let pairCount = 0;

    for (let i = 0; i < cluster.colors.length; i++) {
      for (let j = i + 1; j < cluster.colors.length; j++) {
        const color1 = cluster.colors[i];
        const color2 = cluster.colors[j];

        const coOccurrence = colorPairs.get(color1)?.get(color2) || 0;
        totalCoOccurrence += coOccurrence;
        pairCount++;
      }
    }

    const averageCoOccurrence = pairCount > 0 ? totalCoOccurrence / pairCount : 0;
    const efficiency = Math.min(90, 40 + averageCoOccurrence * 5);

    return Math.max(efficiency, 30); // Minimum efficiency floor
  }

  private static generateGroupingReason(
    cluster: { colors: string[]; totalAffinity: number },
    colorPairs: Map<string, Map<string, number>>
  ): string {
    if (cluster.colors.length === 1) {
      return 'Single color usage';
    }

    const maxCoOccurrence = Math.max(
      ...cluster.colors.flatMap((c1) =>
        cluster.colors.filter((c2) => c2 !== c1).map((c2) => colorPairs.get(c1)?.get(c2) || 0)
      )
    );

    if (maxCoOccurrence > 10) {
      return 'Frequently used together';
    } else if (maxCoOccurrence > 5) {
      return 'Occasionally used together';
    } else {
      return 'Compatible usage patterns';
    }
  }

  private static calculateColorDistances(color1: Color, color2: Color): number[] {
    const distances: number[] = [];
    const layers1 = Array.from(color1.layersUsed).sort((a, b) => a - b);
    const layers2 = Array.from(color2.layersUsed).sort((a, b) => a - b);

    for (const layer1 of layers1) {
      let minDistance = Infinity;
      for (const layer2 of layers2) {
        const distance = Math.abs(layer1 - layer2);
        minDistance = Math.min(minDistance, distance);
      }
      if (minDistance !== Infinity) {
        distances.push(minDistance);
      }
    }

    return distances;
  }

  private static calculateProximityScore(color1?: Color, color2?: Color): number {
    if (!color1 || !color2) return 0;

    const distances = this.calculateColorDistances(color1, color2);
    if (distances.length === 0) return 0;

    const averageDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    return Math.max(0, 20 - averageDistance);
  }
}
