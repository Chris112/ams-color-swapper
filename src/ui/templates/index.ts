import { GcodeStats, FilamentUsage } from '../../types/gcode';
import { OptimizationResult, ManualSwap } from '../../types/optimization';
import {
  ConstraintValidationResult,
  ConstraintViolationRange,
  ColorConsolidationSuggestion,
} from '../../types/constraints';
import { Color } from '../../domain/models/Color';
import { formatColorDisplay } from '../../utils/colorNames';
import { formatDisplayRange, formatDisplayLayer } from '../../utils/layerHelpers';

// File statistics template
export const fileStatsTemplate = (stats: GcodeStats): string => {
  // Calculate total weight from filament estimates
  const totalWeight =
    stats.filamentEstimates?.reduce((sum, est) => sum + (est.weight || 0), 0) || 0;

  // Calculate color changes
  const colorChanges = stats.colors.reduce(
    (sum, c) => sum + (c.layerCount || c.lastLayer - c.firstLayer + 1),
    0
  );

  const items = [
    { label: 'Colors Used', value: stats.colors.length.toString() },
    { label: 'Total Filament', value: totalWeight > 0 ? `${totalWeight.toFixed(1)}g` : 'N/A' },
    { label: 'Print Time', value: stats.printTime || 'N/A' },
    {
      label: 'Print Cost (USD)',
      value: stats.printCost ? `$${stats.printCost.toFixed(2)}` : 'N/A',
    },
    { label: 'Total Layers', value: stats.totalLayers.toString() },
    { label: 'Tool Changes', value: stats.toolChanges.length.toString() },
    { label: 'Color Changes', value: colorChanges.toString() },
  ];

  // Add deduplication notification if colors were merged
  const deduplicationNotification = stats.deduplicationInfo
    ? `
    <div class="col-span-full glass rounded-2xl p-6 bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 animate-scale-in">
      <div class="flex items-center gap-4">
        <div class="text-4xl">🎯</div>
        <div class="flex-1">
          <div class="text-lg font-semibold text-green-400">Color Deduplication Applied</div>
          <div class="text-sm text-white/80 mt-1">
            Merged ${stats.deduplicationInfo.duplicatesFound.length} duplicate color${stats.deduplicationInfo.duplicatesFound.length > 1 ? 's' : ''}, 
            freeing ${stats.deduplicationInfo.freedSlots.length} slot${stats.deduplicationInfo.freedSlots.length > 1 ? 's' : ''} for manual swaps
          </div>
          <div class="text-xs text-white/60 mt-2">
            ${stats.deduplicationInfo.duplicatesFound
              .map(
                (dup) => `${dup.originalTools.join(', ')} → ${dup.assignedTo} (${dup.colorName})`
              )
              .join(' • ')}
          </div>
        </div>
      </div>
    </div>
  `
    : '';

  return `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4 animate-scale-in">
    ${deduplicationNotification}
    ${items
      .map(
        (item, index) => `
      <div class="glass rounded-2xl p-6 hover:scale-105 transition-transform group animate-fade-in" style="animation-delay: ${index * 0.05}s">
        <div class="text-3xl font-bold gradient-text mb-2 group-hover:animate-pulse">${item.value}</div>
        <div class="text-sm text-white/60 uppercase tracking-wider">${item.label}</div>
      </div>
    `
      )
      .join('')}
  </div>`;
};

