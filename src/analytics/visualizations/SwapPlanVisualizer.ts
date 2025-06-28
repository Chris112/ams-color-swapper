import { GcodeStats, ManualSwap } from '../../types';
import { Logger } from '../../utils/logger';

/**
 * Trust-building visualizations for AMS swap plans
 * Provides interactive visualizations to help users understand and trust the optimization decisions
 */

export interface VisualizationData {
  colorUsageTimeline: {
    layers: number[];
    colorUsage: Array<{
      colorId: string;
      startLayer: number;
      endLayer: number;
      intensity: number; // Usage density
      conflicts: number[];
    }>;
  };
  slotOccupancy: {
    slots: Array<{
      slotId: number;
      timeline: Array<{
        layer: number;
        colorId: string | null;
        action: 'loaded' | 'unloaded' | 'swapped';
        confidence: number;
      }>;
    }>;
  };
  conflictVisualization: {
    conflicts: Array<{
      layer: number;
      colors: string[];
      severity: 'low' | 'medium' | 'high';
      resolution: string;
    }>;
  };
  swapImpactPreview: {
    before: SwapPlanMetrics;
    after: SwapPlanMetrics;
    improvements: string[];
  };
  trustMetrics: {
    overallConfidence: number;
    dataQuality: number;
    algorithmReliability: number;
    userControlLevel: number;
  };
}

export interface SwapPlanMetrics {
  totalSwaps: number;
  efficiency: number;
  wastedMaterial: number;
  printTime: number;
  complexityScore: number;
}

export interface VisualizationConfig {
  showConflicts: boolean;
  highlightImprovements: boolean;
  enableInteractivity: boolean;
  colorScheme: 'vibrant' | 'pastel' | 'monochrome';
  animationSpeed: 'slow' | 'normal' | 'fast';
}

export class SwapPlanVisualizer {
  private static logger = new Logger('SwapPlanVisualizer');

  /**
   * Generate comprehensive visualization data for the swap plan
   */
  static generateVisualizationData(
    stats: GcodeStats,
    swaps: ManualSwap[],
    config: VisualizationConfig = {
      showConflicts: true,
      highlightImprovements: true,
      enableInteractivity: true,
      colorScheme: 'vibrant',
      animationSpeed: 'normal',
    }
  ): VisualizationData {
    this.logger.info('Generating swap plan visualization data');

    const colorUsageTimeline = this.generateColorUsageTimeline(stats, config);
    const slotOccupancy = this.generateSlotOccupancyData(stats, swaps, config);
    const conflictVisualization = this.generateConflictVisualization(stats, swaps, config);
    const swapImpactPreview = this.generateSwapImpactPreview(stats, swaps);
    const trustMetrics = this.calculateTrustMetrics(stats, swaps);

    return {
      colorUsageTimeline,
      slotOccupancy,
      conflictVisualization,
      swapImpactPreview,
      trustMetrics,
    };
  }

  /**
   * Create interactive color usage timeline visualization
   */
  static generateColorUsageTimeline(
    stats: GcodeStats,
    config: VisualizationConfig
  ): VisualizationData['colorUsageTimeline'] {
    this.logger.debug('Generating color usage timeline');

    const layers = Array.from({ length: stats.totalLayers }, (_, i) => i);
    const colorUsage: Array<{
      colorId: string;
      startLayer: number;
      endLayer: number;
      intensity: number;
      conflicts: number[];
    }> = [];

    for (const color of stats.colors) {
      const layersUsed = Array.from(color.layersUsed).sort((a, b) => a - b);
      if (layersUsed.length === 0) continue;

      // Calculate usage intensity (how dense the usage is)
      const totalSpan = layersUsed[layersUsed.length - 1] - layersUsed[0] + 1;
      const intensity = layersUsed.length / totalSpan;

      // Identify conflicts - layers where this color conflicts with others
      const conflicts: number[] = [];
      for (const layer of layersUsed) {
        const layerColors = stats.layerColorMap.get(layer) || [];
        if (layerColors.length > 1 && layerColors.includes(color.id)) {
          conflicts.push(layer);
        }
      }

      colorUsage.push({
        colorId: color.id,
        startLayer: layersUsed[0],
        endLayer: layersUsed[layersUsed.length - 1],
        intensity: Math.round(intensity * 100) / 100,
        conflicts,
      });
    }

    return {
      layers,
      colorUsage,
    };
  }

