import { Component } from '../../core/Component';
import { appState } from '../../state/AppState';
import { StateSnapshot, MergeTimelineState } from '../../services/MergeHistoryManager';

interface TimelineVariation {
  id: string;
  name: string;
  render: (timelineState: MergeTimelineState) => string;
  attachEvents: (container: HTMLElement) => void;
}

export class MergeHistoryTimelineVariations extends Component {
  private currentVariation: string = 'v1';
  private isVisible: boolean = false;
  private tooltipElement: HTMLElement | null = null;
  private clickOutsideHandler: ((e: MouseEvent) => void) | null = null;
  private scrollPosition: number = 0;

  private variations: TimelineVariation[] = [
    {
      id: 'original',
      name: 'Original (Current)',
      render: (state) => this.renderOriginal(state),
      attachEvents: (container) => this.attachOriginalEvents(container),
    },
    {
      id: 'v1',
      name: 'Clean Horizontal',
      render: (state) => this.renderVariation1(state),
      attachEvents: (container) => this.attachVariation1Events(container),
    },
    {
      id: 'v2',
      name: 'Enhanced Cards',
      render: (state) => this.renderVariation2(state),
      attachEvents: (container) => this.attachVariation2Events(container),
    },
    {
      id: 'v3',
      name: 'Vertical Timeline',
      render: (state) => this.renderVariation3(state),
      attachEvents: (container) => this.attachVariation3Events(container),
    },
  ];

  constructor() {
    const wrapper = document.createElement('div');
    wrapper.id = 'mergeHistoryTimelineVariations';
    document.body.appendChild(wrapper);

    super('#mergeHistoryTimelineVariations');
    this.initialize();
  }

