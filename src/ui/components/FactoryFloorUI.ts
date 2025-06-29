import { eventBus, AppEvents } from '../../core/EventEmitter';

export class FactoryFloorUI {
  private analysisViewBtn: HTMLButtonElement | null = null;
  private factoryViewBtn: HTMLButtonElement | null = null;
  private buildSpeedSlider: HTMLInputElement | null = null;
  private buildSpeedValue: HTMLElement | null = null;
  private pauseAllBtn: HTMLButtonElement | null = null;
  private clearFactoryBtn: HTMLButtonElement | null = null;
  private initialized = false;

  constructor() {
    // Don't initialize immediately - wait for DOM elements to be available
  }

  public initialize(): void {
    if (this.initialized) return;

    this.initializeElements();
    this.attachEventListeners();
    this.initialized = true;
  }

  private initializeElements(): void {
    this.analysisViewBtn = document.getElementById('analysisViewBtn') as HTMLButtonElement;
    this.factoryViewBtn = document.getElementById('factoryViewBtn') as HTMLButtonElement;
    this.buildSpeedSlider = document.getElementById('buildSpeedSlider') as HTMLInputElement;
    this.buildSpeedValue = document.getElementById('buildSpeedValue') as HTMLElement;
    this.pauseAllBtn = document.getElementById('pauseAllBtn') as HTMLButtonElement;
    this.clearFactoryBtn = document.getElementById('clearFactoryBtn') as HTMLButtonElement;
  }

