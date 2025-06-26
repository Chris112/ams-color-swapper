import { GcodeStats, OptimizationResult, ManualSwap, ColorInfo, FilamentUsage } from '../../types';
import { formatColorDisplay } from '../../utils/colorNames';

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

  return `<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4 animate-scale-in">
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
  colors: ColorInfo[],
  filamentEstimates?: FilamentUsage[]
): string => {
  const totalLayers = Math.max(...colors.map((c) => c.lastLayer)) + 1;

  return `
    <div class="space-y-8">
      <!-- Interactive Layer Timeline -->
      <div class="bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/10">
        <h4 class="text-xl font-bold text-white mb-6 flex items-center gap-3">
          <svg class="w-6 h-6 text-vibrant-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
          </svg>
          Layer Timeline Visualization
        </h4>
        <div class="relative mb-4">
          <canvas id="colorTimeline" class="w-full bg-black/30 rounded-2xl shadow-inner" style="height: 160px;"></canvas>
          <div id="timelineOverlay" class="absolute inset-0 rounded-2xl overflow-hidden cursor-pointer">
            <!-- Interactive segments will be added here -->
          </div>
          <div class="absolute bottom-0 left-0 right-0 flex justify-between text-sm text-white/60 px-4 pb-2 font-medium pointer-events-none">
            <span>Layer 0</span>
            <span>Layer ${totalLayers}</span>
          </div>
        </div>
        <p class="text-sm text-white/50">Click on the timeline to see layer details • Hover to highlight colors</p>
      </div>

      <!-- Enhanced Color Cards -->
      <div>
        <h4 class="text-xl font-bold text-white mb-6">Color Details & Usage</h4>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${colors
          .map((color, index) => {
            // Find the filament estimate for this color
            const filamentEstimate = filamentEstimates?.find((est) => est.colorId === color.id);
            const weight = filamentEstimate?.weight || 0;

            return `
          <div class="color-card bg-white/5 backdrop-blur-sm rounded-3xl p-6 hover:scale-105 transition-all duration-300 group animate-scale-in cursor-pointer border border-white/10 hover:border-white/20" 
               style="animation-delay: ${index * 0.05}s" 
               data-color-id="${color.id}">
            <div class="flex items-center gap-4 mb-4">
              <div class="relative">
                <div class="w-16 h-16 rounded-2xl shadow-lg interactive-swatch ring-2 ring-white/20" 
                     style="background-color: ${color.hexColor || '#888888'}"
                     data-hex="${color.hexColor || '#888888'}"
                     title="Click to copy color code">
                  <div class="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                  </div>
                </div>
                <div class="absolute -top-1 -right-1 w-6 h-6 bg-gradient-neon rounded-full flex items-center justify-center text-xs font-bold text-white shadow-glow-pink">
                  ${index + 1}
                </div>
              </div>
              <div class="flex-1">
                <div class="font-bold text-lg text-white mb-2 flex items-center gap-2">
                  ${color.name || formatColorDisplay(color.hexColor, color.id)}
                  <span class="text-sm px-3 py-1 bg-gradient-to-r from-vibrant-purple/20 to-vibrant-pink/20 rounded-full text-white/80 font-medium">
                    ${color.usagePercentage.toFixed(1)}%
                  </span>
                </div>
                <div class="text-sm text-white/60">
                  Layers ${color.firstLayer}-${color.lastLayer} 
                  <span class="text-white/40">(${color.layerCount || color.lastLayer - color.firstLayer + 1} layers)</span>
                  ${weight > 0 ? `<span class="text-vibrant-cyan font-medium"> • ${weight.toFixed(1)}g</span>` : ''}
                </div>
              </div>
              <button class="expand-btn opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white/60 hover:text-white">
                <svg class="w-5 h-5 transform transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
            </div>
            
            
            <!-- Usage Progress Bar -->
            <div class="mt-4 mb-4">
              <div class="relative h-4 bg-black/30 rounded-full overflow-hidden shadow-inner">
                <div class="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out hover:brightness-110"
                     style="width: ${color.usagePercentage}%; background: linear-gradient(90deg, ${color.hexColor || '#888888'}, ${color.hexColor || '#888888'}CC)">
                  <div class="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 rounded-full"></div>
                </div>
              </div>
            </div>

            <!-- Expandable Details -->
            <div class="expandable-details max-h-0 overflow-hidden transition-all duration-300">
              <div class="pt-4 border-t border-white/20 space-y-3">
                <div class="grid grid-cols-2 gap-4 text-sm">
                  <div class="flex justify-between bg-black/20 rounded-lg p-2">
                    <span class="text-white/60">Hex Color:</span>
                    <span class="text-vibrant-cyan font-mono font-bold">${color.hexColor || '#888888'}</span>
                  </div>
                  <div class="flex justify-between bg-black/20 rounded-lg p-2">
                    <span class="text-white/60">Layer Count:</span>
                    <span class="text-white font-medium">${color.layerCount || color.lastLayer - color.firstLayer + 1}</span>
                  </div>
                  <div class="flex justify-between bg-black/20 rounded-lg p-2">
                    <span class="text-white/60">Filament Used:</span>
                    <span class="text-white font-medium">${weight > 0 ? `${weight.toFixed(1)}g` : 'N/A'}</span>
                  </div>
                  <div class="flex justify-between bg-black/20 rounded-lg p-2">
                    <span class="text-white/60">Layer Range:</span>
                    <span class="text-white font-medium">${color.lastLayer - color.firstLayer + 1}</span>
                  </div>
                </div>
                
                <!-- Action Buttons -->
                <div class="flex gap-3 pt-3">
                  <button class="flex-1 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 highlight-color-btn" data-color-id="${color.id}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                    Highlight
                  </button>
                  <button class="flex-1 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 toggle-color-btn" data-color-id="${color.id}">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>
                    </svg>
                    Hide
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
          })
          .join('')}
        </div>
      </div>
    </div>
  `;
};

// Optimization results template
export const optimizationTemplate = (opt: OptimizationResult, stats: GcodeStats): string => {
  const statsHtml = `
    <div class="grid grid-cols-2 gap-4 mb-6">
      <div class="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform group">
        <div class="text-4xl font-black text-vibrant-blue group-hover:animate-pulse">${opt.totalColors}</div>
        <div class="text-sm text-white/60 uppercase tracking-wider mt-2">Total Colors</div>
      </div>
      <div class="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform group">
        <div class="text-4xl font-black text-vibrant-purple group-hover:animate-pulse">${opt.requiredSlots}</div>
        <div class="text-sm text-white/60 uppercase tracking-wider mt-2">Required Slots</div>
      </div>
      <div class="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform group">
        <div class="text-4xl font-black text-vibrant-orange group-hover:animate-pulse">${opt.manualSwaps.length}</div>
        <div class="text-sm text-white/60 uppercase tracking-wider mt-2">Manual Swaps</div>
      </div>
      <div class="glass rounded-2xl p-6 text-center hover:scale-105 transition-transform group">
        <div class="text-4xl font-black text-vibrant-green group-hover:animate-pulse">${Math.round(opt.estimatedTimeSaved / 60)} min</div>
        <div class="text-sm text-white/60 uppercase tracking-wider mt-2">Time Saved</div>
      </div>
    </div>
  `;

  // Group slots by unit for AMS mode
  const groupedSlots =
    opt.configuration?.type === 'ams'
      ? opt.slotAssignments.reduce(
          (acc, slot) => {
            const unit = slot.unit;
            if (!acc[unit]) acc[unit] = [];
            acc[unit].push(slot);
            return acc;
          },
          {} as Record<number, typeof opt.slotAssignments>
        )
      : { 1: opt.slotAssignments }; // For toolhead mode, all in one group

  const slotsHtml =
    opt.configuration?.type === 'ams'
      ? Object.entries(groupedSlots)
          .map(([unit, unitSlots]) => {
            const unitSlotsHtml = unitSlots
              .map((slot) => {
                const slotColors =
                  slot.colors.length > 0
                    ? slot.colors
                        .map((colorId) => {
                          const color = stats.colors.find((c) => c.id === colorId);
                          return color
                            ? `<span class="inline-flex items-center gap-2 px-3 py-1.5 glass rounded-full text-sm group hover:scale-105 transition-transform">
                        <span class="w-4 h-4 rounded-full shadow-sm" style="background-color: ${color.hexColor || '#888888'}"></span>
                        <span class="text-white/80">${color.name || formatColorDisplay(color.hexColor, color.id)}</span>
                      </span>`
                            : '';
                        })
                        .join('')
                    : `<span class="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-sm text-white/50">
                <span class="w-4 h-4 rounded-full bg-white/20"></span>
                <span>Empty</span>
              </span>`;

                return `
            <div class="glass rounded-xl p-4">
              <div class="font-medium text-white mb-2">Slot ${slot.slot} <span class="text-sm font-normal text-white/50">${slot.isPermanent ? '(Permanent)' : '(Shared)'}</span></div>
              <div class="flex flex-wrap gap-2">${slotColors}</div>
            </div>
          `;
              })
              .join('');

            return `
          <div class="glass rounded-2xl p-5 hover:scale-[1.02] transition-transform">
            <div class="font-semibold text-white mb-4">AMS Unit ${unit}</div>
            <div class="grid grid-cols-2 gap-3">${unitSlotsHtml}</div>
          </div>
        `;
          })
          .join('')
      : opt.slotAssignments
          .map((slot) => {
            const slotColors =
              slot.colors.length > 0
                ? slot.colors
                    .map((colorId) => {
                      const color = stats.colors.find((c) => c.id === colorId);
                      return color
                        ? `<span class="inline-flex items-center gap-2 px-3 py-1.5 glass rounded-full text-sm group hover:scale-105 transition-transform">
                      <span class="w-4 h-4 rounded-full shadow-sm" style="background-color: ${color.hexColor || '#888888'}"></span>
                      <span class="text-white/80">${color.name || formatColorDisplay(color.hexColor, color.id)}</span>
                    </span>`
                        : '';
                    })
                    .join('')
                : `<span class="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-sm text-white/50">
              <span class="w-4 h-4 rounded-full bg-white/20"></span>
              <span>Empty</span>
            </span>`;

            return `
          <div class="glass rounded-2xl p-5 hover:scale-[1.02] transition-transform">
            <div class="font-semibold text-white mb-3">Toolhead ${slot.unit} <span class="text-sm font-normal text-white/50">${slot.isPermanent ? '(Permanent)' : '(Shared)'}</span></div>
            <div class="flex flex-wrap gap-2">${slotColors}</div>
          </div>
        `;
          })
          .join('');

  return (
    statsHtml +
    '<h4 class="text-h3 text-white mt-8 mb-4">Slot Assignments</h4><div class="space-y-4">' +
    slotsHtml +
    '</div>'
  );
};

// Filament usage visualization template
export const filamentUsageTemplate = (filamentEstimates: any[], colors: ColorInfo[]): string => {
  if (!filamentEstimates || filamentEstimates.length === 0) {
    return '';
  }

  // Calculate total weight for percentage calculations
  const totalWeight = filamentEstimates.reduce((sum, est) => sum + (est.weight || 0), 0);

  // Sort by weight descending
  const sortedEstimates = [...filamentEstimates].sort((a, b) => (b.weight || 0) - (a.weight || 0));

  // Find max weight for scaling bars
  const maxWeight = Math.max(...filamentEstimates.map((est) => est.weight || 0));

  const chartHtml = sortedEstimates
    .map((estimate, index) => {
      const color = colors.find((c) => c.id === estimate.colorId);
      const weight = estimate.weight || 0;
      const percentage = totalWeight > 0 ? ((weight / totalWeight) * 100).toFixed(1) : '0';
      const barWidth = maxWeight > 0 ? (weight / maxWeight) * 100 : 0;

      return `
      <div class="glass rounded-xl p-4 hover:scale-[1.02] transition-all duration-300 animate-scale-in" style="animation-delay: ${index * 0.05}s">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-3">
            <div class="w-6 h-6 rounded-full shadow-lg ring-2 ring-white/20" 
                 style="background-color: ${color?.hexColor || '#888888'}"></div>
            <span class="font-semibold text-white">${color?.name || formatColorDisplay(color?.hexColor, estimate.colorId)}</span>
          </div>
          <div class="text-right">
            <div class="text-xl font-bold text-white">${weight.toFixed(1)}g</div>
            <div class="text-xs text-white/60">${percentage}%</div>
          </div>
        </div>
        <div class="relative h-6 bg-white/10 rounded-full overflow-hidden">
          <div class="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out hover:brightness-110"
               style="width: ${barWidth}%; background: linear-gradient(90deg, ${color?.hexColor || '#888888'}CC, ${color?.hexColor || '#888888'}FF)">
            <div class="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 rounded-full"></div>
          </div>
        </div>
      </div>
    `;
    })
    .join('');

  const summaryHtml = `
    <div class="glass rounded-2xl p-6 mb-6 text-center">
      <div class="text-4xl font-black text-white mb-2">${totalWeight.toFixed(1)}g</div>
      <div class="text-sm text-white/60 uppercase tracking-wider">Total Filament Usage</div>
    </div>
  `;

  return `
    <div class="space-y-4">
      ${summaryHtml}
      <h4 class="text-h3 text-white mb-4">Filament Usage by Color</h4>
      <div class="space-y-3">
        ${chartHtml}
      </div>
    </div>
  `;
};

// Swap instructions template
export const swapInstructionsTemplate = (swaps: ManualSwap[], stats: GcodeStats): string => {
  if (swaps.length === 0) {
    return `
      <div class="text-center p-12 glass rounded-3xl border border-vibrant-green/30">
        <div class="text-6xl mb-4 animate-pulse">✅</div>
        <h4 class="text-2xl font-bold gradient-text mb-2">No Manual Swaps Required!</h4>
        <p class="text-white/70">Your print is optimized perfectly for the available AMS slots.</p>
      </div>
    `;
  }

  const getContrastColor = (hexColor: string): string => {
    const r = parseInt(hexColor.substring(1, 3), 16);
    const g = parseInt(hexColor.substring(3, 5), 16);
    const b = parseInt(hexColor.substring(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  const swapsHtml = swaps
    .map((swap, index) => {
      const fromColor = stats.colors.find((c) => c.id === swap.fromColor);
      const toColor = stats.colors.find((c) => c.id === swap.toColor);

      return `
      <div class="relative p-6 glass rounded-2xl hover:scale-[1.02] transition-all duration-300 group animate-scale-in" style="animation-delay: ${index * 0.1}s">
        <div class="absolute -left-4 top-6 w-10 h-10 bg-gradient-neon text-white rounded-full flex items-center justify-center font-bold text-sm shadow-glow-pink">${index + 1}</div>
        
        <div class="flex items-center gap-2 mb-4 text-white/60">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          ${
            swap.pauseEndLayer >= swap.pauseStartLayer
              ? `<span class="font-semibold text-white">Pause between layers ${swap.pauseStartLayer}-${swap.pauseEndLayer}</span>`
              : `<span class="font-semibold text-white">Pause at layer ${swap.atLayer}</span>`
          }
          ${swap.zHeight ? `<span class="text-sm"> • Z${swap.zHeight.toFixed(2)}mm</span>` : ''}
        </div>
        
        <div class="flex items-center justify-between gap-6">
          <div class="flex items-center gap-3">
            <div class="color-swatch shadow-glow-pink" style="background-color: ${fromColor?.hexColor || '#888'}; color: ${getContrastColor(fromColor?.hexColor || '#888')}">
              <span class="font-bold text-lg">${fromColor?.id.substring(1) || '?'}</span>
            </div>
            <div>
              <div class="font-semibold text-white">${fromColor?.name || formatColorDisplay(fromColor?.hexColor, fromColor?.id || swap.fromColor)}</div>
              <div class="text-white/50 text-sm">Remove</div>
            </div>
          </div>
          
          <svg class="w-10 h-10 text-vibrant-pink animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
          
          <div class="flex items-center gap-3">
            <div class="color-swatch shadow-glow-green" style="background-color: ${toColor?.hexColor || '#888'}; color: ${getContrastColor(toColor?.hexColor || '#888')}">
              <span class="font-bold text-lg">${toColor?.id.substring(1) || '?'}</span>
            </div>
            <div>
              <div class="font-semibold text-white">${toColor?.name || formatColorDisplay(toColor?.hexColor, toColor?.id || swap.toColor)}</div>
              <div class="text-vibrant-green font-medium">Insert → Unit ${swap.unit} Slot ${swap.slot}</div>
            </div>
          </div>
        </div>
        
        <div class="mt-4 text-sm text-white/70 glass rounded-xl p-3">
          ${swap.reason}
        </div>
      </div>
    `;
    })
    .join('');

  const timelineHtml = `
    <div class="mt-8 card-glass">
      <h4 class="text-h3 text-white mb-6">Swap Timeline</h4>
      <div class="relative h-20 glass rounded-xl overflow-hidden">
        <div class="absolute inset-0 bg-gradient-spectrum opacity-30"></div>
        ${swaps
          .map((swap, index) => {
            const position = (swap.atLayer / stats.totalLayers) * 100;
            return `
            <div class="absolute top-0 bottom-0 w-1 bg-gradient-to-b from-vibrant-pink to-vibrant-purple animate-pulse" 
                 style="left: ${position}%"
                 title="Swap ${index + 1} at layer ${swap.atLayer}">
              <div class="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-gradient-neon rounded-full shadow-glow-pink animate-glow-pulse"></div>
              <div class="absolute -bottom-8 left-1/2 -translate-x-1/2 text-sm text-white/70 font-medium whitespace-nowrap">
                ${swap.atLayer}
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
      <div class="flex justify-between mt-10 text-sm text-white/60">
        <span>Layer 0</span>
        <span>Layer ${stats.totalLayers}</span>
      </div>
    </div>
  `;

  return `
    <div class="mb-6 p-6 glass rounded-2xl border border-vibrant-orange/30">
      <h3 class="text-xl font-bold gradient-text mb-2">📋 ${swaps.length} Manual Swap${swaps.length > 1 ? 's' : ''} Required</h3>
      <p class="text-sm text-white/60">Follow these steps to complete your multi-color print</p>
    </div>
    <div class="space-y-4">
      ${swapsHtml}
    </div>
    ${timelineHtml}
  `;
};