  protected render(): void {
    if (!this.element.innerHTML) {
      this.element.innerHTML = `
        <!-- Test Buttons -->
        <div class="fixed bottom-4 right-4 z-40 flex gap-2 bg-black/80 backdrop-blur-sm rounded-lg p-3">
          <div class="text-white/60 text-sm font-medium mr-2">Timeline Tests:</div>
          ${this.variations
            .map(
              (v) => `
            <button 
              data-variation="${v.id}"
              class="variation-btn px-3 py-1 text-sm rounded ${
                v.id === this.currentVariation
                  ? 'bg-vibrant-purple text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }"
            >
              ${v.name}
            </button>
          `
            )
            .join('')}
        </div>

        <!-- Modal Container -->
        <div id="timelineModal" class="fixed inset-0 z-50 hidden opacity-0 transition-opacity duration-300">
          <div class="modal-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div class="relative z-10 flex items-center justify-center min-h-screen p-4" id="modalCentering">
            <div class="modal-content glass rounded-3xl shadow-2xl border border-white/10 max-w-5xl w-full max-h-[90vh] overflow-y-auto transform transition-transform duration-300 scale-95">
              <!-- Modal Header -->
              <div class="sticky top-0 glass rounded-t-3xl border-b border-white/10 px-8 py-6 flex justify-between items-center">
                <h2 class="text-2xl font-bold text-white flex items-center gap-3">
                  <svg class="w-8 h-8 text-vibrant-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Merge Timeline
                  <span id="timelineStateCount" class="text-sm text-white/60 font-normal"></span>
                  <span class="text-xs text-vibrant-cyan ml-2">(${this.currentVariation})</span>
                </h2>
                <button id="closeTimeline" class="text-white/60 hover:text-white transition-colors">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              
              <!-- Modal Body -->
              <div id="timelineContent" class="p-8">
                <!-- Dynamic content based on variation -->
              </div>
            </div>
          </div>
        </div>
      `;

      // Attach test button handlers
      this.element.querySelectorAll('.variation-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const variationId = (e.target as HTMLElement).getAttribute('data-variation');
          if (variationId) {
            this.switchVariation(variationId);
          }
        });
      });
    }

    this.updateTimelineContent();
  }

  private switchVariation(variationId: string): void {
    this.currentVariation = variationId;

    // Update button states
    this.element.querySelectorAll('.variation-btn').forEach((btn) => {
      const id = btn.getAttribute('data-variation');
      if (id === variationId) {
        btn.className = 'variation-btn px-3 py-1 text-sm rounded bg-vibrant-purple text-white';
      } else {
        btn.className =
          'variation-btn px-3 py-1 text-sm rounded bg-white/10 text-white/70 hover:bg-white/20';
      }
    });

    // Update variation indicator
    const indicator = this.element.querySelector('.text-vibrant-cyan');
    if (indicator) {
      indicator.textContent = `(${variationId})`;
    }

    // Re-render content
    this.updateTimelineContent();
  }

  private updateTimelineContent(): void {
    const state = appState.getState();
    if (!state.stats || state.view !== 'results') {
      return;
    }

    const timelineState = appState.getTimelineState();
    if (!timelineState || timelineState.snapshots.length === 0) {
      return;
    }

    // Update state count
    const stateCountElement = this.element.querySelector('#timelineStateCount');
    if (stateCountElement) {
      stateCountElement.textContent = `(${timelineState.snapshots.length} states)`;
    }

    // Get current variation
    const variation = this.variations.find((v) => v.id === this.currentVariation);
    if (!variation) return;

    // Render content
    const contentContainer = this.element.querySelector('#timelineContent');
    if (contentContainer) {
      contentContainer.innerHTML = variation.render(timelineState);

      // Attach events
      setTimeout(() => {
        variation.attachEvents(contentContainer as HTMLElement);
      }, 100);
    }
  }

  // ORIGINAL IMPLEMENTATION (for reference)
  private renderOriginal(timelineState: MergeTimelineState): string {
    return `
      <div class="space-y-6">
        <!-- Controls Section -->
        <div id="timelineControls" class="flex items-center justify-between">
          ${this.renderControls()}
        </div>
        
        <!-- Timeline Track -->
        <div id="timelineTrack" class="timeline-track-container relative min-h-[120px]">
          ${this.renderOriginalTrack(timelineState)}
        </div>
        
        <!-- Help Text -->
        <div class="text-xs text-white/50 text-center">
          Use Ctrl+Z/Ctrl+Y for quick navigation • Click nodes to jump to any state
        </div>
      </div>
    `;
  }

  private renderOriginalTrack(timelineState: MergeTimelineState): string {
    const snapshots = timelineState.snapshots;
    const trackWidth = Math.max(600, snapshots.length * 100);
    const nodeSpacing = Math.max(80, (trackWidth - 40) / Math.max(1, snapshots.length - 1));

    return `
      <div class="timeline-track relative overflow-x-auto pb-6" style="min-height: 160px;">
        <svg width="${trackWidth}" height="120" class="timeline-svg">
          <line x1="20" y1="40" x2="${trackWidth - 20}" y2="40" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
          ${snapshots
            .map((snapshot: StateSnapshot, index: number) => {
              const x = 20 + index * nodeSpacing;
              const isCurrent = index === timelineState.currentIndex;
              const isOptimal = snapshot.violationCount === 0;

              const nodeSize = isCurrent ? 12 : 10;
              const color = isCurrent
                ? '#8b5cf6'
                : isOptimal
                  ? '#10b981'
                  : snapshot.violationCount > 0
                    ? '#f59e0b'
                    : 'rgba(255,255,255,0.6)';

              return `
              <circle cx="${x}" cy="40" r="${nodeSize}" 
                fill="${color}20" stroke="${color}" stroke-width="${isCurrent ? 4 : 3}"
                class="timeline-node cursor-pointer hover:scale-110 transition-transform"
                data-snapshot-id="${snapshot.id}" data-index="${index}"/>
              ${
                isCurrent
                  ? `<circle cx="${x}" cy="40" r="${nodeSize + 5}" 
                fill="none" stroke="${color}" stroke-width="2" opacity="0.5"
                class="animate-ping"/>`
                  : ''
              }
            `;
            })
            .join('')}
        </svg>
        
        <div class="absolute inset-0 pointer-events-none">
          ${snapshots
            .map((snapshot: StateSnapshot, index: number) => {
              const x = 20 + index * nodeSpacing;
              return `
              <div class="absolute text-center pointer-events-auto" 
                   style="left: ${x - 30}px; top: 65px; width: 60px;"
                   data-snapshot-id="${snapshot.id}">
                <div class="text-xs text-white/70 font-medium">${snapshot.violationCount}</div>
                <div class="text-xs text-white/50">violations</div>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  // VARIATION 1: Clean Horizontal Timeline
  private renderVariation1(timelineState: MergeTimelineState): string {
    return `
      <div class="space-y-6">
        <!-- Controls -->
        <div class="flex items-center justify-between">
          ${this.renderControls()}
        </div>
        
        <!-- Timeline -->
        <div class="relative bg-white/5 rounded-xl p-6 overflow-x-auto">
          <div class="flex items-center gap-4" style="min-width: ${timelineState.snapshots.length * 120}px">
            ${timelineState.snapshots
              .map((snapshot, index) => {
                const isCurrent = index === timelineState.currentIndex;
                const isOptimal = snapshot.violationCount === 0;
                const isInitial = index === 0;

                return `
                <div class="timeline-v1-node flex flex-col items-center gap-2 cursor-pointer"
                     data-snapshot-id="${snapshot.id}" data-index="${index}">
                  <!-- Node -->
                  <div class="relative">
                    ${
                      index > 0
                        ? `
                      <div class="absolute -left-16 top-1/2 w-16 h-0.5 bg-white/20 -translate-y-1/2"></div>
                    `
                        : ''
                    }
                    
                    <div class="w-16 h-16 rounded-full flex items-center justify-center transition-all
                         ${
                           isCurrent
                             ? 'bg-vibrant-purple shadow-lg shadow-vibrant-purple/50 scale-110'
                             : isOptimal
                               ? 'bg-green-500'
                               : isInitial
                                 ? 'bg-vibrant-blue'
                                 : 'bg-amber-500/80'
                         }">
                      ${
                        isInitial
                          ? `
                        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                        </svg>
                      `
                          : isOptimal
                            ? `
                        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                      `
                            : `
                        <span class="text-white font-bold text-lg">${snapshot.violationCount}</span>
                      `
                      }
                    </div>
                    
                    ${
                      isCurrent
                        ? `
                      <div class="absolute inset-0 rounded-full bg-vibrant-purple/30 animate-pulse"></div>
                    `
                        : ''
                    }
                  </div>
                  
                  <!-- Label -->
                  <div class="text-center">
                    <div class="text-xs text-white/70 font-medium">
                      ${isInitial ? 'Start' : `State ${index + 1}`}
                    </div>
                    <div class="text-xs text-white/50">
                      ${snapshot.violationCount} violations
                    </div>
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>
        </div>
        
        <!-- Info -->
        <div class="text-center text-xs text-white/50">
          Click any state to jump • Green = Optimal • Purple = Current
        </div>
      </div>
    `;
  }

  // VARIATION 2: Enhanced Cards Timeline
  private renderVariation2(timelineState: MergeTimelineState): string {
    return `
      <div class="space-y-6">
        <!-- Controls -->
        <div class="flex items-center justify-between">
          ${this.renderControls()}
        </div>
        
        <!-- Timeline Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
          ${timelineState.snapshots
            .map((snapshot, index) => {
              const isCurrent = index === timelineState.currentIndex;
              const isOptimal = snapshot.violationCount === 0;
              const isInitial = index === 0;
              const mergeInfo = snapshot.mergeInfo;

              return `
              <div class="timeline-v2-card p-4 rounded-xl cursor-pointer transition-all
                   ${
                     isCurrent
                       ? 'bg-vibrant-purple/20 border-2 border-vibrant-purple'
                       : 'bg-white/5 border border-white/10 hover:bg-white/10'
                   }
                   ${isCurrent ? 'shadow-lg shadow-vibrant-purple/20' : ''}"
                   data-snapshot-id="${snapshot.id}" data-index="${index}">
                
                <!-- Header -->
                <div class="flex items-center justify-between mb-3">
                  <h3 class="font-semibold ${isCurrent ? 'text-vibrant-purple' : 'text-white'}">
                    ${isInitial ? 'Initial State' : `State ${index + 1}`}
                  </h3>
                  <div class="flex items-center gap-2">
                    ${
                      isOptimal
                        ? `
                      <div class="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      </div>
                    `
                        : ''
                    }
                    ${
                      isCurrent
                        ? `
                      <div class="px-2 py-1 bg-vibrant-purple rounded text-xs text-white font-medium">
                        Current
                      </div>
                    `
                        : ''
                    }
                  </div>
                </div>
                
                <!-- Stats -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-white/60">Colors:</span>
                    <span class="text-white font-medium">${snapshot.colorCount}</span>
                  </div>
                  <div class="flex items-center justify-between text-sm">
                    <span class="text-white/60">Violations:</span>
                    <span class="${snapshot.violationCount === 0 ? 'text-green-400' : 'text-amber-400'} font-medium">
                      ${snapshot.violationCount}
                    </span>
                  </div>
                  ${
                    mergeInfo
                      ? `
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-white/60">Freed slots:</span>
                      <span class="text-white font-medium">${mergeInfo.freedSlots.length}</span>
                    </div>
                  `
                      : ''
                  }
                </div>
                
                <!-- Action -->
                ${
                  mergeInfo
                    ? `
                  <div class="mt-3 pt-3 border-t border-white/10">
                    <div class="text-xs text-white/50 truncate">
                      ${mergeInfo.description}
                    </div>
                  </div>
                `
                    : ''
                }
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  // VARIATION 3: Vertical Timeline
  private renderVariation3(timelineState: MergeTimelineState): string {
    return `
      <div class="space-y-6">
        <!-- Controls -->
        <div class="flex items-center justify-between">
          ${this.renderControls()}
        </div>
        
        <!-- Vertical Timeline -->
        <div class="relative max-h-96 overflow-y-auto">
          <div class="absolute left-8 top-0 bottom-0 w-0.5 bg-white/20"></div>
          
          <div class="space-y-4 pb-4">
            ${timelineState.snapshots
              .map((snapshot, index) => {
                const isCurrent = index === timelineState.currentIndex;
                const isOptimal = snapshot.violationCount === 0;
                const isInitial = index === 0;
                const mergeInfo = snapshot.mergeInfo;

                return `
                <div class="timeline-v3-item relative flex items-center gap-4 cursor-pointer"
                     data-snapshot-id="${snapshot.id}" data-index="${index}">
                  
                  <!-- Node -->
                  <div class="relative z-10 flex-shrink-0">
                    <div class="w-16 h-16 rounded-full flex items-center justify-center
                         ${
                           isCurrent
                             ? 'bg-vibrant-purple shadow-lg shadow-vibrant-purple/50'
                             : isOptimal
                               ? 'bg-green-500'
                               : isInitial
                                 ? 'bg-vibrant-blue'
                                 : 'bg-white/10'
                         }
                         transition-all hover:scale-110">
                      ${
                        isInitial
                          ? `
                        <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                        </svg>
                      `
                          : `
                        <span class="text-white font-bold text-lg">${index + 1}</span>
                      `
                      }
                    </div>
                  </div>
                  
                  <!-- Content Card -->
                  <div class="flex-1 p-4 rounded-xl transition-all
                       ${
                         isCurrent
                           ? 'bg-vibrant-purple/20 border border-vibrant-purple'
                           : 'bg-white/5 hover:bg-white/10'
                       }">
                    <div class="flex items-start justify-between">
                      <div>
                        <h3 class="font-semibold text-white mb-1">
                          ${isInitial ? 'Initial State' : mergeInfo?.description || `State ${index + 1}`}
                        </h3>
                        <div class="flex items-center gap-4 text-sm">
                          <span class="text-white/60">
                            Colors: <span class="text-white font-medium">${snapshot.colorCount}</span>
                          </span>
                          <span class="text-white/60">
                            Violations: <span class="${snapshot.violationCount === 0 ? 'text-green-400' : 'text-amber-400'} font-medium">
                              ${snapshot.violationCount}
                            </span>
                          </span>
                          ${
                            mergeInfo
                              ? `
                            <span class="text-white/60">
                              Freed: <span class="text-white font-medium">${mergeInfo.freedSlots.length}</span>
                            </span>
                          `
                              : ''
                          }
                        </div>
                      </div>
                      ${
                        isCurrent
                          ? `
                        <div class="px-2 py-1 bg-vibrant-purple rounded text-xs text-white font-medium">
                          Current
                        </div>
                      `
                          : ''
                      }
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
  }

  // Shared controls
  private renderControls(): string {
    const canUndo = appState.canUndo();
    const canRedo = appState.canRedo();

    return `
      <div class="flex items-center gap-1 bg-white/5 rounded-lg p-1">
        <button id="timelineUndo" 
                class="p-2 rounded text-sm ${canUndo ? 'text-white hover:bg-white/20' : 'text-white/30 cursor-not-allowed'}" 
                ${!canUndo ? 'disabled' : ''}
                title="Undo (Ctrl+Z)">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path>
          </svg>
        </button>
        <button id="timelineRedo" 
                class="p-2 rounded text-sm ${canRedo ? 'text-white hover:bg-white/20' : 'text-white/30 cursor-not-allowed'}" 
                ${!canRedo ? 'disabled' : ''}
                title="Redo (Ctrl+Y)">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"></path>
          </svg>
        </button>
        <div class="w-px h-5 bg-white/20 mx-1"></div>
        <button id="timelineReset" 
                class="p-2 rounded text-sm text-white hover:bg-white/20" 
                title="Reset to initial state">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 4l6-2m-6 2l6 2m4 0l4-2m-4 2l4 2M3 20h13M3 20l6 2m-6-2l6-2m4 0l4 2m-4-2l4-2"></path>
          </svg>
        </button>
      </div>
    `;
  }

  // Event attachment methods for each variation
  private attachOriginalEvents(container: HTMLElement): void {
    this.attachCommonControls(container);

    container.querySelectorAll('.timeline-node').forEach((node) => {
      node.addEventListener('click', (e) => this.handleNodeClick(e));
      node.addEventListener('mouseenter', (e) => this.showTooltipOriginal(e as MouseEvent));
      node.addEventListener('mouseleave', () => this.hideTooltip());
    });
  }

  private attachVariation1Events(container: HTMLElement): void {
    this.attachCommonControls(container);

    container.querySelectorAll('.timeline-v1-node').forEach((node) => {
      node.addEventListener('click', (e) => this.handleNodeClick(e));
      node.addEventListener('mouseenter', (e) => this.showTooltipClean(e as MouseEvent));
      node.addEventListener('mouseleave', () => this.hideTooltip());
    });
  }

  private attachVariation2Events(container: HTMLElement): void {
    this.attachCommonControls(container);

    container.querySelectorAll('.timeline-v2-card').forEach((card) => {
      card.addEventListener('click', (e) => this.handleNodeClick(e));
    });
  }

  private attachVariation3Events(container: HTMLElement): void {
    this.attachCommonControls(container);

    container.querySelectorAll('.timeline-v3-item').forEach((item) => {
      item.addEventListener('click', (e) => this.handleNodeClick(e));
    });
  }

  private attachCommonControls(container: HTMLElement): void {
    const undoBtn = container.querySelector('#timelineUndo');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        appState.undoLastMerge();
        this.updateTimelineContent();
      });
    }

    const redoBtn = container.querySelector('#timelineRedo');
    if (redoBtn) {
      redoBtn.addEventListener('click', () => {
        appState.redoMerge();
        this.updateTimelineContent();
      });
    }

    const resetBtn = container.querySelector('#timelineReset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        appState.resetToInitialState();
        this.updateTimelineContent();
      });
    }
  }

  private handleNodeClick(e: Event): void {
    const target = e.currentTarget as HTMLElement;
    const snapshotId = target.getAttribute('data-snapshot-id');
    if (snapshotId) {
      appState.navigateToSnapshot(snapshotId);
      this.updateTimelineContent();
    }
  }

  private showTooltipOriginal(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const snapshotId = target.getAttribute('data-snapshot-id');
    if (!snapshotId) return;

    const timelineState = appState.getTimelineState();
    const snapshot = timelineState.snapshots.find((s: StateSnapshot) => s.id === snapshotId);
    if (!snapshot) return;

    this.hideTooltip();

    // Create tooltip relative to SVG container
    const svgRect = target.closest('svg')?.getBoundingClientRect();
    const nodeRect = target.getBoundingClientRect();

    if (svgRect && nodeRect) {
      this.tooltipElement = document.createElement('div');
      this.tooltipElement.className =
        'fixed z-[100] bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg p-3 text-sm pointer-events-none shadow-xl';

      // Position above the node
      const left = nodeRect.left + nodeRect.width / 2;
      const top = nodeRect.top - 10;

      this.tooltipElement.style.left = `${left}px`;
      this.tooltipElement.style.top = `${top}px`;
      this.tooltipElement.style.transform = 'translate(-50%, -100%)';

      this.tooltipElement.innerHTML = `
        <div class="text-white font-semibold mb-1">
          ${!snapshot.mergeInfo ? 'Initial State' : snapshot.mergeInfo.description || 'Merge State'}
        </div>
        <div class="text-white/70 text-xs space-y-1">
          <div>${snapshot.colorCount} colors • ${snapshot.violationCount} violations</div>
          ${snapshot.mergeInfo ? `<div>Freed ${snapshot.mergeInfo.freedSlots.length} slots</div>` : ''}
        </div>
      `;

      document.body.appendChild(this.tooltipElement);
    }
  }

  private showTooltipClean(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const snapshotId = target.getAttribute('data-snapshot-id');
    if (!snapshotId) return;

    const timelineState = appState.getTimelineState();
    const snapshot = timelineState.snapshots.find((s: StateSnapshot) => s.id === snapshotId);
    if (!snapshot) return;

    this.hideTooltip();

    const rect = target.getBoundingClientRect();

    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className =
      'fixed z-[100] bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg p-3 text-sm pointer-events-none shadow-xl';

    // Position above the node
    this.tooltipElement.style.left = `${rect.left + rect.width / 2}px`;
    this.tooltipElement.style.top = `${rect.top - 10}px`;
    this.tooltipElement.style.transform = 'translate(-50%, -100%)';

    this.tooltipElement.innerHTML = `
      <div class="text-white font-semibold mb-1">
        ${!snapshot.mergeInfo ? 'Initial State' : snapshot.mergeInfo.description || 'Merge State'}
      </div>
      <div class="text-white/70 text-xs space-y-1">
        <div>${snapshot.colorCount} colors • ${snapshot.violationCount} violations</div>
        ${snapshot.mergeInfo ? `<div>Freed ${snapshot.mergeInfo.freedSlots.length} slots</div>` : ''}
      </div>
    `;

    document.body.appendChild(this.tooltipElement);
  }

  private hideTooltip(): void {
    if (this.tooltipElement) {
      this.tooltipElement.remove();
      this.tooltipElement = null;
    }
  }

  // Modal management methods
  public async show(): Promise<void> {
    this.isVisible = true;

    // Disable body scroll
    this.scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${this.scrollPosition}px`;

    this.render();

    const modalElement = this.element.querySelector('#timelineModal');
    if (!modalElement) return;

    // Close button handler
    const closeBtn = modalElement.querySelector('#closeTimeline');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Click outside handler
    if (!this.clickOutsideHandler) {
      this.clickOutsideHandler = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (
          target.classList.contains('modal-backdrop') ||
          target.id === 'timelineModal' ||
          (target.id === 'modalCentering' && !target.closest('.modal-content'))
        ) {
          this.hide();
        }
      };

      setTimeout(() => {
        modalElement.addEventListener('click', this.clickOutsideHandler! as EventListener);
      }, 100);
    }

    modalElement.classList.remove('hidden');
    void modalElement.getBoundingClientRect();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (modalElement) {
          modalElement.classList.remove('opacity-0');
          modalElement.classList.add('opacity-100');

          const modalContent = modalElement.querySelector('.modal-content');
          if (modalContent) {
            modalContent.classList.remove('scale-95');
            modalContent.classList.add('scale-100');
          }
        }
      });
    });
  }

  public hide(): void {
    this.isVisible = false;
    this.hideTooltip();

    // Restore body scroll
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';

    // Restore scroll position
    if (this.scrollPosition) {
      window.scrollTo(0, this.scrollPosition);
    }

    const modalElement = this.element.querySelector('#timelineModal');
    if (!modalElement) return;

    modalElement.classList.remove('opacity-100');
    modalElement.classList.add('opacity-0');

    const modalContent = modalElement.querySelector('.modal-content');
    if (modalContent) {
      modalContent.classList.remove('scale-100');
      modalContent.classList.add('scale-95');
    }

    setTimeout(() => {
      if (!this.isVisible && modalElement) {
        modalElement.classList.add('hidden');
      }
    }, 300);

    if (this.clickOutsideHandler) {
      modalElement.removeEventListener('click', this.clickOutsideHandler as EventListener);
      this.clickOutsideHandler = null;
    }
  }

  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
}