  /**
   * Generate slot occupancy visualization over time
   */
  static generateSlotOccupancyData(
    stats: GcodeStats,
    swaps: ManualSwap[],
    config: VisualizationConfig
  ): VisualizationData['slotOccupancy'] {
    this.logger.debug('Generating slot occupancy data');

    const maxSlots = 4; // AMS typically has 4 slots
    const slots: Array<{
      slotId: number;
      timeline: Array<{
        layer: number;
        colorId: string | null;
        action: 'loaded' | 'unloaded' | 'swapped';
        confidence: number;
      }>;
    }> = [];

    // Initialize slots
    for (let slotId = 1; slotId <= maxSlots; slotId++) {
      slots.push({
        slotId,
        timeline: [],
      });
    }

    // Simulate slot usage based on color assignments and swaps
    const slotAssignments = this.simulateSlotAssignments(stats, swaps);

    for (let layer = 0; layer < stats.totalLayers; layer++) {
      // const requiredColors = stats.layerColorMap.get(layer) || [];

      for (let slotId = 1; slotId <= maxSlots; slotId++) {
        const currentColor = slotAssignments.get(slotId)?.get(layer) || null;
        const prevColor = layer > 0 ? slotAssignments.get(slotId)?.get(layer - 1) || null : null;

        let action: 'loaded' | 'unloaded' | 'swapped' = 'loaded';
        let confidence = 90;

        if (currentColor !== prevColor) {
          action = currentColor ? 'swapped' : 'unloaded';
          confidence = 85; // Slightly lower confidence for changes
        }

        // Lower confidence if there are conflicts
        if (currentColor && this.hasConflictAtLayer(currentColor, layer, stats)) {
          confidence = Math.max(60, confidence - 20);
        }

        slots[slotId - 1].timeline.push({
          layer,
          colorId: currentColor,
          action,
          confidence,
        });
      }
    }

    return { slots };
  }

  /**
   * Generate conflict visualization data
   */
  static generateConflictVisualization(
    stats: GcodeStats,
    swaps: ManualSwap[],
    config: VisualizationConfig
  ): VisualizationData['conflictVisualization'] {
    this.logger.debug('Generating conflict visualization');

    const conflicts: Array<{
      layer: number;
      colors: string[];
      severity: 'low' | 'medium' | 'high';
      resolution: string;
    }> = [];

    // Analyze each layer for conflicts
    for (const [layer, layerColors] of stats.layerColorMap) {
      if (layerColors.length > 1) {
        // Multiple colors in same layer = potential conflict
        let severity: 'low' | 'medium' | 'high' = 'low';

        if (layerColors.length > 4) {
          severity = 'high'; // More colors than AMS slots
        } else if (layerColors.length > 2) {
          severity = 'medium';
        }

        // Find resolution for this conflict
        const relatedSwap = swaps.find(
          (swap) => swap.atLayer <= layer && swap.atLayer + 5 >= layer
        );

        const resolution = relatedSwap
          ? `Manual swap: ${relatedSwap.fromColor} → ${relatedSwap.toColor} at layer ${relatedSwap.atLayer}`
          : 'Automatic slot management';

        conflicts.push({
          layer,
          colors: [...layerColors],
          severity,
          resolution,
        });
      }
    }

    return { conflicts };
  }

