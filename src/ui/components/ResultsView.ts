import { Component } from '../../core/Component';
import { AppEvents } from '../../core/EventEmitter';
import { AppStateData } from '../../state/AppState';
import { appState } from '../../state/AppState';
import { GcodeStats } from '../../types/gcode';
import { Color } from '../../domain/models/Color';
import { requireElement, getById, queryElement, queryElements } from '../../utils/domHelpers';
import {
  fileStatsTemplate,
  colorStatsTemplate,
  optimizationTemplate,
  swapInstructionsTemplate,
  constraintValidationTemplate,
} from '../templates';
import {
  animateNumber,
  staggerAnimation,
  addRippleEffect,
  add3DTiltEffect,
  addGlowHover,
} from '../../utils/animations';
import { formatColorDisplay } from '../../utils/colorNames';
import { formatDisplayRange, toDisplayLayer } from '../../utils/layerHelpers';
import { VolumetricHologram } from './VolumetricHologram';

interface ColorBand {
  colorId: string;
  startLayer: number;
  endLayer: number;
  row: number;
}

type TimelineView = 'color' | 'slot';

export class ResultsView extends Component {
  private exportBtn!: HTMLElement;
  private exportGcodeBtn: HTMLElement | null = null;
  private newFileBtn!: HTMLElement;
  private clearCacheBtn!: HTMLElement;
  private volumetricHologram: VolumetricHologram | null = null;
  private timelineView: TimelineView = 'color';
  private layerColorCache: Map<number, Set<string>> | null = null;
  private currentHoveredLayer: number | null = null;
  private layerTooltipUpdateTimer: number | null = null;

  constructor() {
    super('#resultsSection');

    this.exportBtn = requireElement<HTMLElement>(
      this.element,
      '#exportBtn',
      'ResultsView exportBtn'
    );
    this.exportGcodeBtn = queryElement<HTMLElement>(this.element, '#exportGcodeBtn');
    this.newFileBtn = requireElement<HTMLElement>(
      this.element,
      '#newFileBtn',
      'ResultsView newFileBtn'
    );
    this.clearCacheBtn = requireElement<HTMLElement>(
      this.element,
      '#clearCacheBtn',
      'ResultsView clearCacheBtn'
    );

    // Initialize timeline view from persistent state
    this.timelineView = appState.getState().preferences.timelineView;

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
      this.updateConstraintValidation();
      this.updateColorStats();
      // Filament usage now integrated into color stats
      // this.updateFilamentUsage();
      this.updateVolumetricHologram();
      this.updateOptimization();
      this.updateSwapInstructions();
      this.drawColorTimeline();
      this.attachTimelineToggle();

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
    if (this.clearCacheBtn) {
      this.clearCacheBtn.addEventListener('click', () => this.emit(AppEvents.CLEAR_CACHE));
    }
  }

  private updateFileName(): void {
    const fileNameElement = getById('fileName');
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
    [this.exportBtn, this.exportGcodeBtn, this.newFileBtn, this.clearCacheBtn].forEach((btn) => {
      if (btn) {
        addRippleEffect(btn);
        addGlowHover(btn, 'purple');
      }
    });
  }

  private updateFileStats(): void {
    const container = getById('fileStats');
    if (container && this.state.stats) {
      container.innerHTML = fileStatsTemplate(this.state.stats);

      // Animate numbers
      const statValues = container.querySelectorAll('.text-3xl');
      statValues.forEach((el) => {
        const text = el.textContent || '';
        const match = text.match(/^(\d+)(.*)/);
        if (match && el instanceof HTMLElement) {
          const num = parseInt(match[1]);
          const suffix = match[2] || '';
          animateNumber(el, num, 800, (value) => Math.round(value) + suffix);
        }
      });

      // Add 3D tilt to stat cards
      const cards = container.querySelectorAll('.glass');
      cards.forEach((card) => {
        if (card instanceof HTMLElement) {
          add3DTiltEffect(card, 5);
        }
      });
    }
  }

  private updateConstraintValidation(): void {
    if (!this.state.stats?.constraintValidation) return;

    const container = getById('constraintValidation');
    if (container) {
      container.innerHTML = constraintValidationTemplate(
        this.state.stats.constraintValidation,
        this.state.stats
      );
      this.attachConstraintValidationHandlers();
    } else {
      // If no dedicated container, add after file stats
      const fileStatsContainer = getById('fileStats');
      if (fileStatsContainer && this.state.stats.constraintValidation.hasViolations) {
        const constraintDiv = document.createElement('div');
        constraintDiv.id = 'constraintValidation';
        constraintDiv.innerHTML = constraintValidationTemplate(
          this.state.stats.constraintValidation,
          this.state.stats
        );

        // Insert after file stats
        fileStatsContainer.parentNode?.insertBefore(constraintDiv, fileStatsContainer.nextSibling);
        this.attachConstraintValidationHandlers();
      }
    }
  }

