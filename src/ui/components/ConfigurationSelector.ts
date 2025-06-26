import { Component } from '../../core/Component';
import { AppEvents } from '../../core/EventEmitter';
import { SystemConfiguration } from '../../types';
import { addRippleEffect, addGlowHover } from '../../utils/animations';

export class ConfigurationSelector extends Component {
  private configType: 'ams' | 'toolhead' = 'ams';
  private unitCount: number = 1;
  private applyBtn!: HTMLElement;
  private resetBtn!: HTMLElement;
  private typeRadios!: NodeListOf<HTMLInputElement>;
  private unitInput!: HTMLInputElement;
  private previewContainer!: HTMLElement;

  constructor() {
    super('#configurationSelector');
    this.initialize();
  }

  protected render(): void {
    const { view } = this.state;

    // Show configuration selector in upload view before file selection
    this.toggle(view === 'upload');

    if (view === 'upload') {
      this.updatePreview();
    }
  }

  protected shouldUpdate(_oldState: any, _newState: any): boolean {
    return true;
  }

  protected initialize(): void {
    // Create the configuration UI
    this.element.innerHTML = `
      <div class="bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/10 mb-8">
        <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-3">
          <svg class="w-6 h-6 text-vibrant-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
          </svg>
          Hardware Configuration
        </h3>
        
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
          
          <!-- Visual Preview -->
          <div>
            <label class="block text-sm font-medium text-white/80 mb-3">Preview</label>
            <div id="configPreview" class="bg-black/30 rounded-2xl p-6 min-h-[200px] flex items-center justify-center">
              <!-- Preview will be rendered here -->
            </div>
          </div>
        </div>
        
        <!-- Info Message -->
        <div class="mt-6 p-4 bg-vibrant-blue/10 rounded-lg border border-vibrant-blue/30">
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 text-vibrant-blue mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div class="text-sm text-white/80">
              Configure your hardware setup before uploading G-code. This ensures optimal color assignment for your specific printer configuration.
            </div>
          </div>
        </div>
      </div>
    `;

    // Get references to elements
    this.applyBtn = this.element.querySelector('#applyConfig')!;
    this.resetBtn = this.element.querySelector('#resetConfig')!;
    this.typeRadios = this.element.querySelectorAll('input[name="configType"]');
    this.unitInput = this.element.querySelector('#unitCount')!;
    this.previewContainer = this.element.querySelector('#configPreview')!;

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
    // Type radio changes
    this.typeRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        this.configType = radio.value as 'ams' | 'toolhead';
        this.updateUnitInput();
        this.updatePreview();
      });
    });

    // Unit count changes
    this.unitInput.addEventListener('input', () => {
      this.unitCount = parseInt(this.unitInput.value) || 1;
      this.updateSlotInfo();
      this.updatePreview();
    });

    // Apply button
    this.applyBtn.addEventListener('click', () => {
      this.applyConfiguration();
    });

    // Reset button
    this.resetBtn.addEventListener('click', () => {
      this.resetConfiguration();
    });
  }

  private addMicroInteractions(): void {
    // Add ripple effect to buttons
    [this.applyBtn, this.resetBtn].forEach((btn) => {
      addRippleEffect(btn);
      addGlowHover(btn, 'purple');
    });
  }

  private updateUnitInput(): void {
    const label = this.element.querySelector('#unitLabel')!;

    if (this.configType === 'ams') {
      label.textContent = 'Number of AMS Units';
      this.unitInput.max = '4';
      this.unitInput.value = Math.min(this.unitCount, 4).toString();
    } else {
      label.textContent = 'Number of Toolheads';
      this.unitInput.max = '16';
    }

    this.updateSlotInfo();
  }

  private updateSlotInfo(): void {
    const slotInfo = this.element.querySelector('#slotInfo')!;
    const count = parseInt(this.unitInput.value) || 1;
    const slots = this.configType === 'ams' ? count * 4 : count;
    slotInfo.textContent = `= ${slots} total slot${slots > 1 ? 's' : ''}`;
  }

  private updatePreview(): void {
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

    this.previewContainer.innerHTML = `
      <div class="grid grid-cols-${Math.min(units, 2)} gap-4 w-full">
        ${unitsHtml}
      </div>
    `;
  }

  private renderToolheadPreview(count: number): void {
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
  }

  private resetConfiguration(): void {
    this.configType = 'ams';
    this.unitCount = 1;

    // Update UI
    const amsRadio = this.element.querySelector('input[value="ams"]') as HTMLInputElement;
    amsRadio.checked = true;
    this.unitInput.value = '1';

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
          this.unitInput.value = this.unitCount.toString();

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
    } catch (error) {
      console.error('Failed to load saved configuration:', error);
    }
  }

  private showFeedback(message: string, type: 'success' | 'info'): void {
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500/90' : 'bg-blue-500/90';

    toast.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-scale-in`;
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
