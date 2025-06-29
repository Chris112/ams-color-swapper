import { Component } from '../../core/Component';
import { appState } from '../../state/AppState';
import { Color } from '../../domain/models/Color';

export class ColorMergePanel extends Component {
  private selectedColors: string[] = []; // Changed to array to preserve order

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
              <p class="text-white/80 mb-4">Select colors to merge. The first selected color will be merged away, the second will be kept.</p>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${colors.map((color, index) => this.renderColorOption(color, index)).join('')}
              </div>
            </div>

            <div class="merge-preview-container">
              ${this.renderMergePreview(colors)}
            </div>

            <div class="flex justify-end gap-4 mt-6">
              <button id="cancelMerge" class="px-6 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors">
                Cancel
              </button>
              <button id="applyMerge" class="px-6 py-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" ${this.selectedColors.length < 2 ? 'disabled' : ''}>
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
    const isSelected = this.selectedColors.includes(color.id);
    const selectionIndex = this.selectedColors.indexOf(color.id);
    const isMergeColor = selectionIndex === 0; // First selected = merge (will be removed)
    const isKeepColor = selectionIndex === 1; // Second selected = keep (target)

    return `
      <div class="color-merge-option ${isSelected ? 'selected' : ''} ${isMergeColor ? 'merge-color' : ''} ${isKeepColor ? 'keep-color' : ''} cursor-pointer hover:bg-white/10 transition-colors rounded-lg p-4 border border-white/10 hover:border-white/20" data-color-id="${color.id}">
        <div class="flex items-center gap-4">
          <input type="checkbox" 
                 id="merge-color-${index}" 
                 class="w-5 h-5 rounded pointer-events-none" 
                 ${isSelected ? 'checked' : ''}
                 data-color-id="${color.id}">
          <div class="w-12 h-12 rounded-lg shadow-lg" style="background-color: ${color.hexValue || '#888'}"></div>
          <div class="flex-1">
            <div class="font-semibold text-white">${color.name || color.id}</div>
            <div class="text-sm text-white/60">${color.hexValue || 'No hex'}</div>
            <div class="text-xs text-white/50">Layers ${color.firstLayer + 1}-${color.lastLayer + 1}</div>
          </div>
        </div>
      </div>
    `;
  }

  private renderMergePreview(colors: Color[]): string {
    if (this.selectedColors.length < 2) {
      return '';
    }

    const selectedArray = Array.from(this.selectedColors);
    const sourceId = selectedArray[0]; // First selected = merge away
    const targetId = selectedArray[1]; // Second selected = keep
    const additionalSourceIds = selectedArray.slice(2); // Any additional selections

    const sourceColor = colors.find((c) => c.id === sourceId);
    const targetColor = colors.find((c) => c.id === targetId);
    const additionalSourceColors = colors.filter((c) => additionalSourceIds.includes(c.id));

    if (!sourceColor || !targetColor) return '';

    const allSourceColors = [sourceColor, ...additionalSourceColors];

    return `
      <div class="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
        <h3 class="text-lg font-semibold text-white mb-3">Merge Preview</h3>
        <div class="flex items-center gap-4">
          <div class="flex gap-2">
            ${allSourceColors
              .map(
                (color) => `
              <div class="text-center">
                <div class="w-16 h-16 rounded-lg shadow-lg mb-2 opacity-50" style="background-color: ${color.hexValue || '#888'}"></div>
                <div class="text-sm text-white/70">${color.name || color.id}</div>
                <div class="text-xs text-red-400">Merge Away</div>
              </div>
            `
              )
              .join('')}
          </div>
          
          <svg class="w-8 h-8 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path>
          </svg>
          
          <div class="text-center">
            <div class="w-16 h-16 rounded-lg shadow-lg mb-2" style="background-color: ${targetColor.hexValue || '#888'}"></div>
            <div class="text-sm text-white">${targetColor.name || targetColor.id}</div>
            <div class="text-xs text-green-400">Keep</div>
          </div>
        </div>
        
        <div class="mt-4 text-sm text-white/70">
          <p>${allSourceColors.length} color${allSourceColors.length > 1 ? 's' : ''} will be merged into ${targetColor.name || targetColor.id}</p>
          <p>${allSourceColors.length} slot${allSourceColors.length > 1 ? 's' : ''} will be freed for manual swaps</p>
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

    // Color card clicks - make entire card clickable
    this.element.querySelectorAll('.color-merge-option').forEach((card) => {
      card.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const colorId = target.dataset.colorId;
        if (!colorId) return;

        // Toggle selection
        if (this.selectedColors.includes(colorId)) {
          const index = this.selectedColors.indexOf(colorId);
          if (index > -1) {
            this.selectedColors.splice(index, 1);
          }
        } else {
          this.selectedColors.push(colorId);
        }

        // Update only the changed elements instead of full re-render
        this.updateCardStates();
      });
    });

    // Color selection (fallback for checkbox-only interaction)
    this.element.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const colorId = target.dataset.colorId;
        if (!colorId) return;

        if (target.checked) {
          if (!this.selectedColors.includes(colorId)) {
            this.selectedColors.push(colorId);
          }
        } else {
          const index = this.selectedColors.indexOf(colorId);
          if (index > -1) {
            this.selectedColors.splice(index, 1);
          }
        }

        this.updateCardStates();
      });
    });

    // Apply merge button
    const applyBtn = this.element.querySelector('#applyMerge');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.applyMerge());
    }
  }

  private updateCardStates(): void {
    const state = appState.getState();
    if (!state.stats || !state.stats.colors) return;

    // Update checkboxes
    this.element.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      const input = checkbox as HTMLInputElement;
      const colorId = input.dataset.colorId;
      if (colorId) {
        input.checked = this.selectedColors.includes(colorId);
      }
    });

    // Update card visual states
    this.element.querySelectorAll('.color-merge-option').forEach((card) => {
      const cardElement = card as HTMLElement;
      const colorId = cardElement.dataset.colorId;
      if (colorId) {
        const isSelected = this.selectedColors.includes(colorId);
        const selectionIndex = this.selectedColors.indexOf(colorId);
        const isMergeColor = selectionIndex === 0;
        const isKeepColor = selectionIndex === 1;

        // Update selection classes
        cardElement.classList.toggle('selected', isSelected);
        cardElement.classList.toggle('merge-color', isMergeColor);
        cardElement.classList.toggle('keep-color', isKeepColor);

        const flexContainer = cardElement.querySelector('.flex.items-center.gap-4') as HTMLElement;
        if (!flexContainer) return;

        // Update selection indicators
        const existingIndicator = flexContainer.querySelector('.selection-indicator');
        if (existingIndicator) {
          existingIndicator.remove();
        }

        if (isMergeColor || isKeepColor) {
          const indicator = document.createElement('div');
          indicator.className = 'selection-indicator text-xs font-semibold';
          if (isMergeColor) {
            indicator.className += ' text-red-400';
            indicator.textContent = 'MERGE AWAY';
          } else if (isKeepColor) {
            indicator.className += ' text-green-400';
            indicator.textContent = 'KEEP';
          }
          flexContainer.appendChild(indicator);
        }

        // Update selection number
        const existingNumber = flexContainer.querySelector('.selection-number');
        if (existingNumber) {
          existingNumber.remove();
        }

        if (isSelected && selectionIndex >= 0) {
          const numberElement = document.createElement('div');
          numberElement.className = 'selection-number text-xs text-white/60 font-semibold';
          numberElement.textContent = `#${selectionIndex + 1}`;
          flexContainer.appendChild(numberElement);
        }
      }
    });

    // Update merge preview
    const previewContainer = this.element.querySelector('.merge-preview-container');
    if (previewContainer) {
      previewContainer.innerHTML = this.renderMergePreview(state.stats.colors);
    }

    // Update apply button state
    const applyBtn = this.element.querySelector('#applyMerge') as HTMLButtonElement;
    if (applyBtn) {
      const canApply = this.selectedColors.length >= 2;
      applyBtn.disabled = !canApply;
      applyBtn.classList.toggle('disabled:opacity-50', !canApply);
      applyBtn.classList.toggle('disabled:cursor-not-allowed', !canApply);
    }
  }

  private applyMerge(): void {
    if (this.selectedColors.length < 2) return;

    const selectedArray = Array.from(this.selectedColors);
    const sourceId = selectedArray[0]; // First selected = merge away (source)
    const targetId = selectedArray[1]; // Second selected = keep (target)

    // Call the merge method on the app
    if (window.__app) {
      window.__app.mergeColors(targetId, sourceId);
    }

    this.selectedColors.length = 0;
    this.hide();
  }

  public show(): void {
    this.element.classList.remove('hidden');
    this.render();
  }

  public hide(): void {
    this.element.classList.add('hidden');
    this.selectedColors.length = 0;
  }
}