// Color statistics template
export const colorStatsTemplate = (
  colors: Color[],
  filamentEstimates?: FilamentUsage[]
): string => {
  return `
    <div class="space-y-8">
      <!-- Interactive Layer Timeline -->
      <div class="bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/10">
        <div class="flex items-center justify-between mb-6">
          <h4 class="text-xl font-bold text-white flex items-center gap-3">
            <svg class="w-6 h-6 text-vibrant-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
            Layer Timeline Visualization
          </h4>
          <div id="timelineViewToggle" class="timeline-view-button-group">
            <button id="colorViewBtn" class="timeline-view-btn timeline-view-btn-active" data-view="color">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a6 6 0 00-12 0v4a2 2 0 002 2z"></path>
              </svg>
              <span>Color View</span>
            </button>
            <button id="slotViewBtn" class="timeline-view-btn" data-view="slot">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 011-1h12a1 1 0 011 1v2M7 7h10"></path>
              </svg>
              <span>Slot View</span>
            </button>
          </div>
        </div>
        <div class="relative mb-4">
          <canvas id="colorTimeline" class="w-full bg-black/30 rounded-2xl shadow-inner transition-all duration-300"></canvas>
          <div id="timelineOverlay" class="absolute inset-0 rounded-2xl overflow-hidden cursor-pointer">
            <!-- Interactive segments will be added here -->
          </div>
        </div>
      </div>

      <!-- Enhanced Color Cards -->
      <div>
        <div class="flex items-center justify-between mb-6">
          <h4 class="text-xl font-bold text-white">Color Details & Usage</h4>
          <div class="flex items-center gap-3">
            <button id="openTimelineBtn" class="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-colors flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              Timeline
            </button>
            <button id="openMergePanelBtn" class="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-medium hover:from-purple-600 hover:to-purple-700 transition-colors flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z"></path>
              </svg>
              Merge Colors
            </button>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${colors
          .map((color, index) => {
            // Find the filament estimate for this color
            const filamentEstimate = filamentEstimates?.find((est) => est.colorId === color.id);
            const weight = filamentEstimate?.weight || 0;

            return `
          <div class="color-card bg-white/5 backdrop-blur-sm rounded-2xl p-4 hover:bg-white/8 transition-all duration-300 group animate-scale-in border border-white/10 hover:border-white/15" 
               style="animation-delay: ${index * 0.05}s" 
               data-color-id="${color.id}">
            <div class="flex items-center gap-3 mb-3">
              <div class="relative">
                <div class="w-12 h-12 rounded-xl shadow-lg interactive-swatch ring-2 ring-white/20" 
                     style="background-color: ${color.hexValue || '#888888'}"
                     data-hex="${color.hexValue || '#888888'}"
                     title="Click to copy color code">
                  <div class="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                  </div>
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <h5 class="font-semibold text-white text-base group-hover:text-vibrant-cyan transition-colors truncate">${formatColorDisplay(color.hexValue, color.name || color.id)}</h5>
                <p class="text-xs text-white/60 font-mono">${color.hexValue || '#888888'}</p>
              </div>
            </div>
            
            <div class="space-y-2">
              <div class="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span class="text-white/70 block">Layers</span>
                  <span class="text-white font-semibold">${formatDisplayRange(color.firstLayer, color.lastLayer)}</span>
                </div>
                <div>
                  <span class="text-white/70 block">Usage</span>
                  <span class="text-white font-semibold">${weight > 0 ? `${weight.toFixed(1)}g` : 'N/A'}</span>
                </div>
              </div>
              
              <div class="flex items-center gap-2">
                <div class="progress-bar flex-1">
                  <div class="progress-bar-fill" style="width: ${Math.min(100, Math.max(0, color.usagePercentage || 0))}%"></div>
                </div>
                <span class="text-xs text-white/60 font-mono min-w-fit">${(color.usagePercentage || 0).toFixed(1)}%</span>
              </div>
            </div>
          </div>`;
          })
          .join('')}
        </div>
      </div>
    </div>
  `;
};

