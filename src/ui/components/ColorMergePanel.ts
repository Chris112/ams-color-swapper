import { Component } from '../../core/Component';
import { appState } from '../../state/AppState';
import { Color } from '../../domain/models/Color';

export class ColorMergePanel extends Component {
  private selectedColors: Set<string> = new Set();

  constructor() {
    const container = document.createElement('div');
    container.id = 'colorMergePanel';
    container.className = 'hidden';
    document.body.appendChild(container);
    
    super('#colorMergePanel');
    this.initialize();
  }

  protected render(): void {
    const state = appState.getState();
    if (!state.stats || state.view !== 'results') {
      this.hide();
      return;
    }

    const colors = state.stats.colors;
    if (colors.length < 2) {
      this.hide();
      return;
    }

    this.element.innerHTML = `
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in">
        <div class="flex items-center justify-center h-full p-4">
          <div class="glass rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-2xl font-bold text-white">Merge Colors</h2>
              <button id="closeMergePanel" class="text-white/70 hover:text-white">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <div class="mb-6">
              <p class="text-white/80 mb-4">Select colors to merge. The first selected color will be kept, others will be merged into it.</p>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${colors.map((color, index) => this.renderColorOption(color, index)).join('')}
              </div>
            </div>

            ${this.renderMergePreview(colors)}

            <div class="flex justify-end gap-4 mt-6">
              <button id="cancelMerge" class="px-6 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors">
                Cancel
              </button>
              <button id="applyMerge" class="px-6 py-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${this.selectedColors.size < 2 ? 'disabled' : ''}>
                Apply Merge
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private renderColorOption(color: Color, index: number): string {
    const isSelected = this.selectedColors.has(color.id);
    const isTarget = Array.from(this.selectedColors)[0] === color.id;

    return `
      <div class="color-merge-option ${isSelected ? 'selected' : ''} ${isTarget ? 'target' : ''}" data-color-id="${color.id}">
        <div class="flex items-center gap-4">
          <input type="checkbox" 
                 id="merge-color-${index}" 
                 class="w-5 h-5 rounded" 
                 ${isSelected ? 'checked' : ''}
                 data-color-id="${color.id}">
          <div class="w-12 h-12 rounded-lg shadow-lg" style="background-color: ${color.hexValue || '#888'}"></div>
          <div class="flex-1">
            <div class="font-semibold text-white">${color.name || color.id}</div>
            <div class="text-sm text-white/60">${color.hexValue || 'No hex'}</div>
            <div class="text-xs text-white/50">Layers ${color.firstLayer}-${color.lastLayer}</div>
          </div>
          ${isTarget ? '<div class="text-xs text-green-400 font-semibold">TARGET</div>' : ''}
        </div>
      </div>
    `;
  }

  private renderMergePreview(colors: Color[]): string {
    if (this.selectedColors.size < 2) {
      return '';
    }

    const selectedArray = Array.from(this.selectedColors);
    const targetId = selectedArray[0];
    const sourceIds = selectedArray.slice(1);
    
    const targetColor = colors.find(c => c.id === targetId);
    const sourceColors = colors.filter(c => sourceIds.includes(c.id));

    if (!targetColor) return '';

    return `
      <div class="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
        <h3 class="text-lg font-semibold text-white mb-3">Merge Preview</h3>
        <div class="flex items-center gap-4">
          <div class="text-center">
            <div class="w-16 h-16 rounded-lg shadow-lg mb-2" style="background-color: ${targetColor.hexValue || '#888'}"></div>
            <div class="text-sm text-white">${targetColor.name || targetColor.id}</div>
            <div class="text-xs text-green-400">Keep</div>
          </div>
          
          <svg class="w-8 h-8 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12H19M5 12L9 8M5 12L9 16M19 12L15 8M19 12L15 16"></path>
          </svg>
          
          <div class="flex gap-2">
            ${sourceColors.map(color => `
              <div class="text-center">
                <div class="w-16 h-16 rounded-lg shadow-lg mb-2 opacity-50" style="background-color: ${color.hexValue || '#888'}"></div>
                <div class="text-sm text-white/70">${color.name || color.id}</div>
                <div class="text-xs text-red-400">Merge</div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="mt-4 text-sm text-white/70">
          <p>${sourceColors.length} color${sourceColors.length > 1 ? 's' : ''} will be merged into ${targetColor.name || targetColor.id}</p>
          <p>${sourceIds.length} slot${sourceIds.length > 1 ? 's' : ''} will be freed for manual swaps</p>
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    // Close button
    const closeBtn = this.element.querySelector('#closeMergePanel');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Cancel button
    const cancelBtn = this.element.querySelector('#cancelMerge');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.hide());
    }

    // Color selection
    this.element.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const colorId = target.dataset.colorId;
        if (!colorId) return;

        if (target.checked) {
          this.selectedColors.add(colorId);
        } else {
          this.selectedColors.delete(colorId);
        }

        this.render();
      });
    });

    // Apply merge button
    const applyBtn = this.element.querySelector('#applyMerge');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.applyMerge());
    }
  }

  private applyMerge(): void {
    if (this.selectedColors.size < 2) return;

    const selectedArray = Array.from(this.selectedColors);
    const targetId = selectedArray[0];
    const sourceId = selectedArray[1]; // For now, just merge one at a time

    // Call the merge method on the app
    if (window.__app) {
      window.__app.mergeColors(targetId, sourceId);
    }

    this.selectedColors.clear();
    this.hide();
  }

  public show(): void {
    this.element.classList.remove('hidden');
    this.render();
  }

  public hide(): void {
    this.element.classList.add('hidden');
    this.selectedColors.clear();
  }
}