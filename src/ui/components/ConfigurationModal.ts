import { Component } from '../../core/Component';
import { AppEvents } from '../../core/EventEmitter';
import { SystemConfiguration } from '../../types';
import { addRippleEffect, addGlowHover } from '../../utils/animations';

export class ConfigurationModal extends Component {
  private configType: 'ams' | 'toolhead' = 'ams';
  private unitCount: number = 1;
  private optimizationAlgorithm: string = 'greedy';
  private isOpen: boolean = false;
  private modalElement: HTMLElement | null = null;
  private applyBtn: HTMLElement | null = null;
  private resetBtn: HTMLElement | null = null;
  private closeBtn: HTMLElement | null = null;
  private typeRadios: NodeListOf<HTMLInputElement> | null = null;
  private unitInput: HTMLInputElement | null = null;
  private previewContainer: HTMLElement | null = null;
  private algorithmSelect: HTMLSelectElement | null = null;

  constructor() {
    // Create a wrapper element that will be our component root
    const wrapper = document.createElement('div');
    wrapper.id = 'configurationModal';
    document.body.appendChild(wrapper);

    super('#configurationModal');
    this.initialize();
  }

  protected render(): void {
    // Modal doesn't need to re-render based on app state
  }

  protected shouldUpdate(_oldState: any, _newState: any): boolean {
    return false;
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  public open(): void {
    if (!this.modalElement) {
      console.error('Modal element not found');
      return;
    }

    // Load saved optimization algorithm value
    if (this.algorithmSelect) {
      this.optimizationAlgorithm = this.algorithmSelect.value;
    }

    this.isOpen = true;
    this.modalElement.classList.remove('hidden');
    // Force reflow to ensure the transition works
    void this.modalElement.offsetHeight;
    // Use double RAF for more reliable animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.modalElement.classList.add('show');
      });
    });
  }

  public close(): void {
    if (!this.modalElement) return;

    this.isOpen = false;
    this.modalElement.classList.remove('show');
    setTimeout(() => {
      if (!this.isOpen) {
        // Double-check to prevent race conditions
        this.modalElement.classList.add('hidden');
      }
    }, 300);
  }

  protected initialize(): void {
    // Create the modal structure
    this.element.innerHTML = `
      <div id="configModal" class="fixed inset-0 z-50 hidden opacity-0 transition-opacity duration-300">
        <!-- Backdrop -->
        <div class="modal-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        
        <!-- Modal Content -->
        <div class="relative z-10 flex items-center justify-center min-h-screen p-4">
          <div class="modal-content bg-gray-900/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/10 max-w-4xl w-full max-h-[90vh] overflow-y-auto transform transition-transform duration-300 scale-95">
            <!-- Modal Header -->
            <div class="sticky top-0 bg-gray-900/95 backdrop-blur-md border-b border-white/10 px-8 py-6 flex justify-between items-center">
              <h2 class="text-2xl font-bold text-white flex items-center gap-3">
                <svg class="w-8 h-8 text-vibrant-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                Configuration
              </h2>
              <button id="closeModal" class="text-white/60 hover:text-white transition-colors">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            <!-- Modal Body -->
            <div class="p-8 space-y-8">
              <!-- General Section -->
              <div>
                <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <svg class="w-5 h-5 text-vibrant-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>
                  </svg>
                  General
                </h3>
                <div class="bg-white/5 rounded-xl p-6 space-y-4">
                  <!-- Optimization Algorithm -->
                  <div>
                    <label for="modalOptimizationAlgorithm" class="block text-sm font-medium text-white/80 mb-2">
                      Optimization Algorithm
                    </label>
                    <select
                      id="modalOptimizationAlgorithm"
                      class="block w-full px-4 py-2 rounded-lg bg-gray-900 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-vibrant-blue focus:border-vibrant-blue cursor-pointer appearance-none"
                    >
                      <option value="greedy" class="bg-gray-900 text-white">Greedy (Default)</option>
                      <option value="simulatedAnnealing" class="bg-gray-900 text-white">Simulated Annealing</option>
                    </select>
                    <p class="mt-2 text-xs text-white/60">
                      Greedy: Fast, finds good solutions. Simulated Annealing: Slower, may find better solutions.
                    </p>
                  </div>
                </div>
              </div>

              <!-- Printer Section -->
              <div>
                <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <svg class="w-5 h-5 text-vibrant-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                  </svg>
                  Printer Hardware
                </h3>
                <div class="bg-white/5 rounded-xl p-6">
                  <div class="grid md:grid-cols-2 gap-8">
                    <!-- Configuration Options -->
                    <div class="space-y-6">
                      <!-- Type Selection -->
                      <div>
                        <label class="block text-sm font-medium text-white/80 mb-3">System Type</label>
                        <div class="space-y-3">
                          <label class="flex items-center p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors group">
                            <input type="radio" name="configType" value="ams" checked class="mr-3 text-vibrant-purple focus:ring-vibrant-purple">
                            <div class="flex-1">
                              <div class="font-medium text-white group-hover:text-vibrant-purple transition-colors">AMS Units</div>
                              <div class="text-sm text-white/60">Multiple Automatic Material Systems (4 slots each)</div>
                            </div>
                          </label>
                          <label class="flex items-center p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors group">
                            <input type="radio" name="configType" value="toolhead" class="mr-3 text-vibrant-purple focus:ring-vibrant-purple">
                            <div class="flex-1">
                              <div class="font-medium text-white group-hover:text-vibrant-purple transition-colors">Individual Toolheads</div>
                              <div class="text-sm text-white/60">Single-filament toolheads (1 slot each)</div>
                            </div>
                          </label>
                        </div>
                      </div>
                      
                      <!-- Unit Count -->
                      <div>
                        <label class="block text-sm font-medium text-white/80 mb-3">
                          <span id="unitLabel">Number of AMS Units</span>
                        </label>
                        <div class="flex items-center gap-4">
                          <input 
                            type="number" 
                            id="unitCount" 
                            min="1" 
                            max="4" 
                            value="1" 
                            class="w-24 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:border-vibrant-purple focus:outline-none"
                          >
                          <span class="text-sm text-white/60" id="slotInfo">= 4 total slots</span>
                        </div>
                      </div>
                    </div>
                    
                    <!-- Visual Preview -->
                    <div>
                      <label class="block text-sm font-medium text-white/80 mb-3">Preview</label>
                      <div id="configPreview" class="bg-black/30 rounded-2xl p-6 min-h-[200px] flex items-center justify-center">
                        <!-- Preview will be rendered here -->
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Action Buttons -->
              <div class="flex gap-3 pt-4">
                <button id="applyConfig" class="flex-1 btn-gradient">
                  Apply Configuration
                </button>
                <button id="resetConfig" class="btn-glass">
                  Reset to Default
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add styles for modal animations
    const style = document.createElement('style');
    style.textContent = `
      #configModal {
        pointer-events: none;
      }
      
      #configModal.show {
        opacity: 1 !important;
        pointer-events: auto;
      }
      
      #configModal.show .modal-content {
        transform: scale(1) !important;
      }
      
      #configModal:not(.hidden) {
        display: block !important;
      }
    `;
    document.head.appendChild(style);

    // Get references to elements
    this.modalElement = this.element.querySelector('#configModal');
    this.applyBtn = this.element.querySelector('#applyConfig');
    this.resetBtn = this.element.querySelector('#resetConfig');
    this.closeBtn = this.element.querySelector('#closeModal');
    this.typeRadios = this.element.querySelectorAll('input[name="configType"]');
    this.unitInput = this.element.querySelector('#unitCount');
    this.previewContainer = this.element.querySelector('#configPreview');
    this.algorithmSelect = this.element.querySelector('#modalOptimizationAlgorithm');

    // Validate required elements
    if (
      !this.modalElement ||
      !this.applyBtn ||
      !this.resetBtn ||
      !this.closeBtn ||
      !this.unitInput ||
      !this.previewContainer
    ) {
      console.error('ConfigurationModal: Failed to find required elements');
      return;
    }

    // Load saved configuration
    this.loadConfiguration();

    // Attach event listeners
    this.attachEventListeners();

    // Add animations
    this.addMicroInteractions();

    // Initial preview update
    this.updatePreview();
  }

  private attachEventListeners(): void {
    // Close button
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    // Close on backdrop click
    if (this.modalElement) {
      this.modalElement.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const modalContent = this.modalElement.querySelector('.modal-content');

        // Close if clicking on the modal wrapper or backdrop, but not on the content
        if (target === this.modalElement || target.classList.contains('modal-backdrop')) {
          this.close();
        }

        // Also close if clicking in the flex container but outside the modal content
        if (modalContent && !modalContent.contains(target) && this.modalElement.contains(target)) {
          this.close();
        }
      });
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Type radio changes
    if (this.typeRadios) {
      this.typeRadios.forEach((radio) => {
        radio.addEventListener('change', () => {
          this.configType = radio.value as 'ams' | 'toolhead';
          this.updateUnitInput();
          this.updatePreview();
        });
      });
    }

    // Unit count changes
    if (this.unitInput) {
      this.unitInput.addEventListener('input', () => {
        this.unitCount = parseInt(this.unitInput.value) || 1;
        this.updateSlotInfo();
        this.updatePreview();
      });
    }

    // Apply button
    if (this.applyBtn) {
      this.applyBtn.addEventListener('click', () => {
        this.applyConfiguration();
      });
    }

    // Reset button
    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => {
        this.resetConfiguration();
      });
    }

    // Algorithm select changes
    if (this.algorithmSelect) {
      this.algorithmSelect.addEventListener('change', () => {
        this.optimizationAlgorithm = this.algorithmSelect.value;
        // Save the selected algorithm to local storage
        localStorage.setItem('optimizationAlgorithm', this.optimizationAlgorithm);
      });
    }
  }

  private addMicroInteractions(): void {
    // Add ripple effect to buttons
    [this.applyBtn, this.resetBtn].forEach((btn) => {
      if (btn) {
        addRippleEffect(btn);
        addGlowHover(btn, 'purple');
      }
    });
  }

  private updateUnitInput(): void {
    if (!this.unitInput) return;

    const label = this.element.querySelector('#unitLabel');
    const slotInfo = this.element.querySelector('#slotInfo');

    if (this.configType === 'ams') {
      if (label) label.textContent = 'Number of AMS Units';
      this.unitInput.max = '4';
      this.unitInput.value = Math.min(this.unitCount, 4).toString();
    } else {
      if (label) label.textContent = 'Number of Toolheads';
      this.unitInput.max = '16';
    }

    this.updateSlotInfo();
  }

  private updateSlotInfo(): void {
    if (!this.unitInput) return;

    const slotInfo = this.element.querySelector('#slotInfo');
    const count = parseInt(this.unitInput.value) || 1;
    const slots = this.configType === 'ams' ? count * 4 : count;
    if (slotInfo) {
      slotInfo.textContent = `= ${slots} total slot${slots > 1 ? 's' : ''}`;
    }
  }

  private updatePreview(): void {
    if (!this.unitInput) return;

    const count = parseInt(this.unitInput.value) || 1;

    if (this.configType === 'ams') {
      this.renderAmsPreview(count);
    } else {
      this.renderToolheadPreview(count);
    }
  }

  private renderAmsPreview(units: number): void {
    const unitsHtml = Array.from(
      { length: units },
      (_, i) => `
      <div class="bg-white/5 rounded-xl p-4 border border-white/10">
        <div class="text-sm font-medium text-white/80 mb-3">AMS Unit ${i + 1}</div>
        <div class="grid grid-cols-2 gap-2">
          ${Array.from(
            { length: 4 },
            (_, j) => `
            <div class="bg-white/10 rounded-lg p-3 text-center">
              <div class="text-xs text-white/60">Slot ${j + 1}</div>
            </div>
          `
          ).join('')}
        </div>
      </div>
    `
    ).join('');

    if (this.previewContainer) {
      this.previewContainer.innerHTML = `
        <div class="grid grid-cols-${Math.min(units, 2)} gap-4 w-full">
          ${unitsHtml}
        </div>
      `;
    }
  }

  private renderToolheadPreview(count: number): void {
    if (!this.previewContainer) return;

    const cols = Math.ceil(Math.sqrt(count));
    const toolheadsHtml = Array.from(
      { length: count },
      (_, i) => `
      <div class="bg-white/10 rounded-lg p-3 text-center">
        <div class="text-xs text-white/60">T${i}</div>
      </div>
    `
    ).join('');

    this.previewContainer.innerHTML = `
      <div class="grid grid-cols-${cols} gap-2 w-full max-w-md mx-auto">
        ${toolheadsHtml}
      </div>
    `;
  }

  private applyConfiguration(): void {
    const configuration: SystemConfiguration = {
      type: this.configType,
      unitCount: this.unitCount,
      totalSlots: this.configType === 'ams' ? this.unitCount * 4 : this.unitCount,
    };

    // Save configuration
    this.saveConfiguration(configuration);

    // Emit event with configuration
    this.emit(AppEvents.CONFIGURATION_CHANGED, configuration);

    // Show success feedback
    this.showFeedback('Configuration applied successfully!', 'success');

    // Close modal after a short delay
    setTimeout(() => {
      this.close();
    }, 1000);
  }

  private resetConfiguration(): void {
    this.configType = 'ams';
    this.unitCount = 1;
    this.optimizationAlgorithm = 'greedy';

    // Update UI
    const amsRadio = this.element.querySelector('input[value="ams"]') as HTMLInputElement;
    if (amsRadio) amsRadio.checked = true;
    if (this.unitInput) this.unitInput.value = '1';
    if (this.algorithmSelect) this.algorithmSelect.value = 'greedy';

    // Sync with main dropdown
    const mainAlgorithmSelect = document.getElementById(
      'optimizationAlgorithm'
    ) as HTMLSelectElement;
    if (mainAlgorithmSelect) {
      mainAlgorithmSelect.value = 'greedy';
    }

    this.updateUnitInput();
    this.updatePreview();

    // Clear saved configuration
    localStorage.removeItem('ams-hardware-config');

    // Show feedback
    this.showFeedback('Configuration reset to default', 'info');
  }

  private saveConfiguration(config: SystemConfiguration): void {
    const data = {
      version: 1,
      hardware: config,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem('ams-hardware-config', JSON.stringify(data));
  }

  private loadConfiguration(): void {
    try {
      const saved = localStorage.getItem('ams-hardware-config');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.hardware) {
          this.configType = data.hardware.type || 'ams';
          this.unitCount = data.hardware.unitCount || 1;

          // Update UI
          const radio = this.element.querySelector(
            `input[value="${this.configType}"]`
          ) as HTMLInputElement;
          if (radio) radio.checked = true;
          if (this.unitInput) this.unitInput.value = this.unitCount.toString();

          this.updateUnitInput();

          // Apply loaded configuration to app state
          const configuration: SystemConfiguration = {
            type: this.configType,
            unitCount: this.unitCount,
            totalSlots: this.configType === 'ams' ? this.unitCount * 4 : this.unitCount,
          };
          this.emit(AppEvents.CONFIGURATION_CHANGED, configuration);
        }
      }

      // Load optimization algorithm separately
      const savedAlgorithm = localStorage.getItem('optimizationAlgorithm');
      if (savedAlgorithm && this.algorithmSelect) {
        this.algorithmSelect.value = savedAlgorithm;
        this.optimizationAlgorithm = savedAlgorithm;
      }
    } catch (error) {
      console.error('Failed to load saved configuration:', error);
    }
  }

  private showFeedback(message: string, type: 'success' | 'info'): void {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500/90' : 'bg-blue-500/90';

    toast.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg z-[60] animate-scale-in`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  public getConfiguration(): SystemConfiguration {
    return {
      type: this.configType,
      unitCount: this.unitCount,
      totalSlots: this.configType === 'ams' ? this.unitCount * 4 : this.unitCount,
    };
  }
}