  /**
   * Generate before/after comparison for swap impact
   */
  static generateSwapImpactPreview(
    stats: GcodeStats,
    swaps: ManualSwap[]
  ): VisualizationData['swapImpactPreview'] {
    this.logger.debug('Generating swap impact preview');

    // Calculate "before" metrics (current state)
    const before: SwapPlanMetrics = {
      totalSwaps: stats.toolChanges.length,
      efficiency: this.calculateEfficiency(stats, []),
      wastedMaterial: this.estimateWastedMaterial(stats, []),
      printTime: stats.estimatedPrintTime || 0,
      complexityScore: this.calculateComplexityScore(stats, []),
    };

    // Calculate "after" metrics (with optimizations)
    const after: SwapPlanMetrics = {
      totalSwaps: swaps.length,
      efficiency: this.calculateEfficiency(stats, swaps),
      wastedMaterial: this.estimateWastedMaterial(stats, swaps),
      printTime: (stats.estimatedPrintTime || 0) - this.estimateTimeSaved(swaps),
      complexityScore: this.calculateComplexityScore(stats, swaps),
    };

    // Generate improvement descriptions
    const improvements: string[] = [];

    if (after.totalSwaps < before.totalSwaps) {
      const reduction = before.totalSwaps - after.totalSwaps;
      improvements.push(`${reduction} fewer manual interventions`);
    }

    if (after.efficiency > before.efficiency) {
      const improvement = after.efficiency - before.efficiency;
      improvements.push(`${improvement.toFixed(1)}% efficiency improvement`);
    }

    if (after.wastedMaterial < before.wastedMaterial) {
      const savings = before.wastedMaterial - after.wastedMaterial;
      improvements.push(`${savings.toFixed(1)}mm³ material savings`);
    }

    if (after.printTime < before.printTime) {
      const timeSaved = before.printTime - after.printTime;
      improvements.push(`${Math.round(timeSaved / 60)} minutes time savings`);
    }

    return {
      before,
      after,
      improvements,
    };
  }

  /**
   * Calculate trust metrics for the visualization
   */
  static calculateTrustMetrics(
    stats: GcodeStats,
    swaps: ManualSwap[]
  ): VisualizationData['trustMetrics'] {
    this.logger.debug('Calculating trust metrics');

    // Data quality assessment
    const dataQuality = this.assessDataQuality(stats);

    // Algorithm reliability based on confidence in decisions
    const algorithmReliability = this.assessAlgorithmReliability(stats, swaps);

    // User control level - how much control user has over the process
    const userControlLevel = 85; // High user control with manual overrides

    // Overall confidence
    const overallConfidence = (dataQuality + algorithmReliability + userControlLevel) / 3;

    return {
      overallConfidence: Math.round(overallConfidence),
      dataQuality: Math.round(dataQuality),
      algorithmReliability: Math.round(algorithmReliability),
      userControlLevel,
    };
  }

  /**
   * Render visualization as HTML canvas or SVG
   */
  static renderColorUsageTimeline(
    canvasId: string,
    timelineData: VisualizationData['colorUsageTimeline'],
    config: VisualizationConfig
  ): void {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      this.logger.warn(`Canvas element ${canvasId} not found`);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 200;

    const { layers, colorUsage } = timelineData;
    const layerWidth = canvas.width / layers.length;
    const colorHeight = canvas.height / colorUsage.length;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw color usage bars
    colorUsage.forEach((usage, index) => {
      const y = index * colorHeight;
      const startX = usage.startLayer * layerWidth;
      const width = (usage.endLayer - usage.startLayer + 1) * layerWidth;

      // Get color
      const color = this.getColorForId(usage.colorId);

      // Draw main usage bar
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7 + usage.intensity * 0.3; // Intensity affects opacity
      ctx.fillRect(startX, y, width, colorHeight - 2);

      // Draw conflict indicators
      if (config.showConflicts && usage.conflicts.length > 0) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ff4444';
        usage.conflicts.forEach((conflictLayer) => {
          const conflictX = conflictLayer * layerWidth;
          ctx.fillRect(conflictX, y, layerWidth, 4);
        });
      }

      // Reset alpha
      ctx.globalAlpha = 1;
    });

