import {
  AMSRecommendations,
  AMSRecommendationService,
} from '../../services/AMSRecommendationService';
import {
  ColorSubstitutionAnalyzer,
  SubstitutionAnalysis,
} from '../../analytics/algorithms/ColorSubstitutionAnalyzer';
import {
  SwapPlanVisualizer,
  VisualizationData,
} from '../../analytics/visualizations/SwapPlanVisualizer';
import {
  FlexibleTimingAnalyzer,
  TimingAnalysis,
} from '../../analytics/algorithms/FlexibleTimingAnalyzer';
import { Logger } from '../../utils/logger';

/**
 * Component for displaying AMS optimization recommendations
 */
export class AMSOptimizationView {
  private logger: Logger;
  private recommendations: AMSRecommendations | null = null;
  private substitutionAnalysis: SubstitutionAnalysis | null = null;
  private visualizationData: VisualizationData | null = null;
  private timingAnalysis: Map<string, TimingAnalysis> | null = null;
  private stats: any = null; // Store stats for enhanced features

  constructor() {
    this.logger = new Logger('AMSOptimizationView');
  }

  /**
   * Initialize the component
   */
  initialize(): void {
    this.logger.debug('AMSOptimizationView initialized');
  }

  /**
   * Update the view with new AMS recommendations and enhanced analytics
   */
  updateRecommendations(recommendations: AMSRecommendations, stats?: any): void {
    this.recommendations = recommendations;
    if (stats) {
      this.stats = stats;
      this.generateEnhancedAnalytics();
    }
    this.render();
  }

  /**
   * Generate enhanced analytics for the new features
   */
  private generateEnhancedAnalytics(): void {
    if (!this.stats) return;

    try {
      // Generate color substitution analysis
      this.substitutionAnalysis = ColorSubstitutionAnalyzer.analyzeSubstitutionOpportunities(
        this.stats,
        {
          maxVisualDistance: 25,
          prioritizeSwapReduction: true,
          considerPrintQuality: true,
          allowPartialSubstitution: false,
        }
      );

      // Generate visualization data
      this.visualizationData = SwapPlanVisualizer.generateVisualizationData(
        this.stats,
        this.stats.optimization?.manualSwaps || [],
        {
          showConflicts: true,
          highlightImprovements: true,
          enableInteractivity: true,
          colorScheme: 'vibrant',
          animationSpeed: 'normal',
        }
      );

      // Generate timing analysis if manual swaps exist
      if (this.stats.optimization?.manualSwaps?.length > 0) {
        this.timingAnalysis = FlexibleTimingAnalyzer.analyzeSwapTiming(
          this.stats,
          this.stats.optimization.manualSwaps,
          {
            bufferLayers: 2,
            allowEarlySwaps: true,
            allowLateSwaps: true,
            prioritizeFlexibility: false,
          }
        );
      }

      this.logger.info('Enhanced analytics generated successfully');
    } catch (error) {
      this.logger.error('Failed to generate enhanced analytics', error);
    }
  }

  /**
   * Render the AMS optimization section
   */
  private render(): void {
    const container = document.getElementById('amsOptimizationSection');
    if (!container || !this.recommendations) {
      this.logger.warn('Cannot render AMS optimization: container or recommendations missing');
      return;
    }

    container.innerHTML = this.generateHTML();
    this.attachEventListeners();
  }

  /**
   * Generate the complete HTML for AMS optimization section
   */
  private generateHTML(): string {
    if (!this.recommendations) return '';

    return `
      <div class="space-y-6">
        ${this.generateSummarySection()}
        ${this.generateColorSubstitutionSection()}
        ${this.generateTrustVisualizationSection()}
        ${this.generateSlotAssignmentSection()}
        ${this.generateFlexibleTimingSection()}
        ${this.generateStrategySection()}
        ${this.generateConflictsSection()}
        ${this.generateActionsSection()}
      </div>
    `;
  }