// Optimization template
export const optimizationTemplate = (
  optimization: OptimizationResult,
  stats?: GcodeStats
): string => {
  // Determine terminology based on configuration
  const isAmsMode = optimization.configuration?.type === 'ams' && (optimization.configuration?.unitCount || 0) > 0;
  const assignmentTitle = isAmsMode ? 'AMS Slot Assignments' : 'Toolhead Assignments';
  
  return `

    <div class="glass rounded-3xl p-8 animate-fade-in" style="animation-delay: 0.4s">
      <h4 class="text-xl font-bold text-white mb-6">${assignmentTitle}</h4>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        ${optimization.slotAssignments
          .map((assignment, index) => {
            const colors = assignment.colors || [];
            return `
          <div class="bg-white/5 backdrop-blur-sm rounded-xl p-4 hover:bg-white/10 transition-all animate-scale-in" style="animation-delay: ${0.5 + index * 0.1}s">
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm font-medium text-white/80">Unit ${assignment.unit}</span>
              <span class="text-xs px-2 py-1 bg-vibrant-purple/20 text-vibrant-purple rounded-full">Slot ${assignment.slot}</span>
            </div>
            
            <div class="space-y-2">
              ${
                colors.length > 0
                  ? colors
                      .map((colorId) => {
                        // Find the actual color object from stats
                        const colorObj = stats?.colors.find((c) => c.id === colorId);
                        const hexValue = colorObj?.hexValue || colorId;
                        const colorName = colorObj?.name || colorObj?.id || colorId;

                        return `
                <div class="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                  <div class="w-4 h-4 rounded-full ring-1 ring-white/20 shadow-sm" style="background-color: ${hexValue}"></div>
                  <span class="text-xs text-white/90 flex-1 truncate">${formatColorDisplay(hexValue, colorName)}</span>
                </div>
              `;
                      })
                      .join('')
                  : '<div class="text-xs text-white/50 italic p-2">Empty slot</div>'
              }
            </div>
            
            ${
              colors.length > 1
                ? `<div class="mt-2 text-xs text-amber-400 flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                Shared slot
              </div>`
                : ''
            }
          </div>`;
          })
          .join('')}
      </div>
    </div>
  `;
};

// Filament usage visualization
export const filamentUsageTemplate = (filamentUsage: FilamentUsage[]): string => {
  if (!filamentUsage || filamentUsage.length === 0) {
    return `
      <div class="text-center p-8 glass rounded-3xl">
        <div class="text-4xl mb-4">📊</div>
        <h4 class="text-xl font-bold text-white mb-2">No Filament Data</h4>
        <p class="text-white/70">Upload a G-code file to see filament usage analysis.</p>
      </div>
    `;
  }

  const totalWeight = filamentUsage.reduce((sum, usage) => sum + (usage.weight || 0), 0);

  const chartHtml = filamentUsage
    .map((usage, index) => {
      const percentage = totalWeight > 0 ? ((usage.weight || 0) / totalWeight) * 100 : 0;

      return `
      <div class="flex items-center justify-between p-4 glass rounded-xl hover:scale-105 transition-transform animate-fade-in" style="animation-delay: ${index * 0.1}s">
        <div class="flex items-center gap-4">
          <div class="w-4 h-4 rounded-full" style="background-color: ${usage.colorId || '#888888'}"></div>
          <div>
            <div class="text-sm font-medium text-white">${formatColorDisplay(usage.colorId, usage.colorId)}</div>
            <div class="text-xs text-white/60">${usage.colorId || 'Unknown'}</div>
          </div>
        </div>
        
        <div class="text-right">
          <div class="text-sm font-bold text-white">${(usage.weight || 0).toFixed(1)}g</div>
          <div class="text-xs text-white/60">${percentage.toFixed(1)}%</div>
        </div>
      </div>
    `;
    })
    .join('');

  return `
    <div class="glass rounded-3xl p-8">
      <h4 class="text-h3 text-white mb-4">Filament Usage by Color</h4>
      <div class="space-y-3">
        ${chartHtml}
      </div>
    </div>
  `;
};

// Simplified swap instructions template with only Glassmorphism design
export const swapInstructionsTemplate = (swaps: ManualSwap[], stats: GcodeStats, optimization?: OptimizationResult): string => {
  // Determine terminology based on configuration
  const isAmsMode = optimization?.configuration?.type === 'ams' && (optimization?.configuration?.unitCount || 0) > 0;
  
  if (swaps.length === 0) {
    return `
      <div class="text-center p-12 glass rounded-3xl border border-vibrant-green/30">
        <div class="text-6xl mb-4 animate-pulse">✅</div>
        <h4 class="text-2xl font-bold gradient-text mb-2">No Manual Swaps Required!</h4>
        <p class="text-white/70">Your print is optimized perfectly for the available ${isAmsMode ? 'AMS' : 'toolhead'} slots.</p>
      </div>
    `;
  }

  // Return glassmorphism design directly
  return swapInstructionsGlassmorphismDesign(swaps, stats, isAmsMode);
};