  private attachEventListeners(): void {
    // View toggle buttons
    if (this.analysisViewBtn) {
      this.analysisViewBtn.addEventListener('click', () => {
        eventBus.emit(AppEvents.VIEW_TOGGLE, 'analysis');
      });
    }

    if (this.factoryViewBtn) {
      this.factoryViewBtn.addEventListener('click', () => {
        eventBus.emit(AppEvents.VIEW_TOGGLE, 'factory');
      });
    }

    // Build speed slider
    if (this.buildSpeedSlider && this.buildSpeedValue) {
      this.buildSpeedSlider.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const speed = parseFloat(target.value);
        this.buildSpeedValue!.textContent = `${speed.toFixed(1)}x`;
        eventBus.emit(AppEvents.FACTORY_BUILD_SPEED_CHANGED, speed);
      });
    }

    // Factory control buttons
    if (this.pauseAllBtn) {
      this.pauseAllBtn.addEventListener('click', () => {
        eventBus.emit(AppEvents.FACTORY_PAUSE_ALL);
        this.updatePauseButton(true);
      });
    }

    if (this.clearFactoryBtn) {
      this.clearFactoryBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all prints from the factory floor?')) {
          eventBus.emit(AppEvents.FACTORY_CLEAR);
        }
      });
    }
  }

  private updatePauseButton(paused: boolean): void {
    if (!this.pauseAllBtn) return;

    if (paused) {
      this.pauseAllBtn.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M19 10a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        Resume All
      `;

      // Update click handler for resume
      this.pauseAllBtn.onclick = () => {
        eventBus.emit(AppEvents.FACTORY_RESUME_ALL);
        this.updatePauseButton(false);
      };
    } else {
      this.pauseAllBtn.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6"></path>
        </svg>
        Pause All
      `;

      // Restore original click handler
      this.pauseAllBtn.onclick = () => {
        eventBus.emit(AppEvents.FACTORY_PAUSE_ALL);
        this.updatePauseButton(true);
      };
    }
  }

  public showLoadingState(): void {
    const container = document.getElementById('factoryFloorContainer');
    if (container) {
      const loadingDiv = container.querySelector('.absolute');
      if (loadingDiv) {
        loadingDiv.innerHTML = `
          <div class="text-center">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-16 h-16 mx-auto mb-4 animate-spin">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            <p class="text-lg font-medium">Initializing Factory Floor...</p>
            <p class="text-sm mt-1">Setting up 3D environment</p>
          </div>
        `;
      }
    }
  }

  public hideLoadingState(): void {
    const container = document.getElementById('factoryFloorContainer');
    if (container) {
      const loadingDiv = container.querySelector('.absolute');
      if (loadingDiv) {
        loadingDiv.remove();
      }
    }
  }

  public updateFactoryStats(stats: {
    totalPrints: number;
    activePrints: number;
    completedPrints: number;
    queuedPrints: number;
  }): void {
    const statsPanel = document.getElementById('factoryStatsPanel');
    if (statsPanel) {
      statsPanel.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div class="glass rounded-lg p-4">
            <div class="text-3xl font-bold text-vibrant-blue">${stats.totalPrints}</div>
            <div class="text-sm text-white/60 mt-1">Total Prints</div>
          </div>
          <div class="glass rounded-lg p-4">
            <div class="text-3xl font-bold text-vibrant-green">${stats.activePrints}</div>
            <div class="text-sm text-white/60 mt-1">Building</div>
          </div>
          <div class="glass rounded-lg p-4">
            <div class="text-3xl font-bold text-vibrant-purple">${stats.completedPrints}</div>
            <div class="text-sm text-white/60 mt-1">Completed</div>
          </div>
          <div class="glass rounded-lg p-4">
            <div class="text-3xl font-bold text-vibrant-orange">${stats.queuedPrints}</div>
            <div class="text-sm text-white/60 mt-1">Queued</div>
          </div>
        </div>
      `;
    }
  }

  public updatePrintInfo(
    printInfo: {
      filename: string;
      layers: number;
      colors: number;
      progress: number;
      dateAdded: string;
    } | null
  ): void {
    const infoPanel = document.getElementById('printInfoPanel');
    if (!infoPanel) return;

    if (printInfo) {
      infoPanel.innerHTML = `
        <h4 class="text-lg font-semibold text-white mb-2">${printInfo.filename}</h4>
        <div class="space-y-2 text-sm text-white/70">
          <div class="flex justify-between">
            <span>Layers:</span>
            <span class="text-vibrant-cyan">${printInfo.layers}</span>
          </div>
          <div class="flex justify-between">
            <span>Colors:</span>
            <span class="text-vibrant-purple">${printInfo.colors}</span>
          </div>
          <div class="flex justify-between">
            <span>Progress:</span>
            <span class="text-vibrant-green">${Math.round(printInfo.progress * 100)}%</span>
          </div>
          <div class="flex justify-between">
            <span>Added:</span>
            <span class="text-white/50">${printInfo.dateAdded}</span>
          </div>
        </div>
        
        <!-- Progress Bar -->
        <div class="mt-3">
          <div class="w-full bg-white/20 rounded-full h-2">
            <div class="bg-gradient-to-r from-vibrant-blue to-vibrant-purple h-2 rounded-full transition-all duration-300" 
                 style="width: ${printInfo.progress * 100}%"></div>
          </div>
        </div>
      `;
      infoPanel.style.display = 'block';
    } else {
      infoPanel.style.display = 'none';
    }
  }

  public addTooltips(): void {
    // Add tooltips to factory floor controls
    const controls = [
      { id: 'analysisViewBtn', text: 'Switch to Analysis View' },
      { id: 'factoryViewBtn', text: 'Switch to Factory Floor View' },
      { id: 'pauseAllBtn', text: 'Pause/Resume all building animations' },
      { id: 'clearFactoryBtn', text: 'Remove all prints from factory floor' },
      { id: 'buildSpeedSlider', text: 'Adjust animation speed for all prints' },
    ];

    controls.forEach((control) => {
      const element = document.getElementById(control.id);
      if (element) {
        element.title = control.text;
      }
    });
  }

  public destroy(): void {
    // Remove event listeners
    if (this.analysisViewBtn) {
      this.analysisViewBtn.removeEventListener('click', () => {});
    }
    if (this.factoryViewBtn) {
      this.factoryViewBtn.removeEventListener('click', () => {});
    }
    if (this.buildSpeedSlider) {
      this.buildSpeedSlider.removeEventListener('input', () => {});
    }
    if (this.pauseAllBtn) {
      this.pauseAllBtn.removeEventListener('click', () => {});
    }
    if (this.clearFactoryBtn) {
      this.clearFactoryBtn.removeEventListener('click', () => {});
    }
  }
}