  /**
   * Generate summary section with key metrics
   */
  private generateSummarySection(): string {
    const { summary, potentialSavings } = this.recommendations!;
    const efficiencyStatus = AMSRecommendationService.getEfficiencyStatus(
      summary.overallEfficiency
    );

    return `
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="glass rounded-lg p-4 text-center">
          <div class="text-2xl font-bold ${efficiencyStatus.color}">${summary.overallEfficiency.toFixed(1)}%</div>
          <div class="text-sm text-white/60 mt-1">Overall Efficiency</div>
          <div class="text-xs ${efficiencyStatus.color} mt-1">${efficiencyStatus.message}</div>
        </div>
        
        <div class="glass rounded-lg p-4 text-center">
          <div class="text-2xl font-bold ${summary.totalConflicts > 5 ? 'text-vibrant-red' : summary.totalConflicts > 2 ? 'text-vibrant-orange' : 'text-vibrant-green'}">${summary.totalConflicts}</div>
          <div class="text-sm text-white/60 mt-1">Color Conflicts</div>
          <div class="text-xs text-white/50 mt-1">${summary.totalConflicts === 0 ? 'No issues' : 'Needs attention'}</div>
        </div>
        
        <div class="glass rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-vibrant-cyan">${potentialSavings.totalMaterialSaving.toFixed(1)}mm³</div>
          <div class="text-sm text-white/60 mt-1">Material Savings</div>
          <div class="text-xs text-white/50 mt-1">Potential reduction</div>
        </div>
        
        <div class="glass rounded-lg p-4 text-center">
          <div class="text-2xl font-bold text-vibrant-purple">${Math.round(potentialSavings.totalTimeSaving)}s</div>
          <div class="text-sm text-white/60 mt-1">Time Savings</div>
          <div class="text-xs text-white/50 mt-1">Print time reduction</div>
        </div>
      </div>
    `;
  }

  /**
   * Generate slot assignment visualization
   */
  private generateSlotAssignmentSection(): string {
    const { slotAssignments } = this.recommendations!;

    const slotsHTML = slotAssignments
      .map(
        (slot) => `
      <div class="glass rounded-lg p-4 text-center">
        <div class="text-lg font-semibold text-white mb-2">Slot ${slot.slot}</div>
        <div class="space-y-2">
          ${slot.colors
            .map(
              (color) => `
            <div class="bg-white/10 rounded px-2 py-1 text-sm font-medium">
              ${color}
            </div>
          `
            )
            .join('')}
        </div>
        <div class="mt-3 space-y-1">
          <div class="text-sm text-vibrant-cyan">${slot.utilization.toFixed(0)}% utilized</div>
          <div class="text-sm ${slot.conflicts > 0 ? 'text-vibrant-red' : 'text-vibrant-green'}">
            ${slot.conflicts} conflicts
          </div>
          <div class="text-sm text-vibrant-purple">${slot.efficiency.toFixed(0)}% efficient</div>
        </div>
        ${
          slot.reasoning.length > 0
            ? `
          <div class="mt-2 text-xs text-white/60">
            ${slot.reasoning[0]}
          </div>
        `
            : ''
        }
      </div>
    `
      )
      .join('');

    return `
      <div>
        <h4 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span class="text-2xl">🎰</span> Optimized Slot Assignments
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          ${slotsHTML}
        </div>
      </div>
    `;
  }

