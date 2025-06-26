import { Component } from '../../core/Component';
import { AppEvents } from '../../core/EventEmitter';
import { AppStateData } from '../../state/AppState';
import { GcodeStats, ColorRange } from '../../types';
import {
  fileStatsTemplate,
  colorStatsTemplate,
  optimizationTemplate,
  swapInstructionsTemplate,
} from '../templates';
import {
  animateNumber,
  staggerAnimation,
  addRippleEffect,
  add3DTiltEffect,
  addGlowHover,
} from '../../utils/animations';
import { VolumetricHologram } from './VolumetricHologram';

export class ResultsView extends Component {
  private exportBtn!: HTMLElement;
  private exportGcodeBtn: HTMLElement | null = null;
  private newFileBtn!: HTMLElement;
  private toggleDebugBtn!: HTMLElement;
  private clearCacheBtn!: HTMLElement;
  private volumetricHologram: VolumetricHologram | null = null;

  constructor() {
    super('#resultsSection');

    const exportBtn = this.element.querySelector('#exportBtn');
    const exportGcodeBtn = this.element.querySelector('#exportGcodeBtn') as HTMLElement | null;
    const newFileBtn = this.element.querySelector('#newFileBtn');
    const toggleDebugBtn = this.element.querySelector('#toggleDebugBtn');
    const clearCacheBtn = this.element.querySelector('#clearCacheBtn');

    if (!exportBtn || !newFileBtn || !toggleDebugBtn || !clearCacheBtn) {
      throw new Error('ResultsView: Required buttons not found in DOM');
    }

    this.exportBtn = exportBtn as HTMLElement;
    this.exportGcodeBtn = exportGcodeBtn;
    this.newFileBtn = newFileBtn as HTMLElement;
    this.toggleDebugBtn = toggleDebugBtn as HTMLElement;
    this.clearCacheBtn = clearCacheBtn as HTMLElement;

    this.attachEventListeners();
    this.addMicroInteractions();
    this.initialize();
  }

  protected render(): void {
    const { view, stats, optimization } = this.state;

    // ResultsView render

    // Show/hide based on view
    this.toggle(view === 'results');

    // Clean up hologram when not in results view
    if (view !== 'results' && this.volumetricHologram) {
      this.volumetricHologram.destroy();
      this.volumetricHologram = null;
    }

    if (view === 'results' && stats && optimization) {
      // Updating results view components
      this.updateFileName();
      this.updateFileStats();
      this.updateColorStats();
      // Filament usage now integrated into color stats
      // this.updateFilamentUsage();
      this.updateVolumetricHologram();
      this.updateOptimization();
      this.updateSwapInstructions();
      this.drawColorTimeline();

      // Show/hide export G-code button based on manual swaps
      if (this.exportGcodeBtn) {
        if (optimization.manualSwaps.length > 0) {
          this.exportGcodeBtn.style.display = 'inline-flex';
        } else {
          this.exportGcodeBtn.style.display = 'none';
        }
      }
    }
  }

  protected shouldUpdate(oldState: AppStateData, newState: AppStateData): boolean {
    return (
      oldState.view !== newState.view ||
      oldState.stats !== newState.stats ||
      oldState.optimization !== newState.optimization
    );
  }

  private attachEventListeners(): void {
    if (this.exportBtn) {
      this.exportBtn.addEventListener('click', () => this.emit(AppEvents.EXPORT_REQUESTED));
    }
    if (this.exportGcodeBtn) {
      this.exportGcodeBtn.addEventListener('click', () =>
        this.emit(AppEvents.EXPORT_GCODE_REQUESTED)
      );
    }
    if (this.newFileBtn) {
      this.newFileBtn.addEventListener('click', () => this.emit(AppEvents.RESET_REQUESTED));
    }
    if (this.toggleDebugBtn) {
      this.toggleDebugBtn.addEventListener('click', () => this.emit(AppEvents.DEBUG_TOGGLE));
    }
    if (this.clearCacheBtn) {
      this.clearCacheBtn.addEventListener('click', () => this.emit(AppEvents.CLEAR_CACHE));
    }
  }

  private updateFileName(): void {
    const fileNameElement = document.getElementById('fileName');
    if (fileNameElement && this.state.stats) {
      fileNameElement.textContent = this.state.stats.fileName;
      // Add typewriter effect for file name
      fileNameElement.style.opacity = '0';
      setTimeout(() => {
        fileNameElement.style.transition = 'opacity 0.5s ease';
        fileNameElement.style.opacity = '1';
      }, 100);
    }
  }