    // Add interactivity if enabled
    if (config.enableInteractivity) {
      this.addTimelineInteractivity(canvas, timelineData, layerWidth, colorHeight);
    }
  }

  // Private helper methods

  private static simulateSlotAssignments(
    stats: GcodeStats,
    swaps: ManualSwap[]
  ): Map<number, Map<number, string | null>> {
    const slotAssignments = new Map<number, Map<number, string | null>>();

    // Initialize slots
    for (let slotId = 1; slotId <= 4; slotId++) {
      slotAssignments.set(slotId, new Map<number, string | null>());
    }

    // Simple simulation - assign colors to slots based on frequency
    // const sortedColors = [...stats.colors].sort((a, b) => b.usagePercentage - a.usagePercentage);

    for (let layer = 0; layer < stats.totalLayers; layer++) {
      const requiredColors = stats.layerColorMap.get(layer) || [];

      // Assign required colors to slots (simplified logic)
      requiredColors.forEach((colorId, index) => {
        const slotId = (index % 4) + 1;
        slotAssignments.get(slotId)?.set(layer, colorId);
      });
    }

    return slotAssignments;
  }

  private static hasConflictAtLayer(colorId: string, layer: number, stats: GcodeStats): boolean {
    const layerColors = stats.layerColorMap.get(layer) || [];
    return layerColors.length > 1 && layerColors.includes(colorId);
  }

  private static calculateEfficiency(stats: GcodeStats, swaps: ManualSwap[]): number {
    const totalColors = stats.colors.length;
    const availableSlots = 4;
    const manualInterventions = swaps.length;

    // Simple efficiency calculation
    const baseEfficiency = Math.max(0, 100 - (totalColors - availableSlots) * 10);
    const interventionPenalty = manualInterventions * 5;

    return Math.max(0, baseEfficiency - interventionPenalty);
  }

  private static estimateWastedMaterial(stats: GcodeStats, swaps: ManualSwap[]): number {
    // Estimate based on purge tower and swap waste
    const baseWaste = stats.toolChanges.length * 0.5; // 0.5mm³ per tool change
    const swapWaste = swaps.length * 1.2; // Additional waste per manual swap

    return baseWaste + swapWaste;
  }

  private static estimateTimeSaved(swaps: ManualSwap[]): number {
    // Estimate time saved through optimization (in seconds)
    return swaps.length * 45; // Assume 45 seconds saved per optimized swap
  }

  private static calculateComplexityScore(stats: GcodeStats, swaps: ManualSwap[]): number {
    const colorComplexity = stats.colors.length * 10;
    const swapComplexity = swaps.length * 15;
    const layerComplexity = stats.totalLayers * 0.1;

    return Math.min(100, colorComplexity + swapComplexity + layerComplexity);
  }

  private static assessDataQuality(stats: GcodeStats): number {
    let quality = 100;

    // Penalize missing data
    if (!stats.layerColorMap || stats.layerColorMap.size === 0) quality -= 30;
    if (!stats.colors || stats.colors.length === 0) quality -= 40;
    if (!stats.toolChanges) quality -= 20;
    if (stats.parserWarnings.length > 0) quality -= stats.parserWarnings.length * 5;

    return Math.max(0, quality);
  }

  private static assessAlgorithmReliability(stats: GcodeStats, swaps: ManualSwap[]): number {
    let reliability = 90; // Base reliability

    // Factor in complexity
    const complexity = stats.colors.length + swaps.length;
    if (complexity > 10) reliability -= 10;
    if (complexity > 20) reliability -= 15;

    // Factor in data consistency
    const hasInconsistencies = stats.parserWarnings.some(
      (warning) => warning.includes('inconsistent') || warning.includes('missing')
    );
    if (hasInconsistencies) reliability -= 20;

    return Math.max(50, reliability);
  }

  private static getColorForId(colorId: string): string {
    // Extract color from ID or return a default
    if (colorId.startsWith('#')) return colorId;

    // Generate a color based on ID hash
    let hash = 0;
    for (let i = 0; i < colorId.length; i++) {
      hash = colorId.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = hash % 360;
    return `hsl(${hue}, 70%, 60%)`;
  }

  private static addTimelineInteractivity(
    canvas: HTMLCanvasElement,
    timelineData: VisualizationData['colorUsageTimeline'],
    layerWidth: number,
    colorHeight: number
  ): void {
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const layer = Math.floor(x / layerWidth);
      const colorIndex = Math.floor(y / colorHeight);

      if (colorIndex < timelineData.colorUsage.length) {
        const usage = timelineData.colorUsage[colorIndex];
        if (layer >= usage.startLayer && layer <= usage.endLayer) {
          canvas.title = `${usage.colorId} at layer ${layer} (intensity: ${usage.intensity})`;
        }
      }
    });

    canvas.addEventListener('click', (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const layer = Math.floor(x / layerWidth);

      // Emit custom event for layer click
      const layerClickEvent = new CustomEvent('layerClick', {
        detail: { layer, timelineData },
      });
      canvas.dispatchEvent(layerClickEvent);
    });
  }
}