  /**
   * Generate printing strategy section
   */
  private generateStrategySection(): string {
    const { currentStrategy, recommendedStrategies } = this.recommendations!;

    const recommendedHTML = recommendedStrategies
      .slice(0, 3)
      .map(
        (strategy) => `
      <div class="glass rounded-lg p-4">
        <div class="flex justify-between items-start mb-2">
          <h5 class="font-semibold text-white">${strategy.name}</h5>
          <span class="text-xs px-2 py-1 rounded-full ${
            strategy.complexity === 'low'
              ? 'bg-green-500/20 text-green-400'
              : strategy.complexity === 'medium'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-red-500/20 text-red-400'
          }">
            ${strategy.complexity} complexity
          </span>
        </div>
        <p class="text-sm text-white/70 mb-3">${strategy.description}</p>
        <div class="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span class="text-white/60">Improvement:</span>
            <span class="text-vibrant-green font-semibold"> +${strategy.estimatedImprovement}%</span>
          </div>
          <div>
            <span class="text-white/60">Feasibility:</span>
            <span class="text-vibrant-cyan font-semibold"> ${strategy.feasibility}%</span>
          </div>
          <div>
            <span class="text-white/60">Material:</span>
            <span class="text-vibrant-purple font-semibold"> ${strategy.estimatedSavings.material.toFixed(1)}mm³</span>
          </div>
          <div>
            <span class="text-white/60">Time:</span>
            <span class="text-vibrant-orange font-semibold"> ${strategy.estimatedSavings.time}s</span>
          </div>
        </div>
      </div>
    `
      )
      .join('');

    return `
      <div>
        <h4 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span class="text-2xl">📋</span> Printing Strategy Analysis
        </h4>
        
        <!-- Current Strategy -->
        <div class="glass rounded-lg p-4 mb-4">
          <h5 class="font-semibold text-white mb-2">Current Strategy</h5>
          <div class="flex items-center justify-between mb-2">
            <span class="text-white/80">${currentStrategy.type}</span>
            <span class="text-vibrant-cyan font-semibold">${currentStrategy.efficiency.toFixed(1)}% efficient</span>
          </div>
          ${
            currentStrategy.issues.length > 0
              ? `
            <div class="mt-2">
              <div class="text-sm text-white/60 mb-1">Issues:</div>
              <ul class="text-sm text-vibrant-orange space-y-1">
                ${currentStrategy.issues.map((issue) => `<li>• ${issue}</li>`).join('')}
              </ul>
            </div>
          `
              : ''
          }
        </div>

        <!-- Alternative Strategies -->
        ${
          recommendedStrategies.length > 0
            ? `
          <div>
            <h5 class="font-semibold text-white mb-3">Alternative Strategies</h5>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              ${recommendedHTML}
            </div>
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  /**
   * Generate conflicts section
   */
  private generateConflictsSection(): string {
    const { conflicts } = this.recommendations!;

    if (conflicts.length === 0) {
      return `
        <div>
          <h4 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span class="text-2xl">✅</span> Color Conflicts
          </h4>
          <div class="glass rounded-lg p-6 text-center">
            <div class="text-vibrant-green text-lg font-semibold mb-2">No conflicts detected!</div>
            <p class="text-white/60">Your color usage is well optimized.</p>
          </div>
        </div>
      `;
    }

    const conflictsHTML = conflicts
      .slice(0, 5)
      .map((conflict) => {
        const style = AMSRecommendationService.getConflictSeverityStyle(conflict.severity);

        return `
        <div class="glass rounded-lg p-4 ${style.bgColor} border border-current/20">
          <div class="flex items-start justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="text-lg">${style.icon}</span>
              <span class="font-semibold ${style.color} capitalize">${conflict.severity} Priority</span>
            </div>
            <span class="text-xs px-2 py-1 rounded-full bg-white/10 text-white/70">
              ${conflict.affectedLayers.length} layers
            </span>
          </div>
          
          <p class="text-sm text-white mb-3">${conflict.description}</p>
          
          <div class="text-xs text-white/60 mb-2">
            <strong>Colors:</strong> ${conflict.colors.join(' ↔ ')}
          </div>
          
          <div class="text-xs text-white/60 mb-3">
            <strong>Layers:</strong> ${this.formatLayerRange(conflict.affectedLayers)}
          </div>
          
          <div class="text-sm text-white/80 bg-white/5 rounded p-2">
            <strong>💡 Recommendation:</strong> ${conflict.recommendation}
          </div>
        </div>
      `;
      })
      .join('');

    return `
      <div>
        <h4 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span class="text-2xl">⚠️</span> Color Conflicts (${conflicts.length})
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${conflictsHTML}
        </div>
        ${
          conflicts.length > 5
            ? `
          <div class="text-center mt-4">
            <button id="showAllConflictsBtn" class="btn-glass-sm">
              Show ${conflicts.length - 5} more conflicts
            </button>
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  /**
   * Generate color substitution suggestions section
   */
  private generateColorSubstitutionSection(): string {
    if (!this.substitutionAnalysis || this.substitutionAnalysis.substitutions.length === 0) {
      return `
        <div>
          <h4 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span class="text-2xl">🎨</span> Color Substitution Suggestions
          </h4>
          <div class="glass rounded-lg p-6 text-center">
            <div class="text-vibrant-green text-lg font-semibold mb-2">No substitutions needed!</div>
            <p class="text-white/60">Your color choices are already well optimized.</p>
          </div>
        </div>
      `;
    }

    const { substitutions, overallImpact } = this.substitutionAnalysis;
    const topSubstitutions = substitutions.slice(0, 3);

    const substitutionsHTML = topSubstitutions
      .map(
        (sub) => `
      <div class="glass rounded-lg p-4 border border-vibrant-purple/20">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-4 h-4 rounded-full" style="background-color: ${this.getColorHex(sub.originalColor)}"></div>
            <span class="text-white font-medium">${sub.originalColor}</span>
            <svg class="w-4 h-4 text-vibrant-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
            </svg>
            <div class="w-4 h-4 rounded-full" style="background-color: ${this.getColorHex(sub.substituteColor)}"></div>
            <span class="text-white font-medium">${sub.substituteColor}</span>
          </div>
          <span class="text-xs px-2 py-1 rounded-full ${
            sub.recommendation.priority === 'high'
              ? 'bg-green-500/20 text-green-400'
              : sub.recommendation.priority === 'medium'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-blue-500/20 text-blue-400'
          }">
            ${sub.recommendation.priority} priority
          </span>
        </div>
        
        <div class="grid grid-cols-3 gap-3 mb-3 text-sm">
          <div class="text-center">
            <div class="text-vibrant-green font-bold">${sub.impact.swapsReduced}</div>
            <div class="text-white/60">Swaps Reduced</div>
          </div>
          <div class="text-center">
            <div class="text-vibrant-cyan font-bold">${sub.impact.percentageReduction.toFixed(1)}%</div>
            <div class="text-white/60">Improvement</div>
          </div>
          <div class="text-center">
            <div class="text-vibrant-orange font-bold">${sub.similarity.visualDistance}</div>
            <div class="text-white/60">Visual Diff</div>
          </div>
        </div>

        <div class="text-sm text-white/70 mb-2">
          <strong>Quality Impact:</strong> ${sub.impact.qualityImpact}
        </div>
        
        <div class="text-xs text-white/60 bg-white/5 rounded p-2">
          <strong>💡 Why this works:</strong> ${sub.recommendation.reasoning.join('. ')}
        </div>
      </div>
    `
      )
      .join('');

    return `
      <div>
        <h4 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span class="text-2xl">🎨</span> Color Substitution Suggestions
        </h4>
        
        <div class="glass rounded-lg p-4 mb-4 border border-vibrant-purple/30">
          <div class="grid grid-cols-4 gap-4 text-center">
            <div>
              <div class="text-2xl font-bold text-vibrant-green">${overallImpact.totalSwapsReduced}</div>
              <div class="text-sm text-white/60">Total Swaps Saved</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-vibrant-cyan">${overallImpact.percentageImprovement.toFixed(1)}%</div>
              <div class="text-sm text-white/60">Overall Improvement</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-vibrant-purple">${overallImpact.feasibilityScore.toFixed(0)}</div>
              <div class="text-sm text-white/60">Feasibility Score</div>
            </div>
            <div>
              <div class="text-2xl font-bold ${overallImpact.qualityRisk === 'low' ? 'text-vibrant-green' : overallImpact.qualityRisk === 'medium' ? 'text-vibrant-orange' : 'text-vibrant-red'}">${overallImpact.qualityRisk.toUpperCase()}</div>
              <div class="text-sm text-white/60">Quality Risk</div>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          ${substitutionsHTML}
        </div>
      </div>
    `;
  }

  /**
   * Generate trust-building visualization section
   */
  private generateTrustVisualizationSection(): string {
    if (!this.visualizationData) {
      return `
        <div>
          <h4 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span class="text-2xl">📊</span> Swap Plan Visualization
          </h4>
          <div class="glass rounded-lg p-6 text-center">
            <p class="text-white/60">Visualization data not available</p>
          </div>
        </div>
      `;
    }

    const { trustMetrics, swapImpactPreview } = this.visualizationData;

    return `
      <div>
        <h4 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span class="text-2xl">📊</span> Swap Plan Visualization & Trust Metrics
        </h4>
        
        <!-- Trust Score Dashboard -->
        <div class="glass rounded-lg p-4 mb-4">
          <h5 class="font-semibold text-white mb-3">Plan Confidence</h5>
          <div class="grid grid-cols-4 gap-4">
            <div class="text-center">
              <div class="text-2xl font-bold ${trustMetrics.overallConfidence >= 80 ? 'text-vibrant-green' : trustMetrics.overallConfidence >= 60 ? 'text-vibrant-orange' : 'text-vibrant-red'}">${trustMetrics.overallConfidence}%</div>
              <div class="text-sm text-white/60">Overall Confidence</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-vibrant-cyan">${trustMetrics.dataQuality}%</div>
              <div class="text-sm text-white/60">Data Quality</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-vibrant-purple">${trustMetrics.algorithmReliability}%</div>
              <div class="text-sm text-white/60">Algorithm Reliability</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-vibrant-blue">${trustMetrics.userControlLevel}%</div>
              <div class="text-sm text-white/60">User Control</div>
            </div>
          </div>
        </div>

        <!-- Before/After Comparison -->
        <div class="glass rounded-lg p-4 mb-4">
          <h5 class="font-semibold text-white mb-3">Impact Preview</h5>
          <div class="grid grid-cols-2 gap-6">
            <div>
              <h6 class="text-vibrant-red font-medium mb-2">Before Optimization</h6>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-white/60">Manual Swaps:</span>
                  <span class="text-white">${swapImpactPreview.before.totalSwaps}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-white/60">Efficiency:</span>
                  <span class="text-white">${swapImpactPreview.before.efficiency.toFixed(1)}%</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-white/60">Complexity:</span>
                  <span class="text-white">${swapImpactPreview.before.complexityScore.toFixed(0)}</span>
                </div>
              </div>
            </div>
            <div>
              <h6 class="text-vibrant-green font-medium mb-2">After Optimization</h6>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-white/60">Manual Swaps:</span>
                  <span class="text-white">${swapImpactPreview.after.totalSwaps}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-white/60">Efficiency:</span>
                  <span class="text-white">${swapImpactPreview.after.efficiency.toFixed(1)}%</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-white/60">Complexity:</span>
                  <span class="text-white">${swapImpactPreview.after.complexityScore.toFixed(0)}</span>
                </div>
              </div>
            </div>
          </div>
          
          ${
            swapImpactPreview.improvements.length > 0
              ? `
            <div class="mt-4 pt-4 border-t border-white/20">
              <h6 class="text-vibrant-green font-medium mb-2">Key Improvements</h6>
              <ul class="text-sm text-white/80 space-y-1">
                ${swapImpactPreview.improvements
                  .map(
                    (improvement) =>
                      `<li class="flex items-center gap-2">
                    <span class="text-vibrant-green">✓</span>
                    ${improvement}
                  </li>`
                  )
                  .join('')}
              </ul>
            </div>
          `
              : ''
          }
        </div>

        <!-- Interactive Timeline -->
        <div class="glass rounded-lg p-4">
          <h5 class="font-semibold text-white mb-3">Color Usage Timeline</h5>
          <canvas id="swapPlanTimeline" class="w-full bg-black/30 rounded-lg" style="height: 120px;"></canvas>
          <p class="text-xs text-white/50 mt-2">Interactive timeline showing color usage patterns and conflict areas</p>
        </div>
      </div>
    `;
  }

  /**
   * Generate flexible timing options section
   */
  private generateFlexibleTimingSection(): string {
    if (!this.timingAnalysis || this.timingAnalysis.size === 0) {
      return `
        <div>
          <h4 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span class="text-2xl">⏰</span> Flexible Swap Timing
          </h4>
          <div class="glass rounded-lg p-6 text-center">
            <div class="text-vibrant-green text-lg font-semibold mb-2">No manual swaps required!</div>
            <p class="text-white/60">Your print can run automatically without intervention.</p>
          </div>
        </div>
      `;
    }

    const timingEntries = Array.from(this.timingAnalysis.entries()).slice(0, 4);

    const timingHTML = timingEntries
      .map(
        ([swapId, analysis]) => `
      <div class="glass rounded-lg p-4">
        <div class="flex items-center justify-between mb-3">
          <h6 class="font-semibold text-white">${swapId.replace('-', ' → ')}</h6>
          <span class="text-xs px-2 py-1 rounded-full bg-vibrant-blue/20 text-vibrant-blue">
            Layer ${analysis.recommendedLayer}
          </span>
        </div>

        <!-- Timing Range -->
        <div class="mb-4">
          <div class="flex justify-between text-sm text-white/70 mb-2">
            <span>Earliest: Layer ${analysis.timingOptions.earliest}</span>
            <span>Latest: Layer ${analysis.timingOptions.latest}</span>
          </div>
          <div class="relative h-6 bg-white/10 rounded-full overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-r from-vibrant-green/30 via-vibrant-blue/30 to-vibrant-red/30"></div>
            <div class="absolute top-1 bottom-1 bg-vibrant-blue rounded-full" 
                 style="left: ${((analysis.recommendedLayer - analysis.timingOptions.earliest) / Math.max(1, analysis.timingOptions.latest - analysis.timingOptions.earliest)) * 100}%; width: 8px;">
            </div>
          </div>
        </div>

        <!-- Confidence Metrics -->
        <div class="grid grid-cols-3 gap-3 mb-3 text-sm">
          <div class="text-center">
            <div class="text-vibrant-green font-bold">${analysis.confidence.timing}%</div>
            <div class="text-white/60">Timing</div>
          </div>
          <div class="text-center">
            <div class="text-vibrant-purple font-bold">${analysis.confidence.necessity}%</div>
            <div class="text-white/60">Necessity</div>
          </div>
          <div class="text-center">
            <div class="text-vibrant-cyan font-bold">${analysis.confidence.userControl}%</div>
            <div class="text-white/60">Control</div>
          </div>
        </div>

        <!-- Flexibility Score -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-white/70">Flexibility:</span>
          <div class="flex items-center gap-2">
            <div class="w-16 h-2 bg-white/20 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-vibrant-red to-vibrant-green rounded-full" 
                   style="width: ${analysis.swapWindow.flexibilityScore}%"></div>
            </div>
            <span class="text-sm font-medium ${analysis.swapWindow.flexibilityScore >= 70 ? 'text-vibrant-green' : analysis.swapWindow.flexibilityScore >= 40 ? 'text-vibrant-orange' : 'text-vibrant-red'}">
              ${analysis.swapWindow.flexibilityScore}%
            </span>
          </div>
        </div>

        <!-- Alternative Timing Options -->
        ${
          analysis.alternatives.length > 0
            ? `
          <div class="mt-3 pt-3 border-t border-white/20">
            <div class="text-xs text-white/60 mb-2">Alternative Timing:</div>
            <div class="flex gap-2 flex-wrap">
              ${analysis.alternatives
                .slice(0, 3)
                .map(
                  (alt) => `
                <button class="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors text-white/80 timing-alt-btn" 
                        data-layer="${alt.layer}" data-swap-id="${swapId}">
                  Layer ${alt.layer} (${alt.score}%)
                </button>
              `
                )
                .join('')}
            </div>
          </div>
        `
            : ''
        }
      </div>
    `
      )
      .join('');

    return `
      <div>
        <h4 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span class="text-2xl">⏰</span> Flexible Swap Timing
        </h4>
        <div class="space-y-4">
          ${timingHTML}
        </div>
        <div class="text-xs text-white/50 mt-4 text-center">
          💡 Click alternative timing options to explore different swap schedules
        </div>
      </div>
    `;
  }

  /**
   * Generate recommended actions section
   */
  private generateActionsSection(): string {
    const { summary } = this.recommendations!;

    const actionsHTML = summary.recommendedActions
      .map(
        (action, index) => `
      <div class="flex items-center gap-3 p-3 glass rounded-lg">
        <div class="w-8 h-8 rounded-full bg-vibrant-blue flex items-center justify-center text-white font-bold text-sm">
          ${index + 1}
        </div>
        <div class="flex-1">
          <p class="text-white font-medium">${action}</p>
        </div>
        <button class="btn-glass-sm text-xs" data-action="${index}">
          Learn More
        </button>
      </div>
    `
      )
      .join('');

    const difficultyColor =
      summary.implementationDifficulty === 'easy'
        ? 'text-vibrant-green'
        : summary.implementationDifficulty === 'moderate'
          ? 'text-vibrant-orange'
          : 'text-vibrant-red';

    return `
      <div>
        <h4 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span class="text-2xl">🎯</span> Recommended Actions
        </h4>
        
        <div class="glass rounded-lg p-4 mb-4">
          <div class="flex items-center justify-between mb-3">
            <span class="text-white font-medium">Implementation Difficulty</span>
            <span class="${difficultyColor} font-semibold capitalize">
              ${summary.implementationDifficulty}
            </span>
          </div>
          <p class="text-sm text-white/60">
            ${
              summary.implementationDifficulty === 'easy'
                ? 'These optimizations can be implemented quickly with minimal changes.'
                : summary.implementationDifficulty === 'moderate'
                  ? 'Some planning required, but improvements will provide good value.'
                  : 'Complex optimizations that may require significant changes to your print setup.'
            }
          </p>
        </div>

        <div class="space-y-3">
          ${actionsHTML}
        </div>
      </div>
    `;
  }

  /**
   * Format layer range for display
   */
  private formatLayerRange(layers: number[]): string {
    if (layers.length === 0) return 'None';
    if (layers.length === 1) return `Layer ${layers[0]}`;

    const sorted = [...layers].sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = end = sorted[i];
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);

    if (ranges.length > 3) {
      return `${ranges.slice(0, 2).join(', ')}, +${ranges.length - 2} more`;
    }

    return ranges.join(', ');
  }

  /**
   * Get color hex value from color ID
   */
  private getColorHex(colorId: string): string {
    if (!this.stats || !this.stats.colors) return '#888888';

    const color = this.stats.colors.find((c: any) => c.id === colorId);
    return color?.hexValue || colorId.startsWith('#') ? colorId : '#888888';
  }

  /**
   * Render interactive visualizations after DOM update
   */
  private renderInteractiveElements(): void {
    // Render color usage timeline if visualization data exists
    if (this.visualizationData) {
      setTimeout(() => {
        try {
          SwapPlanVisualizer.renderColorUsageTimeline(
            'swapPlanTimeline',
            this.visualizationData!.colorUsageTimeline,
            {
              showConflicts: true,
              highlightImprovements: true,
              enableInteractivity: true,
              colorScheme: 'vibrant',
              animationSpeed: 'normal',
            }
          );
        } catch (error) {
          this.logger.warn('Failed to render timeline visualization', error);
        }
      }, 100);
    }
  }

  /**
   * Attach event listeners for interactive elements
   */
  private attachEventListeners(): void {
    // Show all conflicts button
    const showAllBtn = document.getElementById('showAllConflictsBtn');
    if (showAllBtn && this.recommendations) {
      showAllBtn.addEventListener('click', () => {
        this.showAllConflicts();
      });
    }

    // Action buttons
    const actionButtons = document.querySelectorAll('[data-action]');
    actionButtons.forEach((button) => {
      button.addEventListener('click', (e) => {
        const actionIndex = parseInt((e.target as HTMLElement).getAttribute('data-action') || '0');
        this.showActionDetails(actionIndex);
      });
    });

    // Timing alternative buttons
    const timingAltButtons = document.querySelectorAll('.timing-alt-btn');
    timingAltButtons.forEach((button) => {
      button.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const layer = parseInt(target.getAttribute('data-layer') || '0');
        const swapId = target.getAttribute('data-swap-id') || '';
        this.selectAlternativeTiming(swapId, layer);
      });
    });