  private addMicroInteractions(): void {
    // Add ripple effect to buttons
    [
      this.exportBtn,
      this.exportGcodeBtn,
      this.newFileBtn,
      this.toggleDebugBtn,
      this.clearCacheBtn,
    ].forEach((btn) => {
      if (btn) {
        addRippleEffect(btn);
        addGlowHover(btn, 'purple');
      }
    });
  }

  private updateFileStats(): void {
    const container = document.getElementById('fileStats');
    if (container && this.state.stats) {
      container.innerHTML = fileStatsTemplate(this.state.stats);

      // Animate numbers
      const statValues = container.querySelectorAll('.text-3xl');
      statValues.forEach((el) => {
        const text = el.textContent || '';
        const match = text.match(/^(\d+)(.*)/);
        if (match) {
          const num = parseInt(match[1]);
          const suffix = match[2] || '';
          animateNumber(el as HTMLElement, 0, num, 800, suffix);
        }
      });

      // Add 3D tilt to stat cards
      const cards = container.querySelectorAll('.glass');
      cards.forEach((card) => {
        add3DTiltEffect(card as HTMLElement, 5);
      });
    }
  }

  private updateColorStats(): void {
    const container = document.getElementById('colorStats');
    if (container && this.state.stats) {
      container.innerHTML = colorStatsTemplate(
        this.state.stats.colors,
        this.state.stats.filamentEstimates
      );

      // Stagger animation for color cards
      staggerAnimation(container, '.color-card', 'animate-scale-in', 50);

      this.attachColorInteractions();
    }
  }