// Ultra Premium Glassmorphism Cards Design
function swapInstructionsGlassmorphismDesign(swaps: ManualSwap[], stats: GcodeStats, isAmsMode: boolean): string {
  const getContrastColor = (hexValue: string): string => {
    const r = parseInt(hexValue.substring(1, 3), 16);
    const g = parseInt(hexValue.substring(3, 5), 16);
    const b = parseInt(hexValue.substring(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  const swapsHtml = swaps
    .map((swap, index) => {
      const fromColor = stats.colors.find((c) => c.id === swap.fromColor);
      const toColor = stats.colors.find((c) => c.id === swap.toColor);

      return `
      <div class="ultra-glass-card group" data-swap-index="${index}" style="animation-delay: ${index * 150}ms">
        <!-- Animated Background Orbs -->
        <div class="absolute inset-0 overflow-hidden rounded-3xl">
          <div class="floating-orb orb-1"></div>
          <div class="floating-orb orb-2"></div>
          <div class="floating-orb orb-3"></div>
        </div>
        
        <!-- Step Number Badge -->
        <div class="step-badge">
          <div class="step-number">${index + 1}</div>
        </div>

        <!-- Progress Checkbox with Highlight -->
        <div class="progress-checkbox-container">
          <label class="progress-label">
            <input type="checkbox" class="swap-progress" data-swap-index="${index}">
            <span class="progress-checkbox"></span>
            <span class="progress-text">Mark as complete</span>
          </label>
        </div>

        <!-- Header with Consolidated Pause Info -->
        <div class="mb-6 pl-16">
          ${
            swap.swapWindow && swap.swapWindow.startLayer !== swap.swapWindow.endLayer
              ? (() => {
                  const minLayer = Math.min(swap.swapWindow.startLayer, swap.swapWindow.endLayer);
                  const maxLayer = Math.max(swap.swapWindow.startLayer, swap.swapWindow.endLayer);
                  const windowSize = Math.abs(maxLayer - minLayer + 1);
                  return `<div class="text-2xl font-bold text-white mb-2">
                    Pause Between Layers ${formatDisplayRange(minLayer, maxLayer)}
                  </div>
                  <div class="text-amber-400 text-sm font-medium">
                    ${windowSize} layer window - pause anytime within this range
                  </div>`;
                })()
              : `<div class="text-2xl font-bold text-white mb-2">
                  ${formatDisplayLayer(swap.atLayer)}
                </div>
                <div class="text-red-400 text-sm font-medium">
                  Critical timing - colors are adjacent
                </div>`
          }
          ${swap.zHeight ? `<div class="text-white/60 text-sm mt-1">Z Height: ${swap.zHeight.toFixed(2)}mm</div>` : ''}
        </div>

        <!-- Premium Color Swatches -->
        <div class="flex items-center gap-6 mb-6">
          <!-- Remove Color -->
          <div class="color-swatch-premium remove-swatch flex-1" style="--color: ${fromColor?.hexValue || '#888'}">
            <div class="flex items-center gap-4">
              <div class="color-display" style="background: ${fromColor?.hexValue || '#888'}">
                <div class="color-text" style="color: ${getContrastColor(fromColor?.hexValue || '#888')}">
                  ${fromColor?.id.substring(1) || '?'}
                </div>
              </div>
              <div class="flex-1">
                <div class="text-red-400 text-sm font-medium">REMOVE</div>
                <div class="text-white font-semibold">${fromColor?.name || 'Unknown'}</div>
              </div>
            </div>
          </div>

          <!-- Animated Arrow -->
          <div class="swap-arrow">
            <div class="arrow-trail"></div>
            <svg class="w-4 h-4 md:w-6 md:h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 11v2h12l-5.5 5.5 1.42 1.42L19.84 12l-7.92-7.92L10.5 5.5 16 11H4z"/>
            </svg>
          </div>

          <!-- Insert Color -->
          <div class="color-swatch-premium insert-swatch flex-1" style="--color: ${toColor?.hexValue || '#888'}">
            <div class="flex items-center gap-4">
              <div class="color-display" style="background: ${toColor?.hexValue || '#888'}">
                <div class="color-text" style="color: ${getContrastColor(toColor?.hexValue || '#888')}">
                  ${toColor?.id.substring(1) || '?'}
                </div>
              </div>
              <div class="flex-1">
                <div class="text-green-400 text-sm font-medium">INSERT</div>
                <div class="text-white font-semibold">${toColor?.name || 'Unknown'}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Slot Information with Neon Glow -->
        <div class="slot-info-premium">
          <div class="slot-detail">
            <div class="slot-icon">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <circle cx="12" cy="12" r="8"/>
                <path d="M12 4v4"/>
                <path d="M12 16v4"/>
                <path d="M4 12h4"/>
                <path d="M16 12h4"/>
              </svg>
            </div>
            <div class="slot-text">
              <div class="slot-label">Target Slot</div>
              <div class="slot-value">${isAmsMode ? 'AMS' : 'Toolhead'} ${swap.unit} • Slot ${swap.slot}</div>
            </div>
          </div>
        </div>
      </div>
    `;
    })
    .join('');

  return `
    <div class="swap-design-container swap-design-glassmorphism">
      <div class="swap-background" aria-hidden="true">
        <div class="aurora-bg aurora-1"></div>
        <div class="aurora-bg aurora-2"></div>
        <div class="aurora-bg aurora-3"></div>
      </div>
      
      <div class="swap-content">
        <header class="swap-header">
          <h3 class="swap-title">Manual Swap Instructions</h3>
          <div class="swap-subtitle">
            <span>${swaps.length} color swap${swaps.length > 1 ? 's' : ''} required during print</span>
            <span class="progress-hint">
              <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              Track your progress with checkboxes
            </span>
          </div>
        </header>

        <div class="swap-list">
          ${swapsHtml}
        </div>
      </div>
    </div>
  `;
}

// Constraint validation template
export const constraintValidationTemplate = (
  validation: ConstraintValidationResult,
  stats?: GcodeStats
): string => {
  if (!validation.hasViolations) {
    return `
      <div class="constraint-success-panel bg-green-500/10 border-2 border-green-500/30 rounded-xl p-6 mb-6">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h3 class="text-lg font-bold text-green-400">Print Constraints Validated ✓</h3>
        </div>
        <p class="text-green-200">All layers are printable with your current ${validation.summary.availableSlots}-slot configuration. No manual intervention required.</p>
      </div>
    `;
  }

  // Don't show warning panel if there are no impossible violations
  if (validation.summary.impossibleLayerCount === 0) {
    return `
      <div class="constraint-success-panel bg-green-500/10 border-2 border-green-500/30 rounded-xl p-6 mb-6">
        <div class="flex items-center gap-3 mb-2">
          <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h3 class="text-lg font-bold text-green-400">Print Constraints Validated ✓</h3>
        </div>
        <p class="text-green-200">All layers are printable with your current ${validation.summary.availableSlots}-slot configuration.</p>
      </div>
    `;
  }

  return `
    <div class="constraint-warning-panel">
      <div class="constraint-warning-header">
        <div class="constraint-warning-icon">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"></path>
          </svg>
        </div>
        <div>
          <h3 class="constraint-warning-title">Constraint Violations Detected</h3>
          <p class="constraint-warning-subtitle">Some layers require more colors than available slots</p>
        </div>
      </div>

      <div class="constraint-summary">
        <div class="constraint-stat">
          <span class="constraint-stat-value">${validation.summary.impossibleLayerCount}</span>
          <span class="constraint-stat-label">Impossible Layers</span>
        </div>
        <div class="constraint-stat">
          <span class="constraint-stat-value">${validation.summary.maxColorsRequired}</span>
          <span class="constraint-stat-label">Max Colors Needed</span>
        </div>
        <div class="constraint-stat">
          <span class="constraint-stat-value">${validation.summary.availableSlots}</span>
          <span class="constraint-stat-label">Available Slots</span>
        </div>
        <div class="constraint-stat">
          <span class="constraint-stat-value">${validation.summary.suggestionsCount}</span>
          <span class="constraint-stat-label">Suggestions</span>
        </div>
      </div>

      <div class="constraint-violation-ranges">
        ${validation.violations.map((range) => constraintViolationRangeTemplate(range, stats)).join('')}
      </div>
    </div>
  `;
};

// Individual violation range template
export const constraintViolationRangeTemplate = (
  range: ConstraintViolationRange,
  stats?: GcodeStats
): string => {
  const layerText =
    range.startLayer === range.endLayer
      ? formatDisplayLayer(range.startLayer)
      : `Layers ${formatDisplayRange(range.startLayer, range.endLayer)}`;

  return `
    <div class="constraint-violation-range mb-6">
      <div class="constraint-violation-header mb-4">
        <h4 class="text-lg font-semibold text-red-400">
          ${layerText}: ${range.maxColorsRequired} colors needed, ${range.availableSlots} slots available
        </h4>
      </div>

      <div class="constraint-details-content" style="display: block;">
        ${
          range.suggestions.length > 0
            ? `
          <div class="constraint-suggestions">
            <h5 class="text-sm font-medium text-white/80 mb-3">Suggested Solutions:</h5>
            ${range.suggestions.map((suggestion) => constraintSuggestionTemplate(suggestion, stats)).join('')}
          </div>
        `
            : '<p class="text-sm text-white/60">No automatic suggestions available for this range.</p>'
        }
      </div>
    </div>
  `;
};

// Individual suggestion template with proper color handling
export const constraintSuggestionTemplate = (
  suggestion: ColorConsolidationSuggestion,
  stats?: GcodeStats
): string => {
  const impactIcon = {
    minimal: '🟢',
    low: '🟡',
    medium: '🟠',
    high: '🔴',
  }[suggestion.impact.visualImpact];

  // Helper to get hex color from tool ID
  const getColorHex = (colorId: string): string => {
    if (!stats) return '#888888';
    const color = stats.colors.find((c) => c.id === colorId);
    return color?.hexValue || '#888888';
  };

  return `
    <div class="constraint-suggestion-item">
      <div class="constraint-suggestion-header">
        <span class="constraint-suggestion-type ${suggestion.type}">${suggestion.type.toUpperCase()}</span>
        <span class="constraint-suggestion-impact ${suggestion.impact.visualImpact}">
          ${impactIcon} ${suggestion.impact.visualImpact} impact
        </span>
      </div>

      <div class="constraint-suggestion-description">
        <strong>${suggestion.reason}</strong>
        ${
          suggestion.secondaryColor
            ? `
          <div class="flex items-center gap-3 mt-2">
            <div class="w-8 h-8 rounded-full shadow-lg ring-2 ring-white/20" style="background-color: ${getColorHex(suggestion.secondaryColor)}"></div>
            <div class="relative">
              <div class="absolute inset-0 bg-white/5 rounded-full blur-sm"></div>
              <svg class="w-6 h-6 text-white/80 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12H19M5 12L9 8M5 12L9 16M19 12L15 8M19 12L15 16"></path>
              </svg>
            </div>
            <div class="w-8 h-8 rounded-full shadow-lg ring-2 ring-white/20" style="background-color: ${getColorHex(suggestion.primaryColor)}"></div>
            ${
              suggestion.similarity
                ? `
              <span class="text-xs text-white/60">
                (${suggestion.similarity.rgbDistance.toFixed(0)} RGB distance)
              </span>
            `
                : ''
            }
          </div>
        `
            : ''
        }
        <div class="text-xs text-white/60 mt-1">
          Affects ${suggestion.impact.usagePercentage.toFixed(1)}% of these layers
        </div>
      </div>

      <div class="constraint-suggestion-instruction">
        <span>${suggestion.instruction}</span>
        ${
          suggestion.type === 'merge' && suggestion.secondaryColor
            ? `<button class="constraint-merge-btn" data-primary="${suggestion.primaryColor}" data-secondary="${suggestion.secondaryColor}" onclick="window.__app?.mergeColors('${suggestion.primaryColor}', '${suggestion.secondaryColor}')">
                Apply Merge
              </button>`
            : ''
        }
      </div>
    </div>
  `;
};