    // Render interactive visualizations
    this.renderInteractiveElements();
  }

  /**
   * Show all conflicts in expanded view
   */
  private showAllConflicts(): void {
    if (!this.recommendations) return;

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-gray-900 rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-y-auto">
        <h3 class="text-xl font-semibold text-white mb-4">All Color Conflicts</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          ${this.recommendations.conflicts
            .map((conflict) => {
              const style = AMSRecommendationService.getConflictSeverityStyle(conflict.severity);
              return `
              <div class="glass rounded-lg p-4 ${style.bgColor}">
                <div class="flex items-center gap-2 mb-2">
                  <span>${style.icon}</span>
                  <span class="${style.color} font-semibold">${conflict.severity}</span>
                </div>
                <p class="text-sm text-white mb-2">${conflict.description}</p>
                <p class="text-xs text-white/60">${conflict.recommendation}</p>
              </div>
            `;
            })
            .join('')}
        </div>
        <button class="btn-gradient" id="closeConflictsModal">Close</button>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = document.getElementById('closeConflictsModal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
      });
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  /**
   * Handle selection of alternative timing
   */
  private selectAlternativeTiming(swapId: string, layer: number): void {
    if (!this.timingAnalysis) return;

    const analysis = this.timingAnalysis.get(swapId);
    if (!analysis) return;

    // Update the recommended layer
    analysis.recommendedLayer = layer;

    // Update confidence based on the alternative
    const alternative = analysis.alternatives.find((alt) => alt.layer === layer);
    if (alternative) {
      analysis.confidence.timing = Math.max(60, alternative.score);
    }

    // Show feedback to user
    this.showTimingUpdateFeedback(swapId, layer, alternative);

    // Re-render the section to show updated timing
    this.render();
  }

  /**
   * Show feedback when timing is updated
   */
  private showTimingUpdateFeedback(swapId: string, layer: number, alternative: any): void {
    const feedback = document.createElement('div');
    feedback.className =
      'fixed top-4 right-4 bg-vibrant-blue/90 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-scale-in';
    feedback.innerHTML = `
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>Updated timing for ${swapId.replace('-', ' → ')} to layer ${layer}</span>
      </div>
      ${alternative ? `<div class="text-xs mt-1 opacity-80">Score: ${alternative.score}% | ${alternative.tradeoffs.join(', ')}</div>` : ''}
    `;

    document.body.appendChild(feedback);

    setTimeout(() => {
      feedback.style.opacity = '0';
      feedback.style.transform = 'translateY(-20px)';
      setTimeout(() => feedback.remove(), 300);
    }, 3000);
  }

  /**
   * Show detailed information for a specific action
   */
  private showActionDetails(actionIndex: number): void {
    if (
      !this.recommendations ||
      actionIndex >= this.recommendations.summary.recommendedActions.length
    )
      return;

    const action = this.recommendations.summary.recommendedActions[actionIndex];

    // Enhanced modal with more details
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    modal.innerHTML = `
      <div class="bg-gray-900 rounded-lg p-6 max-w-md max-h-[80vh] overflow-y-auto">
        <h3 class="text-xl font-semibold text-white mb-4">Action Details</h3>
        <div class="space-y-4">
          <div>
            <h4 class="font-medium text-white mb-2">Recommended Action</h4>
            <p class="text-white/80">${action}</p>
          </div>
          
          ${
            this.substitutionAnalysis
              ? `
            <div>
              <h4 class="font-medium text-white mb-2">Related Optimizations</h4>
              <ul class="text-sm text-white/70 space-y-1">
                ${this.substitutionAnalysis.recommendations.implementationGuide
                  .slice(0, 3)
                  .map((guide) => `<li>• ${guide}</li>`)
                  .join('')}
              </ul>
            </div>
          `
              : ''
          }
          
          <div>
            <h4 class="font-medium text-white mb-2">Implementation Tips</h4>
            <ul class="text-sm text-white/70 space-y-1">
              <li>• Test changes with a small sample first</li>
              <li>• Monitor print quality during implementation</li>
              <li>• Adjust settings based on results</li>
              <li>• Document successful configurations</li>
            </ul>
          </div>
        </div>
        <button class="btn-gradient mt-6 w-full" id="closeActionModal">Close</button>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = document.getElementById('closeActionModal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
      });
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  /**
   * Clean up the component
   */
  destroy(): void {
    this.recommendations = null;
    this.logger.debug('AMSOptimizationView destroyed');
  }
}
