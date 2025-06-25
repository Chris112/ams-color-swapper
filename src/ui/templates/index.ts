import { GcodeStats, OptimizationResult, ManualSwap, ColorInfo } from '../../types';

// Utility function to format file size
const formatFileSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
};

// File statistics template
export const fileStatsTemplate = (stats: GcodeStats): string => {
  const items = [
    { label: 'File Size', value: formatFileSize(stats.fileSize) },
    { label: 'Slicer', value: stats.slicerInfo ? `${stats.slicerInfo.software} v${stats.slicerInfo.version}` : 'Unknown' },
    { label: 'Total Layers', value: stats.totalLayers.toString() },
    { label: 'Total Height', value: stats.totalHeight ? `${stats.totalHeight.toFixed(2)}mm` : 'Unknown' },
    { label: 'Colors Used', value: stats.colors.length.toString() },
    { label: 'Tool Changes', value: stats.toolChanges.length.toString() },
    { label: 'Parse Time', value: `${stats.parseTime}ms` },
  ];

  return `<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
    ${items.map(item => `
      <div class="glass rounded-2xl p-6 hover:scale-105 transition-transform group">
        <div class="text-3xl font-bold gradient-text mb-2 group-hover:animate-pulse">${item.value}</div>
        <div class="text-sm text-white/60 uppercase tracking-wider">${item.label}</div>
      </div>
    `).join('')}
  </div>`;
};

// Color statistics template
export const colorStatsTemplate = (colors: ColorInfo[]): string => {
  return colors.map((color, index) => `
    <div class="glass rounded-2xl p-4 hover:scale-105 transition-all duration-300 group animate-scale-in" style="animation-delay: ${index * 0.05}s">
      <div class="flex items-center gap-3">
        <div class="color-swatch" style="background-color: ${color.hexColor || '#888888'}"></div>
        <div class="flex-1">
          <div class="font-semibold text-white mb-1">${color.name || color.id}</div>
          <div class="text-xs text-white/60 space-y-1">
            <div>First Layer: <span class="text-vibrant-cyan font-medium">${color.firstLayer}</span></div>
            <div>Last Layer: <span class="text-vibrant-cyan font-medium">${color.lastLayer}</span></div>
            <div>Usage: <span class="text-vibrant-pink font-medium">${color.usagePercentage.toFixed(1)}%</span></div>
          </div>
        </div>
      </div>
    </div>
  `).join('');
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

  const slotsHtml = opt.slotAssignments.map(slot => {
    const slotColors = slot.colors.length > 0 ? slot.colors.map(colorId => {
      const color = stats.colors.find(c => c.id === colorId);
      return color ? `
        <span class="inline-flex items-center gap-2 px-3 py-1.5 glass rounded-full text-sm group hover:scale-105 transition-transform">
          <span class="w-4 h-4 rounded-full shadow-sm" style="background-color: ${color.hexColor || '#888888'}"></span>
          <span class="text-white/80">${color.name || color.id}</span>
        </span>
      ` : '';
    }).join('') : `
      <span class="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-sm text-white/50">
        <span class="w-4 h-4 rounded-full bg-white/20"></span>
        <span>Empty</span>
      </span>
    `;

    return `
      <div class="glass rounded-2xl p-5 hover:scale-[1.02] transition-transform">
        <div class="font-semibold text-white mb-3">AMS Slot ${slot.slot} <span class="text-sm font-normal text-white/50">${slot.isPermanent ? '(Permanent)' : '(Shared)'}</span></div>
        <div class="flex flex-wrap gap-2">${slotColors}</div>
      </div>
    `;
  }).join('');

  return statsHtml + '<h4 class="text-h3 text-white mt-8 mb-4">Slot Assignments</h4><div class="space-y-4">' + slotsHtml + '</div>';
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
  const maxWeight = Math.max(...filamentEstimates.map(est => est.weight || 0));

  const chartHtml = sortedEstimates.map((estimate, index) => {
    const color = colors.find(c => c.id === estimate.colorId);
    const weight = estimate.weight || 0;
    const percentage = totalWeight > 0 ? (weight / totalWeight * 100).toFixed(1) : '0';
    const barWidth = maxWeight > 0 ? (weight / maxWeight * 100) : 0;
    
    return `
      <div class="glass rounded-xl p-4 hover:scale-[1.02] transition-all duration-300 animate-scale-in" style="animation-delay: ${index * 0.05}s">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-3">
            <div class="w-6 h-6 rounded-full shadow-lg ring-2 ring-white/20" 
                 style="background-color: ${color?.hexColor || '#888888'}"></div>
            <span class="font-semibold text-white">${color?.name || estimate.colorId}</span>
          </div>
          <div class="text-right">
            <div class="text-xl font-bold gradient-text">${weight.toFixed(1)}g</div>
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
  }).join('');

  const summaryHtml = `
    <div class="glass rounded-2xl p-6 mb-6 text-center">
      <div class="text-4xl font-black gradient-text mb-2">${totalWeight.toFixed(1)}g</div>
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

  const swapsHtml = swaps.map((swap, index) => {
    const fromColor = stats.colors.find(c => c.id === swap.fromColor);
    const toColor = stats.colors.find(c => c.id === swap.toColor);

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
          ${swap.pauseEndLayer >= swap.pauseStartLayer 
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
              <div class="font-semibold text-white">${fromColor?.name || fromColor?.id || swap.fromColor}</div>
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
              <div class="font-semibold text-white">${toColor?.name || toColor?.id || swap.toColor}</div>
              <div class="text-vibrant-green font-medium">Insert → Slot ${swap.slot}</div>
            </div>
          </div>
        </div>
        
        <div class="mt-4 text-sm text-white/70 glass rounded-xl p-3">
          ${swap.reason}
        </div>
      </div>
    `;
  }).join('');

  const timelineHtml = `
    <div class="mt-8 card-glass">
      <h4 class="text-h3 text-white mb-6">Swap Timeline</h4>
      <div class="relative h-20 glass rounded-xl overflow-hidden">
        <div class="absolute inset-0 bg-gradient-spectrum opacity-30"></div>
        ${swaps.map((swap, index) => {
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
        }).join('')}
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