  private attachColorInteractions(): void {
    // Interactive color swatches - copy hex code
    const interactiveSwatches = document.querySelectorAll('.interactive-swatch');
    interactiveSwatches.forEach((swatch) => {
      const el = swatch as HTMLElement;

      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const hex = el.dataset.hex;
        if (hex) {
          try {
            await navigator.clipboard.writeText(hex);
            this.showToast(`Color ${hex} copied to clipboard!`, 'success');

            // Visual feedback
            el.style.transform = 'scale(0.9)';
            setTimeout(() => {
              el.style.transform = '';
            }, 150);
          } catch (err) {
            this.showToast('Failed to copy color code', 'error');
          }
        }
      });
    });

    // Color card expansion
    const colorCards = document.querySelectorAll('.color-card');
    colorCards.forEach((card) => {
      const el = card as HTMLElement;
      const expandBtn = el.querySelector('.expand-btn');
      const expandableDetails = el.querySelector('.expandable-details') as HTMLElement;
      const expandIcon = expandBtn?.querySelector('svg');

      if (expandBtn && expandableDetails) {
        expandBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isExpanded =
            expandableDetails.style.maxHeight !== '' && expandableDetails.style.maxHeight !== '0px';

          if (isExpanded) {
            expandableDetails.style.maxHeight = '0px';
            expandIcon?.style.setProperty('transform', 'rotate(0deg)');
          } else {
            expandableDetails.style.maxHeight = expandableDetails.scrollHeight + 'px';
            expandIcon?.style.setProperty('transform', 'rotate(180deg)');
          }
        });
      }

      // Card click to toggle expand/collapse
      el.addEventListener('click', () => {
        if (expandBtn && expandableDetails) {
          const isExpanded =
            expandableDetails.style.maxHeight !== '' && expandableDetails.style.maxHeight !== '0px';

          if (isExpanded) {
            // Collapse
            expandableDetails.style.maxHeight = '0px';
            expandIcon?.style.setProperty('transform', 'rotate(0deg)');
          } else {
            // Expand
            expandableDetails.style.maxHeight = expandableDetails.scrollHeight + 'px';
            expandIcon?.style.setProperty('transform', 'rotate(180deg)');
          }
        }
      });
    });

    // Highlight color buttons
    const highlightBtns = document.querySelectorAll('.highlight-color-btn');
    highlightBtns.forEach((btn) => {
      const el = btn as HTMLElement;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const colorId = el.dataset.colorId;
        if (colorId) {
          this.toggleColorHighlight(colorId);
        }
      });
    });

    // Toggle color visibility buttons
    const toggleBtns = document.querySelectorAll('.toggle-color-btn');
    toggleBtns.forEach((btn) => {
      const el = btn as HTMLElement;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const colorId = el.dataset.colorId;
        if (colorId) {
          this.toggleColorVisibility(colorId);
        }
      });
    });
  }

  private highlightColor(colorId: string, temporary: boolean = false): void {
    // Highlight all elements with this color
    const timelineSegments = document.querySelectorAll(`[data-color-id="${colorId}"]`);
    timelineSegments.forEach((segment) => {
      const el = segment as HTMLElement;
      el.style.filter = 'brightness(1.3) saturate(1.5)';
      el.style.transform = 'scale(1.05)';
      el.style.zIndex = '10';
    });

    if (!temporary) {
      // Add persistent highlight class
      timelineSegments.forEach((segment) => {
        segment.classList.add('highlighted');
      });
    }
  }

  private clearHighlights(): void {
    const highlightedElements = document.querySelectorAll('.timeline-segment');
    highlightedElements.forEach((el) => {
      const element = el as HTMLElement;
      if (!element.classList.contains('highlighted')) {
        element.style.filter = '';
        element.style.transform = '';
        element.style.zIndex = '';
      }
    });
  }

  private toggleColorHighlight(colorId: string): void {
    const segments = document.querySelectorAll(`[data-color-id="${colorId}"]`);
    const isHighlighted = segments[0]?.classList.contains('highlighted');

    if (isHighlighted) {
      segments.forEach((segment) => {
        segment.classList.remove('highlighted');
        const el = segment as HTMLElement;
        el.style.filter = '';
        el.style.transform = '';
        el.style.zIndex = '';
      });
      this.showToast(`Color ${colorId} highlight removed`, 'info');
    } else {
      this.highlightColor(colorId, false);
      this.showToast(`Color ${colorId} highlighted`, 'success');
    }
  }

  private toggleColorVisibility(colorId: string): void {
    const segments = document.querySelectorAll(`[data-color-id="${colorId}"]`);
    const card = document.querySelector(`.color-card[data-color-id="${colorId}"]`) as HTMLElement;
    const isHidden = card?.style.opacity === '0.3';

    if (isHidden) {
      segments.forEach((segment) => {
        const el = segment as HTMLElement;
        el.style.opacity = '1';
      });
      if (card) {
        card.style.opacity = '1';
      }
      this.showToast(`Color ${colorId} shown`, 'info');
    } else {
      segments.forEach((segment) => {
        const el = segment as HTMLElement;
        el.style.opacity = '0.3';
      });
      if (card) {
        card.style.opacity = '0.3';
      }
      this.showToast(`Color ${colorId} hidden`, 'info');
    }
  }

  private showColorDetails(
    colorId: string,
    colorName: string,
    firstLayer: number,
    lastLayer: number
  ): void {
    const modal = document.createElement('div');
    modal.className =
      'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="glass rounded-3xl p-8 max-w-md w-full animate-scale-in">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-bold text-white">${colorName}</h3>
          <button class="close-modal text-white/60 hover:text-white transition-colors">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div class="space-y-4 text-white/80">
          <div>
            <span class="text-white/60">Color ID:</span>
            <span class="ml-2 font-mono text-vibrant-cyan">${colorId}</span>
          </div>
          <div>
            <span class="text-white/60">Layer Range:</span>
            <span class="ml-2">${firstLayer} - ${lastLayer}</span>
          </div>
          <div>
            <span class="text-white/60">Total Layers:</span>
            <span class="ml-2">${lastLayer - firstLayer + 1}</span>
          </div>
        </div>
        <div class="flex gap-3 mt-6">
          <button class="btn-gradient flex-1">
            Focus in Timeline
          </button>
          <button class="btn-glass">
            Export Layer Range
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close modal functionality
    const closeBtn = modal.querySelector('.close-modal');
    const handleClose = () => {
      modal.remove();
    };

    closeBtn?.addEventListener('click', handleClose);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        handleClose();
      }
    });

    // Focus timeline segment
    const focusBtn = modal.querySelector('.btn-gradient');
    focusBtn?.addEventListener('click', () => {
      this.focusTimelineSegment(colorId);
      handleClose();
    });
  }

  private focusTimelineSegment(colorId: string): void {
    const timeline = document.getElementById('colorTimeline');
    const segment = document.querySelector(`[data-color-id="${colorId}"]`) as HTMLElement;

    if (timeline && segment) {
      // Clear other highlights
      this.clearHighlights();

      // Highlight this segment
      this.highlightColor(colorId, false);

      // Scroll timeline into view
      timeline.scrollIntoView({ behavior: 'smooth', block: 'center' });

      this.showToast(`Focused on ${colorId} in timeline`, 'success');
    }
  }

  private showToast(message: string, type: 'success' | 'error' | 'info'): void {
    const toast = document.createElement('div');
    const bgColor =
      type === 'success'
        ? 'bg-green-500/90'
        : type === 'error'
          ? 'bg-red-500/90'
          : 'bg-blue-500/90';

    toast.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-scale-in`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  private updateOptimization(): void {
    const container = document.getElementById('optimizationResults');
    if (container && this.state.optimization) {
      container.innerHTML = optimizationTemplate(this.state.optimization, this.state.stats!);

      // Animate optimization numbers
      const numbers = container.querySelectorAll('.text-4xl');
      numbers.forEach((el) => {
        const text = el.textContent || '';
        const match = text.match(/^(\d+)(.*)/);
        if (match) {
          const num = parseInt(match[1]);
          const suffix = match[2] || '';
          animateNumber(el as HTMLElement, 0, num, 1000, suffix);
        }
        el.classList.add('animate-counter');
      });

      // Add hover effects to slot cards
      const slots = container.querySelectorAll('.glass');
      slots.forEach((slot) => {
        add3DTiltEffect(slot as HTMLElement, 8);
      });
    }
  }

  private updateSwapInstructions(): void {
    const container = document.getElementById('swapInstructions');
    if (container && this.state.optimization && this.state.stats) {
      container.innerHTML = swapInstructionsTemplate(
        this.state.optimization.manualSwaps,
        this.state.stats
      );

      // Stagger animation for swap cards
      const swapCards = container.querySelectorAll('.animate-scale-in');
      swapCards.forEach((card, index) => {
        const el = card as HTMLElement;
        el.style.animationDelay = `${index * 100}ms`;
      });

      // Add hover effect to timeline markers
      const markers = container.querySelectorAll('[title]');
      markers.forEach((marker) => {
        const el = marker as HTMLElement;
        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.5)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.transform = '';
        });
      });
    }
  }

  private updateVolumetricHologram(): void {
    // DISABLED - Volumetric hologram feature is temporarily disabled
    return;

    if (!this.state.stats) return;

    const container = document.getElementById('hologramContainer');
    if (!container) return;

    // Clean up existing hologram
    if (this.volumetricHologram) {
      this.volumetricHologram!.destroy();
      this.volumetricHologram = null;
    }

    // Create new hologram with delay for smooth transition
    setTimeout(() => {
      if (!container) return;

      try {
        this.volumetricHologram = new VolumetricHologram(
          '#hologramContainer',
          this.state.stats!,
          {
            enableEffects: true,
            showScanlines: true,
            showParticles: true,
          },
          {
            onLayerChange: (layer: number) => {
              // Hologram layer changed
            },
            onVoxelClick: (voxel: any) => {
              // Voxel clicked
            },
          }
        );
      } catch (error) {
        console.error('Failed to create volumetric hologram:', error);
        container.innerHTML = `
          <div class="flex items-center justify-center h-full text-white/60">
            <div class="text-center">
              <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <p>Hologram visualization unavailable</p>
              <p class="text-sm mt-1">WebGL may not be supported</p>
            </div>
          </div>
        `;
      }
    }, 300);
  }

  private drawColorTimeline(): void {
    const canvas = document.getElementById('colorTimeline') as HTMLCanvasElement;
    if (!canvas || !this.state.stats) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get canvas context');
      return;
    }

    const stats = this.state.stats;

    // Validate data
    if (!stats.colorUsageRanges || stats.colorUsageRanges.length === 0) {
      console.warn('No color usage ranges to display');
      // Draw placeholder text
      const ctx2d = canvas.getContext('2d');
      if (ctx2d) {
        ctx2d.fillStyle = '#666';
        ctx2d.font = '14px Inter, sans-serif';
        ctx2d.textAlign = 'center';
        ctx2d.fillText('No timeline data available', canvas.width / 2, canvas.height / 2);
      }
      return;
    }

    console.log('Drawing timeline with', stats.colorUsageRanges.length, 'ranges');

    // Only update dimensions if they changed (to avoid clearing canvas)
    const newWidth = canvas.offsetWidth;
    const newHeight = 160;

    if (canvas.width !== newWidth || canvas.height !== newHeight) {
      canvas.width = newWidth;
      canvas.height = newHeight;
    }

    // Validate dimensions
    if (canvas.width <= 0 || canvas.height <= 0) {
      console.error('Invalid canvas dimensions:', canvas.width, canvas.height);
      return;
    }

    // Background
    const isDark = document.documentElement.classList.contains('dark');
    ctx.fillStyle = isDark ? '#0F172A' : '#F8FAFC';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barHeight = 60;
    const barY = (canvas.height - barHeight) / 2;

    // Ensure we have valid totalLayers
    if (stats.totalLayers <= 0) {
      console.error('Invalid totalLayers:', stats.totalLayers);
      return;
    }

    const layerWidth = canvas.width / stats.totalLayers;

    // Draw color usage ranges with gradient effect
    stats.colorUsageRanges.forEach((range, index) => {
      const color = stats.colors.find((c) => c.id === range.colorId);
      if (!color) return;

      const x = range.startLayer * layerWidth;
      const width = (range.endLayer - range.startLayer + 1) * layerWidth;

      // Create gradient
      const gradient = ctx.createLinearGradient(x, barY, x, barY + barHeight);
      gradient.addColorStop(0, color.hexColor || '#888888');
      gradient.addColorStop(0.5, this.lightenColor(color.hexColor || '#888888', 20));
      gradient.addColorStop(1, color.hexColor || '#888888');

      ctx.fillStyle = gradient;
      ctx.fillRect(x, barY, width, barHeight);

      // Add glow effect immediately (no delay)
      ctx.save();
      ctx.globalAlpha = 0.15; // Reduced opacity for subtlety
      ctx.shadowBlur = 8;
      ctx.shadowColor = color.hexColor || '#888888';
      ctx.fillRect(x, barY, width, barHeight);
      ctx.restore();
    });

    // Border
    ctx.strokeStyle = isDark ? '#334155' : '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, barY, canvas.width, barHeight);

    // Labels
    ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Layer 0', 30, barY + barHeight + 20);
    ctx.fillText(`Layer ${stats.totalLayers}`, canvas.width - 30, barY + barHeight + 20);

    // Create interactive overlay elements
    this.createTimelineOverlay(stats, barY, barHeight, layerWidth);
  }

  private createTimelineOverlay(
    stats: GcodeStats,
    barY: number,
    barHeight: number,
    layerWidth: number
  ): void {
    const overlay = document.getElementById('timelineOverlay');
    if (!overlay) return;

    // Clear existing segments
    overlay.innerHTML = '';

    // Create clickable segments for each color range
    stats.colorUsageRanges.forEach((range: ColorRange) => {
      const color = stats.colors.find((c) => c.id === range.colorId);
      if (!color) return;

      const segment = document.createElement('div');
      segment.className = 'timeline-segment transition-all duration-200';

      // Calculate position and dimensions with minimum width for visibility
      const calculatedLeft = range.startLayer * layerWidth;
      const calculatedWidth = (range.endLayer - range.startLayer + 1) * layerWidth;
      const minWidth = 4; // Minimum 4px width for visibility and clickability
      const actualWidth = Math.max(calculatedWidth, minWidth);

      // EXPLICITLY set absolute positioning and coordinates
      segment.style.position = 'absolute';
      segment.style.left = `${calculatedLeft}px`;
      segment.style.width = `${actualWidth}px`;
      segment.style.top = `${barY}px`; // Position to match canvas bar
      segment.style.height = `${barHeight}px`; // Match canvas bar height
      segment.style.cursor = 'pointer';

      // Add data attributes
      segment.dataset.colorId = color.id;
      segment.dataset.colorName = color.name || color.id;
      segment.dataset.firstLayer = color.firstLayer.toString();
      segment.dataset.lastLayer = color.lastLayer.toString();

      // Add tooltip
      segment.title = `${color.name || color.id}\nLayers ${range.startLayer}-${range.endLayer}`;

      overlay.appendChild(segment);
    });

    // Re-attach event listeners after creating new elements
    this.attachTimelineInteractions();
  }

  private attachTimelineInteractions(): void {
    const timelineSegments = document.querySelectorAll('.timeline-segment');

    timelineSegments.forEach((segment) => {
      const el = segment as HTMLElement;

      el.addEventListener('mouseenter', () => {
        const colorId = el.dataset.colorId;
        this.highlightColor(colorId!, true);
      });

      el.addEventListener('mouseleave', () => {
        this.clearHighlights();
      });

      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const colorId = el.dataset.colorId;
        const colorName = el.dataset.colorName;
        const firstLayer = el.dataset.firstLayer;
        const lastLayer = el.dataset.lastLayer;

        if (colorId && colorName && firstLayer && lastLayer) {
          this.showColorDetails(colorId, colorName, parseInt(firstLayer), parseInt(lastLayer));
        }
      });
    });
  }

  private lightenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return (
      '#' +
      (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    );
  }

  protected cleanup(): void {
    // Clean up hologram when component is destroyed
    if (this.volumetricHologram) {
      this.volumetricHologram.destroy();
      this.volumetricHologram = null;
    }
  }
}
