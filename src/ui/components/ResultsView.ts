import { Component } from '../../core/Component';
import { AppEvents } from '../../core/EventEmitter';
import { AppStateData } from '../../state/AppState';
import { fileStatsTemplate, colorStatsTemplate, optimizationTemplate, swapInstructionsTemplate } from '../templates';
import { animateNumber, staggerAnimation, addRippleEffect, add3DTiltEffect, addGlowHover } from '../../utils/animations';
import { VolumetricHologram } from './VolumetricHologram';

export class ResultsView extends Component {
  private exportBtn: HTMLElement;
  private newFileBtn: HTMLElement;
  private toggleDebugBtn: HTMLElement;
  private clearCacheBtn: HTMLElement;
  private volumetricHologram: VolumetricHologram | null = null;

  constructor() {
    super('#resultsSection');
    
    const exportBtn = this.element.querySelector('#exportBtn');
    const newFileBtn = this.element.querySelector('#newFileBtn');
    const toggleDebugBtn = this.element.querySelector('#toggleDebugBtn');
    const clearCacheBtn = this.element.querySelector('#clearCacheBtn');
    
    if (!exportBtn || !newFileBtn || !toggleDebugBtn || !clearCacheBtn) {
      console.error('ResultsView: Required buttons not found');
      return;
    }
    
    this.exportBtn = exportBtn as HTMLElement;
    this.newFileBtn = newFileBtn as HTMLElement;
    this.toggleDebugBtn = toggleDebugBtn as HTMLElement;
    this.clearCacheBtn = clearCacheBtn as HTMLElement;
    
    this.attachEventListeners();
    this.addMicroInteractions();
    this.initialize();
  }

  protected render(): void {
    const { view, stats, optimization } = this.state;
    
    console.log('ResultsView render:', { 
      view, 
      hasStats: !!stats, 
      hasOptimization: !!optimization,
      elementHidden: this.element.classList.contains('hidden'),
      elementHiddenAttr: this.element.hasAttribute('hidden')
    });
    
    // Show/hide based on view
    this.toggle(view === 'results');
    
    // Clean up hologram when not in results view
    if (view !== 'results' && this.volumetricHologram) {
      this.volumetricHologram.destroy();
      this.volumetricHologram = null;
    }
    
    if (view === 'results' && stats && optimization) {
      console.log('Updating results view components');
      this.updateFileName();
      this.updateFileStats();
      this.updateColorStats();
      this.updateVolumetricHologram();
      this.updateOptimization();
      this.updateSwapInstructions();
      this.drawColorTimeline();
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
    [this.exportBtn, this.newFileBtn, this.toggleDebugBtn, this.clearCacheBtn].forEach(btn => {
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
      container.innerHTML = colorStatsTemplate(this.state.stats.colors);
      
      // Stagger animation for color cards
      staggerAnimation(container, '.glass', 'animate-scale-in', 50);
      
      // Add hover effects to color swatches
      const swatches = container.querySelectorAll('.color-swatch');
      swatches.forEach((swatch) => {
        const el = swatch as HTMLElement;
        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.2) rotate(10deg)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.transform = '';
        });
      });
    }
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
    if (!this.state.stats) return;
    
    const container = document.getElementById('hologramContainer');
    if (!container) return;
    
    // Clean up existing hologram
    if (this.volumetricHologram) {
      this.volumetricHologram.destroy();
      this.volumetricHologram = null;
    }
    
    // Create new hologram with delay for smooth transition
    setTimeout(() => {
      try {
        this.volumetricHologram = new VolumetricHologram(
          '#hologramContainer',
          this.state.stats!,
          {
            enableEffects: true,
            showScanlines: true,
            showParticles: true
          },
          {
            onLayerChange: (layer: number) => {
              console.log('Hologram layer changed:', layer);
            },
            onVoxelClick: (voxel: any) => {
              console.log('Voxel clicked:', voxel);
            }
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

    const ctx = canvas.getContext('2d')!;
    const stats = this.state.stats;

    canvas.width = canvas.offsetWidth;
    canvas.height = 160;

    // Background
    const isDark = document.documentElement.classList.contains('dark');
    ctx.fillStyle = isDark ? '#0F172A' : '#F8FAFC';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barHeight = 60;
    const barY = (canvas.height - barHeight) / 2;
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
      
      // Add subtle animation by drawing with slight delay
      setTimeout(() => {
        // Add glow effect on top
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = color.hexColor || '#888888';
        ctx.fillRect(x, barY, width, barHeight);
        ctx.restore();
      }, index * 50);
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
  }

  private lightenColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16)
      .slice(1);
  }

  protected cleanup(): void {
    // Clean up hologram when component is destroyed
    if (this.volumetricHologram) {
      this.volumetricHologram.destroy();
      this.volumetricHologram = null;
    }
  }
}