  private attachConstraintValidationHandlers(): void {
    // Add global functions for constraint validation interaction
    window.toggleConstraintDetails = (button: HTMLElement) => {
      const content = button.parentElement?.nextElementSibling;
      const isExpanded = button.classList.contains('expanded');

      if (content) {
        if (isExpanded) {
          content.classList.remove('expanded');
          button.classList.remove('expanded');
        } else {
          content.classList.add('expanded');
          button.classList.add('expanded');
        }
      }
    };

    window.copyToClipboard = async (button: HTMLElement, text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.style.background = 'rgba(34, 197, 94, 0.2)';

        setTimeout(() => {
          button.textContent = originalText;
          button.style.background = '';
        }, 2000);
      } catch (err) {
        button.textContent = 'Failed';
        setTimeout(() => {
          button.textContent = 'Copy';
        }, 2000);
      }
    };
  }

  private updateColorStats(): void {
    const container = getById('colorStats');
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
    const interactiveSwatches = queryElements<HTMLElement>(document, '.interactive-swatch');
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

    // Remove card click interactions since we removed all buttons
  }

  private highlightColor(colorId: string, temporary: boolean = false): void {
    // Highlight only timeline segments, not color cards
    const timelineSegments = queryElements<HTMLElement>(
      document,
      `.timeline-segment[data-color-id="${colorId}"]`
    );
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
    const highlightedElements = queryElements<HTMLElement>(document, '.timeline-segment');
    highlightedElements.forEach((el) => {
      const element = el as HTMLElement;
      if (!element.classList.contains('highlighted')) {
        element.style.filter = '';
        element.style.transform = '';
        element.style.zIndex = '';
      }
    });
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
            <span class="ml-2">${formatDisplayRange(firstLayer, lastLayer)}</span>
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
    const timeline = getById('colorTimeline');
    const segment = queryElement<HTMLElement>(document, `[data-color-id="${colorId}"]`);

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
    const container = getById('optimizationResults');
    if (container && this.state.optimization) {
      container.innerHTML = optimizationTemplate(
        this.state.optimization,
        this.state.stats || undefined
      );

      // Animate optimization numbers
      const numbers = container.querySelectorAll('.text-4xl');
      numbers.forEach((el) => {
        const text = el.textContent || '';
        const match = text.match(/^(\d+)(.*)/);
        if (match) {
          const num = parseInt(match[1]);
          const suffix = match[2] || '';
          animateNumber(el as HTMLElement, num, 1000, (value) => Math.round(value) + suffix);
        }
        el.classList.add('animate-counter');
      });

      // Slot cards now use CSS hover effects instead of JavaScript 3D tilt
    }
  }

  private updateSwapInstructions(): void {
    const container = getById('swapInstructions');
    if (container && this.state.optimization && this.state.stats) {
      container.innerHTML = swapInstructionsTemplate(
        this.state.optimization.manualSwaps,
        this.state.stats,
        this.state.optimization
      );

      // Stagger animation for swap cards
      const swapCards = container.querySelectorAll('.animate-scale-in');
      swapCards.forEach((card, index) => {
        const el = card as HTMLElement;
        el.style.animationDelay = `${index * 100}ms`;
      });

      // Add hover effect and keyboard navigation to timeline markers
      const markers = container.querySelectorAll('.timeline-marker');
      markers.forEach((marker) => {
        const el = marker as HTMLElement;
        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.5)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.transform = '';
        });

        const handleMarkerActivation = () => {
          const swapIndex = el.dataset.swapIndex;
          if (swapIndex) {
            this.scrollToSwapCard(parseInt(swapIndex));
            this.announceToScreenReader(`Navigated to swap ${parseInt(swapIndex) + 1}`);
          }
        };

        el.addEventListener('click', handleMarkerActivation);
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleMarkerActivation();
          }
        });
      });

      // Add event handlers for new interactive features
      this.attachSwapInteractionHandlers();
    }
  }

  private attachSwapInteractionHandlers(): void {
    // Progress checkboxes
    const progressCheckboxes = queryElements<HTMLInputElement>(document, '.swap-progress');
    progressCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const swapIndex = target.dataset.swapIndex;
        if (swapIndex) {
          const swapCard = queryElement<HTMLElement>(
            document,
            `.swap-card[data-swap-index="${swapIndex}"]`
          );
          if (swapCard) {
            if (target.checked) {
              swapCard.classList.add('completed');
              this.updateProgressCount();
              // Announce completion to screen readers
              this.announceToScreenReader(`Swap ${parseInt(swapIndex) + 1} marked as completed`);
            } else {
              swapCard.classList.remove('completed');
              this.updateProgressCount();
              this.announceToScreenReader(`Swap ${parseInt(swapIndex) + 1} marked as incomplete`);
            }
          }
        }
      });
    });

    // Removed copy individual swap and focus layer buttons per user request

    // Copy all swaps button
    const copyAllBtn = queryElement<HTMLElement>(document, '.copy-all-swaps');
    if (copyAllBtn) {
      copyAllBtn.addEventListener('click', () => {
        this.copyAllSwapsToClipboard();
      });
    }

    // Expand/collapse all swaps
    const expandAllBtn = queryElement<HTMLElement>(document, '.expand-all-swaps');
    if (expandAllBtn) {
      expandAllBtn.addEventListener('click', () => {
        this.toggleAllSwapDetails();
      });
    }
  }

  private scrollToSwapCard(swapIndex: number): void {
    const swapCard = queryElement<HTMLElement>(
      document,
      `.swap-card[data-swap-index="${swapIndex}"]`
    );
    if (swapCard) {
      swapCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add highlight effect
      swapCard.classList.add('animate-pulse');
      setTimeout(() => {
        swapCard.classList.remove('animate-pulse');
      }, 2000);
    }
  }

  private updateProgressCount(): void {
    const total = queryElements<HTMLInputElement>(document, '.swap-progress').length;
    const completed = queryElements<HTMLInputElement>(document, '.swap-progress:checked').length;

    // Update progress display if exists
    const progressDisplay = queryElement<HTMLElement>(document, '.swap-progress-display');
    if (progressDisplay) {
      progressDisplay.textContent = `${completed} of ${total} completed`;
    }
  }

  private copyAllSwapsToClipboard(): void {
    if (!this.state.optimization || !this.state.stats) return;

    let text = `Manual Swap Instructions for ${this.state.stats.fileName}\n`;
    text += `Total Swaps: ${this.state.optimization.manualSwaps.length}\n\n`;

    this.state.optimization.manualSwaps.forEach((swap, index) => {
      const fromColor = this.state.stats?.colors.find((c) => c.id === swap.fromColor);
      const toColor = this.state.stats?.colors.find((c) => c.id === swap.toColor);

      text += `Swap ${index + 1}:\n`;
      text += `  Pause at layer ${swap.atLayer} (Z${swap.zHeight?.toFixed(2) || 'N/A'}mm)\n`;
      text += `  Remove: ${fromColor?.name || swap.fromColor}\n`;
      text += `  Insert: ${toColor?.name || swap.toColor} → Unit ${swap.unit} Slot ${swap.slot}\n`;
      text += `  Reason: ${swap.reason}\n\n`;
    });

    navigator.clipboard
      .writeText(text)
      .then(() => {
        this.showToast('All swap instructions copied!', 'success');
      })
      .catch(() => {
        this.showToast('Failed to copy instructions', 'error');
      });
  }

  private toggleAllSwapDetails(): void {
    const allDetails = queryElements<HTMLDetailsElement>(document, '.swap-card details');
    const anyOpen = Array.from(allDetails).some((details) => details.open);

    allDetails.forEach((details) => {
      (details as HTMLDetailsElement).open = !anyOpen;
    });

    const expandBtn = queryElement<HTMLElement>(document, '.expand-all-swaps');
    if (expandBtn) {
      expandBtn.textContent = anyOpen ? 'Expand All' : 'Collapse All';
    }
  }

  private announceToScreenReader(message: string): void {
    // Create a temporary aria-live region for screen reader announcements
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement is made
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }

  private updateVolumetricHologram(): void {
    // DISABLED - Volumetric hologram feature is temporarily disabled
    return;

    if (!this.state.stats) return;

    const container = getById('hologramContainer');
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

  private buildLayerColorCache(stats: GcodeStats): void {
    this.layerColorCache = new Map();

    // Initialize all layers with empty sets
    for (let layer = 0; layer <= stats.totalLayers; layer++) {
      this.layerColorCache.set(layer, new Set());
    }

    // Populate cache with color usage
    stats.colorUsageRanges.forEach((range) => {
      for (let layer = range.startLayer; layer <= range.endLayer; layer++) {
        const layerColors = this.layerColorCache!.get(layer);
        if (layerColors) {
          layerColors.add(range.colorId);
        }
      }
    });
  }

  private drawColorTimeline(): void {
    const canvas = getById<HTMLCanvasElement>('colorTimeline');
    if (!canvas || !this.state.stats) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get canvas context');
      return;
    }

    const stats = this.state.stats;

    // Always rebuild cache when drawing timeline
    this.buildLayerColorCache(stats);

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

    // Calculate dynamic height based on view type
    let newHeight: number;
    if (this.timelineView === 'color') {
      // Color view: padding + combined row + gap + (colors * (rowHeight + gap)) + bottom padding + labels
      const rowHeight = 20;
      const rowGap = 3;
      const padding = 20;
      const bottomSpace = 40; // Space for labels
      newHeight =
        padding + rowHeight + 10 + stats.colors.length * (rowHeight + rowGap) + bottomSpace;
    } else {
      // Slot view: padding + (totalSlots * (rowHeight + gap)) + bottom padding + labels
      const totalSlots = this.state.optimization?.totalSlots || 4;
      const rowHeight = 35;
      const rowGap = 4;
      const padding = 20;
      const bottomSpace = 40; // Space for labels
      newHeight = padding + totalSlots * (rowHeight + rowGap) + bottomSpace;
    }

    // Only update dimensions if they changed (to avoid clearing canvas)
    const newWidth = canvas.offsetWidth;
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

    if (stats.totalLayers <= 0) {
      console.error('Invalid totalLayers:', stats.totalLayers);
      return;
    }

    if (this.timelineView === 'color') {
      this.drawColorView(ctx, stats, canvas, canvas.width, canvas.height);
    } else {
      this.drawSlotView(ctx, stats, canvas.width, canvas.height);
    }

    // Draw constraint violation indicators
    this.drawConstraintIndicators(canvas, stats, canvas.width, canvas.height);
  }

  private drawColorView(
    ctx: CanvasRenderingContext2D,
    stats: GcodeStats,
    canvas: HTMLCanvasElement,
    width: number,
    height: number
  ): void {
    const isDark = document.documentElement.classList.contains('dark');
    const padding = 20;
    const leftPadding = 80;
    const rightPadding = 20;
    const rowHeight = 20;
    const rowGap = 3;
    const startY = padding;
    const layerWidth = (width - leftPadding - rightPadding) / stats.totalLayers;

    // Label for combined row
    ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('All Colors', 10, startY + rowHeight / 2 + 3);

    // Draw all colors on first row (combined view)
    stats.colorUsageRanges.forEach((range) => {
      const color = stats.colors.find((c) => c.id === range.colorId);
      if (!color) return;

      // Convert internal layers to display positioning
      const displayStartLayer = toDisplayLayer(range.startLayer);
      const displayEndLayer = toDisplayLayer(range.endLayer);
      const x = leftPadding + (displayStartLayer - 1) * layerWidth; // -1 because layer 1 starts at position 0
      const segmentWidth = (displayEndLayer - displayStartLayer + 1) * layerWidth;

      ctx.fillStyle = color.hexValue || '#888888';
      ctx.fillRect(x, startY, segmentWidth, rowHeight);
    });

    // Border for combined row
    ctx.strokeStyle = isDark ? '#334155' : '#CBD5E1';
    ctx.lineWidth = 1;
    ctx.strokeRect(leftPadding, startY, width - leftPadding - rightPadding, rowHeight);

    // Draw individual color rows
    stats.colors.forEach((color, index) => {
      const y = startY + (index + 1) * (rowHeight + rowGap) + 10;

      // Color label
      ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'left';
      const label = formatColorDisplay(color.hexValue, color.name || color.id);
      const truncatedLabel = label.length > 12 ? label.substring(0, 11) + '...' : label;
      ctx.fillText(truncatedLabel, 10, y + rowHeight / 2 + 3);

      // Draw background for empty timeline
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)';
      ctx.fillRect(leftPadding, y, width - leftPadding - rightPadding, rowHeight);

      // Draw color segments for this specific color
      const colorRanges = stats.colorUsageRanges.filter((r) => r.colorId === color.id);
      colorRanges.forEach((range) => {
        // Convert internal layers to display positioning
        const displayStartLayer = toDisplayLayer(range.startLayer);
        const displayEndLayer = toDisplayLayer(range.endLayer);
        const x = leftPadding + (displayStartLayer - 1) * layerWidth; // -1 because layer 1 starts at position 0
        const segmentWidth = (displayEndLayer - displayStartLayer + 1) * layerWidth;

        // Gradient for depth
        const gradient = ctx.createLinearGradient(x, y, x, y + rowHeight);
        gradient.addColorStop(0, this.lightenColor(color.hexValue || '#888888', 10));
        gradient.addColorStop(0.5, color.hexValue || '#888888');
        gradient.addColorStop(1, this.darkenColor(color.hexValue || '#888888', 10));

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, segmentWidth, rowHeight);
      });

      // Row border
      ctx.strokeStyle = isDark ? '#334155' : '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.strokeRect(leftPadding, y, width - leftPadding - rightPadding, rowHeight);
    });

    // Labels
    ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    const labelY = startY + (stats.colors.length + 1) * (rowHeight + rowGap) + 25;
    ctx.fillText('Layer 1', leftPadding + 50, labelY);
    ctx.fillText(`Layer ${stats.totalLayers}`, width - rightPadding - 50, labelY);

    // Create overlay for color view
    this.createColorViewOverlay(stats, startY, rowHeight, rowGap, layerWidth);

    // Add timeline hover tracking
    this.attachTimelineHoverTracking(canvas, stats, leftPadding, rightPadding, layerWidth);
  }

  private drawSlotView(
    ctx: CanvasRenderingContext2D,
    stats: GcodeStats,
    width: number,
    height: number
  ): void {
    if (!this.state.optimization) return;

    const isDark = document.documentElement.classList.contains('dark');
    const padding = 20;
    const leftPadding = 80;
    const rightPadding = 20;
    const totalSlots = this.state.optimization.totalSlots || 4;
    const rowHeight = Math.min(35, (height - padding * 2 - 40) / totalSlots);
    const rowGap = 4;
    const startY = padding;
    const layerWidth = (width - leftPadding - rightPadding) / stats.totalLayers;

    // Group slots by unit and slot number
    const slotMap = new Map<string, (typeof this.state.optimization.slotAssignments)[0]>();
    this.state.optimization.slotAssignments.forEach((slot) => {
      slotMap.set(`${slot.unit}-${slot.slot}`, slot);
    });

    // Draw each slot row
    let currentRow = 0;
    const unitCount = this.state.optimization.configuration?.unitCount || 1;
    const slotsPerUnit = Math.ceil((this.state.optimization.totalSlots || 0) / unitCount);

    for (let unit = 1; unit <= unitCount; unit++) {
      for (let slot = 1; slot <= slotsPerUnit; slot++) {
        const slotAssignment = slotMap.get(`${unit}-${slot}`);
        const y = startY + currentRow * (rowHeight + rowGap);

        // Slot label
        ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Unit ${unit} Slot ${slot}`, 10, y + rowHeight / 2 + 3);

        // Draw background for empty slots
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)';
        ctx.fillRect(leftPadding, y, width - leftPadding - rightPadding, rowHeight);

        if (slotAssignment && slotAssignment.colors.length > 0) {
          // Draw colors assigned to this slot
          slotAssignment.colors.forEach((colorId, colorIndex) => {
            const color = stats.colors.find((c) => c.id === colorId);
            if (!color) return;

            const colorRanges = stats.colorUsageRanges.filter((r) => r.colorId === colorId);
            colorRanges.forEach((range) => {
              // Convert internal layers to display positioning
              const displayStartLayer = toDisplayLayer(range.startLayer);
              const displayEndLayer = toDisplayLayer(range.endLayer);
              const x = leftPadding + (displayStartLayer - 1) * layerWidth; // -1 because layer 1 starts at position 0
              const segmentWidth = (displayEndLayer - displayStartLayer + 1) * layerWidth;
              const segmentY = y + (colorIndex * rowHeight) / slotAssignment.colors.length;
              const segmentHeight = rowHeight / slotAssignment.colors.length;

              // Draw with gradient
              const gradient = ctx.createLinearGradient(x, segmentY, x, segmentY + segmentHeight);
              gradient.addColorStop(0, this.lightenColor(color.hexValue || '#888888', 10));
              gradient.addColorStop(0.5, color.hexValue || '#888888');
              gradient.addColorStop(1, this.darkenColor(color.hexValue || '#888888', 10));

              ctx.fillStyle = gradient;
              ctx.fillRect(x, segmentY, segmentWidth, segmentHeight);

              // Add divider between colors in same slot
              if (colorIndex > 0) {
                ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(leftPadding, segmentY);
                ctx.lineTo(width - rightPadding, segmentY);
                ctx.stroke();
              }
            });
          });
        }

        // Row border
        ctx.strokeStyle = isDark ? '#334155' : '#CBD5E1';
        ctx.lineWidth = 1;
        ctx.strokeRect(leftPadding, y, width - leftPadding - rightPadding, rowHeight);

        currentRow++;
      }
    }

    // Labels
    ctx.fillStyle = isDark ? '#94A3B8' : '#64748B';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    const labelY = startY + totalSlots * (rowHeight + rowGap) + 15;
    ctx.fillText('Layer 1', leftPadding + 50, labelY);
    ctx.fillText(`Layer ${stats.totalLayers}`, width - rightPadding - 50, labelY);

    // Create overlay for slot view
    this.createSlotViewOverlay(stats, startY, rowHeight, rowGap, layerWidth);
  }

  private createColorViewOverlay(
    stats: GcodeStats,
    startY: number,
    rowHeight: number,
    rowGap: number,
    layerWidth: number
  ): void {
    const overlay = getById('timelineOverlay');
    if (!overlay) return;

    // Clear existing segments
    overlay.innerHTML = '';

    // Create segments for combined view and each color row
    stats.colors.forEach((color, index) => {
      const y = startY + (index + 1) * (rowHeight + rowGap) + 10;
      const colorRanges = stats.colorUsageRanges.filter((r) => r.colorId === color.id);

      colorRanges.forEach((range) => {
        const segment = document.createElement('div');
        segment.className = 'timeline-segment transition-all duration-200';

        const leftPadding = 80;
        // Convert internal layers to display positioning
        const displayStartLayer = toDisplayLayer(range.startLayer);
        const displayEndLayer = toDisplayLayer(range.endLayer);
        const x = leftPadding + (displayStartLayer - 1) * layerWidth; // -1 because layer 1 starts at position 0
        const segmentWidth = Math.max((displayEndLayer - displayStartLayer + 1) * layerWidth, 4);

        segment.style.position = 'absolute';
        segment.style.left = `${x}px`;
        segment.style.width = `${segmentWidth}px`;
        segment.style.top = `${y}px`;
        segment.style.height = `${rowHeight}px`;
        segment.style.cursor = 'pointer';
        segment.style.borderRadius = '2px';

        // Add data attributes
        segment.dataset.colorId = color.id;
        segment.dataset.colorName = formatColorDisplay(color.hexValue, color.name || color.id);
        segment.dataset.startLayer = range.startLayer.toString();
        segment.dataset.endLayer = range.endLayer.toString();

        // Add mouse event handlers for portal tooltips
        const bandData = {
          colorId: color.id,
          startLayer: range.startLayer,
          endLayer: range.endLayer,
          row: index + 1,
        };

        segment.addEventListener('mouseenter', () => {
          this.showTooltipInPortal(color, bandData, segment);
        });

        segment.addEventListener('mouseleave', () => {
          this.hideTooltipInPortal();
        });

        overlay.appendChild(segment);
      });
    });

    // Re-attach event listeners
    this.attachTimelineInteractions();
  }

  private createSlotViewOverlay(
    stats: GcodeStats,
    startY: number,
    rowHeight: number,
    rowGap: number,
    layerWidth: number
  ): void {
    const overlay = getById('timelineOverlay');
    if (!overlay || !this.state.optimization) return;

    // Clear existing segments
    overlay.innerHTML = '';

    // Create segments for each slot's colors
    let currentRow = 0;
    const slotMap = new Map<string, (typeof this.state.optimization.slotAssignments)[0]>();
    this.state.optimization.slotAssignments.forEach((slot) => {
      slotMap.set(`${slot.unit}-${slot.slot}`, slot);
    });

    const unitCount = this.state.optimization.configuration?.unitCount || 1;
    const slotsPerUnit = Math.ceil((this.state.optimization.totalSlots || 0) / unitCount);

    for (let unit = 1; unit <= unitCount; unit++) {
      for (let slot = 1; slot <= slotsPerUnit; slot++) {
        const slotAssignment = slotMap.get(`${unit}-${slot}`);
        const y = startY + currentRow * (rowHeight + rowGap);

        if (slotAssignment && slotAssignment.colors.length > 0) {
          slotAssignment.colors.forEach((colorId, colorIndex) => {
            const color = stats.colors.find((c) => c.id === colorId);
            if (!color) return;

            const colorRanges = stats.colorUsageRanges.filter((r) => r.colorId === colorId);
            colorRanges.forEach((range) => {
              const segment = document.createElement('div');
              segment.className = 'timeline-segment transition-all duration-200';

              const leftPadding = 80;
              // Convert internal layers to display positioning
              const displayStartLayer = toDisplayLayer(range.startLayer);
              const displayEndLayer = toDisplayLayer(range.endLayer);
              const x = leftPadding + (displayStartLayer - 1) * layerWidth; // -1 because layer 1 starts at position 0
              const width = Math.max((displayEndLayer - displayStartLayer + 1) * layerWidth, 4);
              const segmentY = y + (colorIndex * rowHeight) / slotAssignment.colors.length;
              const segmentHeight = rowHeight / slotAssignment.colors.length;

              segment.style.position = 'absolute';
              segment.style.left = `${x}px`;
              segment.style.width = `${width}px`;
              segment.style.top = `${segmentY}px`;
              segment.style.height = `${segmentHeight}px`;
              segment.style.cursor = 'pointer';
              segment.style.borderRadius = '2px';

              // Add data attributes
              segment.dataset.colorId = color.id;
              segment.dataset.colorName = formatColorDisplay(
                color.hexValue,
                color.name || color.id
              );
              segment.dataset.startLayer = range.startLayer.toString();
              segment.dataset.endLayer = range.endLayer.toString();
              segment.dataset.slot = `Unit ${unit} Slot ${slot}`;

              // Add mouse event handlers for portal tooltips
              const bandData = {
                colorId: color.id,
                startLayer: range.startLayer,
                endLayer: range.endLayer,
                row: currentRow,
              };

              segment.addEventListener('mouseenter', () => {
                this.showTooltipInPortal(color, bandData, segment);
              });

              segment.addEventListener('mouseleave', () => {
                this.hideTooltipInPortal();
              });

              overlay.appendChild(segment);
            });
          });
        }
        currentRow++;
      }
    }

    // Re-attach event listeners
    this.attachTimelineInteractions();
  }

  // This method is replaced by createColorViewOverlay and createSlotViewOverlay

  private attachTimelineInteractions(): void {
    const timelineSegments = queryElements<HTMLElement>(document, '.timeline-segment');

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

  private darkenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = ((num >> 8) & 0x00ff) - amt;
    const B = (num & 0x0000ff) - amt;
    return (
      '#' +
      (0x1000000 + (R > 0 ? R : 0) * 0x10000 + (G > 0 ? G : 0) * 0x100 + (B > 0 ? B : 0))
        .toString(16)
        .slice(1)
    );
  }

  // This method is no longer needed with the new view system

  private createTooltipContent(color: Color, band: ColorBand): string {
    // Find filament usage for this color
    const filamentEstimate = this.state.stats?.filamentEstimates?.find(
      (est) => est.colorId === color.id
    );
    const weight = filamentEstimate?.weight || 0;

    return `
      <div class="p-3 bg-black/90 text-white rounded-lg shadow-xl backdrop-blur-sm border border-white/20">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-4 h-4 rounded-full" style="background-color: ${color.hexValue || '#888888'}"></div>
          <div class="font-semibold">${formatColorDisplay(color.hexValue, color.name || color.id)}</div>
        </div>
        <div class="text-sm space-y-1 text-white/80">
          <div>Layers: ${band.startLayer + 1} - ${band.endLayer + 1}</div>
          <div>Total: ${band.endLayer - band.startLayer + 1} layers</div>
          <div>Usage: ${color.usagePercentage.toFixed(1)}%</div>
          ${weight > 0 ? `<div>Weight: ${weight.toFixed(1)}g</div>` : ''}
        </div>
      </div>
    `;
  }

  private createLayerTooltipContent(layer: number): string {
    if (!this.state.stats || !this.layerColorCache) return '';

    const layerColors = this.layerColorCache.get(layer) || new Set();
    const allColors = this.state.stats.colors;

    return `
      <div class="layer-hover-tooltip bg-black/95 text-white rounded-xl shadow-2xl backdrop-blur-md border border-white/20 p-4 max-w-sm">
        <div class="tooltip-header mb-3">
          <h3 class="text-lg font-bold text-white">Layer ${layer + 1}</h3>
          <p class="text-sm text-white/60">${layerColors.size} of ${allColors.length} colors active</p>
        </div>
        
        <div class="color-grid">
          <table class="w-full">
            <tbody>
              ${allColors
                .map((color) => {
                  const isActive = layerColors.has(color.id);
                  const iconColor = isActive ? '#4ade80' : '#ef4444';
                  const icon = isActive ? '✓' : '✗';
                  const rowClass = isActive ? 'active-color-row' : 'inactive-color-row';

                  return `
                  <tr class="${rowClass} transition-all duration-200">
                    <td class="py-1 pr-2">
                      <div class="w-5 h-5 rounded-full shadow-sm ring-1 ring-white/20" 
                           style="background-color: ${color.hexValue || '#888888'}"></div>
                    </td>
                    <td class="py-1 px-2 text-sm">
                      <span class="${isActive ? 'text-white' : 'text-white/40'}">${formatColorDisplay(color.hexValue, color.name || color.id)}</span>
                    </td>
                    <td class="py-1 pl-2 text-right">
                      <span class="status-icon" style="color: ${iconColor}; font-weight: bold;">${icon}</span>
                    </td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private showTooltipInPortal(color: Color, band: ColorBand, targetElement: HTMLElement): void {
    const portal = getById('tooltipPortal');
    if (!portal) return;

    // Clear existing tooltips
    this.hideTooltipInPortal();

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'timeline-tooltip';
    tooltip.innerHTML = this.createTooltipContent(color, band);

    // Temporarily add to portal to measure dimensions
    tooltip.style.opacity = '0';
    tooltip.style.visibility = 'hidden';
    portal.appendChild(tooltip);

    // Get actual dimensions
    const tooltipRect = tooltip.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();

    // Calculate viewport boundaries with padding
    const padding = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Determine vertical position (above or below target)
    const spaceAbove = targetRect.top;
    const spaceBelow = viewportHeight - targetRect.bottom;
    const preferredSpace = tooltipRect.height + 16; // tooltip height + arrow + margin

    let useTopPosition = false;
    if (spaceBelow < preferredSpace && spaceAbove > spaceBelow) {
      useTopPosition = true;
    }

    // Calculate horizontal position (centered on target)
    const targetCenterX = targetRect.left + targetRect.width / 2;
    let left = targetCenterX - tooltipRect.width / 2;

    // Constrain to viewport with padding
    if (left < padding) {
      left = padding;
    } else if (left + tooltipRect.width > viewportWidth - padding) {
      left = viewportWidth - tooltipRect.width - padding;
    }

    // Calculate vertical position
    let top;
    if (useTopPosition) {
      top = targetRect.top - tooltipRect.height - 8;
      // Ensure it doesn't go above viewport
      if (top < padding) {
        // If there's not enough space above, try below
        if (spaceBelow >= tooltipRect.height + 16) {
          useTopPosition = false;
          top = targetRect.bottom + 8;
        } else {
          // Force it to stay in viewport
          top = padding;
        }
      }
    } else {
      top = targetRect.bottom + 8;
      // Ensure it doesn't go below viewport
      if (top + tooltipRect.height > viewportHeight - padding) {
        // If there's not enough space below, try above
        if (spaceAbove >= tooltipRect.height + 16) {
          useTopPosition = true;
          top = targetRect.top - tooltipRect.height - 8;
        } else {
          // Force it to stay in viewport
          top = viewportHeight - tooltipRect.height - padding;
        }
      }
    }

    // Apply position and visibility
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.opacity = '';
    tooltip.style.visibility = '';

    // Add positioning class for arrow direction
    tooltip.classList.add(useTopPosition ? 'position-top' : 'position-bottom');

    // Trigger show animation
    requestAnimationFrame(() => {
      tooltip.classList.add('visible');
    });
  }

  private hideTooltipInPortal(): void {
    const portal = getById('tooltipPortal');
    if (!portal) return;

    // Remove all tooltips
    portal.innerHTML = '';
  }

  private updateLayerTooltipContent(tooltip: HTMLElement, layer: number): void {
    tooltip.innerHTML = this.createLayerTooltipContent(layer);
  }

  private showLayerTooltipInPortal(layer: number, x: number, y: number): void {
    const portal = getById('tooltipPortal');
    if (!portal) return;

    // Check if layer tooltip already exists
    let tooltip = portal.querySelector('.layer-tooltip-container') as HTMLElement;

    if (tooltip) {
      // Update existing tooltip content
      this.updateLayerTooltipContent(tooltip, layer);
    } else {
      // Create new tooltip element
      tooltip = document.createElement('div');
      tooltip.className = 'layer-tooltip-container';
      tooltip.innerHTML = this.createLayerTooltipContent(layer);

      // Temporarily add to portal to measure dimensions
      tooltip.style.opacity = '0';
      tooltip.style.visibility = 'hidden';
      tooltip.style.position = 'absolute';
      portal.appendChild(tooltip);

      // Trigger show animation after positioning
      requestAnimationFrame(() => {
        tooltip!.classList.add('visible');
        tooltip!.style.opacity = '';
        tooltip!.style.visibility = '';
      });
    }

    // Get actual dimensions
    const tooltipRect = tooltip.getBoundingClientRect();

    // Calculate viewport boundaries with padding
    const padding = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Position tooltip near cursor but ensure it stays in viewport
    let left = x + 10; // Offset from cursor
    let top = y - tooltipRect.height / 2; // Center vertically on cursor

    // Adjust horizontal position if needed
    if (left + tooltipRect.width > viewportWidth - padding) {
      left = x - tooltipRect.width - 10; // Show on left side of cursor
    }
    if (left < padding) {
      left = padding;
    }

    // Adjust vertical position if needed
    if (top < padding) {
      top = padding;
    } else if (top + tooltipRect.height > viewportHeight - padding) {
      top = viewportHeight - tooltipRect.height - padding;
    }

    // Apply position
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  private attachTimelineHoverTracking(
    canvas: HTMLCanvasElement,
    stats: GcodeStats,
    leftPadding: number,
    rightPadding: number,
    layerWidth: number
  ): void {
    const overlay = getById('timelineOverlay');
    if (!overlay) return;

    // Remove existing listeners
    const newOverlay = overlay.cloneNode(false) as HTMLElement;
    overlay.parentNode?.replaceChild(newOverlay, overlay);
    newOverlay.id = 'timelineOverlay';

    // Copy child elements
    while (overlay.firstChild) {
      newOverlay.appendChild(overlay.firstChild);
    }

    // Add mouse move handler
    newOverlay.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Calculate which layer the mouse is over
      const timelineX = x - leftPadding;

      // Only show layer tooltip when hovering over the "All Colors" row (first row)
      const padding = 20;
      const rowHeight = 20;
      const startY = padding;
      const allColorsRowTop = startY;
      const allColorsRowBottom = startY + rowHeight;
      const isHoveringAllColorsRow = y >= allColorsRowTop && y <= allColorsRowBottom;

      if (
        timelineX >= 0 &&
        timelineX <= canvas.width - leftPadding - rightPadding &&
        isHoveringAllColorsRow
      ) {
        const layer = Math.floor(timelineX / layerWidth);

        if (layer >= 0 && layer <= stats.totalLayers) {
          // Debounce tooltip updates
          if (this.currentHoveredLayer !== layer) {
            this.currentHoveredLayer = layer;

            if (this.layerTooltipUpdateTimer) {
              clearTimeout(this.layerTooltipUpdateTimer);
            }

            this.layerTooltipUpdateTimer = window.setTimeout(() => {
              this.showLayerTooltipInPortal(layer, e.clientX, e.clientY);
            }, 50);
          } else if (this.currentHoveredLayer === layer) {
            // Update position if still on same layer
            const portal = getById('tooltipPortal');
            const tooltip = portal?.querySelector('.layer-tooltip-container') as HTMLElement;
            if (tooltip) {
              // Smooth position update
              const tooltipRect = tooltip.getBoundingClientRect();
              const padding = 8;
              const viewportWidth = window.innerWidth;
              const viewportHeight = window.innerHeight;

              let left = e.clientX + 10;
              let top = e.clientY - tooltipRect.height / 2;

              if (left + tooltipRect.width > viewportWidth - padding) {
                left = e.clientX - tooltipRect.width - 10;
              }
              if (left < padding) {
                left = padding;
              }

              if (top < padding) {
                top = padding;
              } else if (top + tooltipRect.height > viewportHeight - padding) {
                top = viewportHeight - tooltipRect.height - padding;
              }

              tooltip.style.left = `${left}px`;
              tooltip.style.top = `${top}px`;
            }
          }
        }
      } else {
        // Not hovering over "All Colors" row - clear any existing layer tooltip
        if (this.currentHoveredLayer !== null) {
          this.currentHoveredLayer = null;
          if (this.layerTooltipUpdateTimer) {
            clearTimeout(this.layerTooltipUpdateTimer);
          }
          // Only clear layer tooltips, not the color segment tooltips
          const portal = getById('tooltipPortal');
          const layerTooltip = portal?.querySelector('.layer-tooltip-container');
          if (layerTooltip) {
            layerTooltip.remove();
          }
        }
      }
    });

    // Add mouse leave handler
    newOverlay.addEventListener('mouseleave', () => {
      this.currentHoveredLayer = null;
      if (this.layerTooltipUpdateTimer) {
        clearTimeout(this.layerTooltipUpdateTimer);
      }
      this.hideTooltipInPortal();
    });
  }

  private attachTimelineToggle(): void {
    const colorViewBtn = getById('colorViewBtn');
    const slotViewBtn = getById('slotViewBtn');

    if (!colorViewBtn || !slotViewBtn) return;

    // Update button states based on current view
    this.updateTimelineViewButtons();

    // Remove any existing listeners by cloning
    const newColorViewBtn = colorViewBtn.cloneNode(true) as HTMLElement;
    const newSlotViewBtn = slotViewBtn.cloneNode(true) as HTMLElement;

    colorViewBtn.parentNode?.replaceChild(newColorViewBtn, colorViewBtn);
    slotViewBtn.parentNode?.replaceChild(newSlotViewBtn, slotViewBtn);

    // Add event listeners
    newColorViewBtn.addEventListener('click', () => {
      if (this.timelineView !== 'color') {
        this.timelineView = 'color';
        this.updateTimelineViewButtons();
        this.saveTimelineViewPreference();
        this.drawColorTimeline();
      }
    });

    newSlotViewBtn.addEventListener('click', () => {
      if (this.timelineView !== 'slot') {
        this.timelineView = 'slot';
        this.updateTimelineViewButtons();
        this.saveTimelineViewPreference();
        this.drawColorTimeline();
      }
    });
  }

  private updateTimelineViewButtons(): void {
    const colorViewBtn = getById('colorViewBtn');
    const slotViewBtn = getById('slotViewBtn');

    if (!colorViewBtn || !slotViewBtn) return;

    // Update active states
    if (this.timelineView === 'color') {
      colorViewBtn.classList.add('timeline-view-btn-active');
      slotViewBtn.classList.remove('timeline-view-btn-active');
    } else {
      slotViewBtn.classList.add('timeline-view-btn-active');
      colorViewBtn.classList.remove('timeline-view-btn-active');
    }
  }

  private saveTimelineViewPreference(): void {
    appState.setPreferences({ timelineView: this.timelineView });
  }

  private drawConstraintIndicators(
    canvas: HTMLCanvasElement,
    stats: GcodeStats,
    width: number,
    height: number
  ): void {
    const overlay = getById('timelineOverlay');
    if (!overlay) return;

    // Clear any existing constraint indicators
    const existingIndicators = overlay.querySelectorAll('.constraint-violation-indicator');
    existingIndicators.forEach((indicator) => indicator.remove());

    // If no violations, we're done
    if (!stats.constraintValidation?.hasViolations) return;

    const leftPadding = 80;
    const rightPadding = 20;
    const layerWidth = (width - leftPadding - rightPadding) / stats.totalLayers;

    // Create constraint violation indicators
    stats.constraintValidation.violations.forEach((range) => {
      const startX = leftPadding + range.startLayer * layerWidth;
      const endX = leftPadding + (range.endLayer + 1) * layerWidth;
      const violationWidth = endX - startX;

      // Determine violation type (critical vs suboptimal)
      const hasCritical = range.affectedLayers.some((l) => l.violationType === 'impossible');
      const violationType = hasCritical ? 'critical' : 'suboptimal';

      // Create violation indicator element
      const indicator = document.createElement('div');
      indicator.className = `constraint-violation-indicator ${violationType === 'suboptimal' ? 'suboptimal' : ''}`;
      indicator.style.left = `${startX}px`;
      indicator.style.width = `${violationWidth}px`;
      indicator.style.top = '0';
      indicator.style.height = '100%';
      indicator.style.zIndex = '15';
      indicator.style.pointerEvents = 'none';

      // Add tooltip data
      indicator.title = `${violationType === 'critical' ? 'IMPOSSIBLE' : 'SUBOPTIMAL'}: Layers ${range.startLayer + 1}-${range.endLayer + 1} require ${range.maxColorsRequired} colors but only ${range.availableSlots} slots available`;

      overlay.appendChild(indicator);
    });
  }

  protected cleanup(): void {
    // Clean up hologram when component is destroyed
    if (this.volumetricHologram) {
      this.volumetricHologram.destroy();
      this.volumetricHologram = null;
    }
  }
}
