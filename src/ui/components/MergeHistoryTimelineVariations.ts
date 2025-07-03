import { Component } from '../../core/Component';
import { appState } from '../../state/AppState';
import { MergeTimelineState } from '../../services/MergeHistoryManager';

export class MergeHistoryTimelineVariations extends Component {
  private isVisible: boolean = false;
  private clickOutsideHandler: ((e: MouseEvent) => void) | null = null;
  private scrollPosition: number = 0;

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
                </h2>
                <button id="closeTimeline" class="text-white/60 hover:text-white transition-colors">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              
              <!-- Modal Body -->
              <div id="timelineContent" class="p-8">
                <!-- Dynamic content will be rendered here -->
              </div>
            </div>
          </div>
        </div>
      `;
    }

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

    // Render content
    const contentContainer = this.element.querySelector('#timelineContent');
    if (contentContainer) {
      contentContainer.innerHTML = this.renderTimeline(timelineState);

      // Attach events
      setTimeout(() => {
        this.attachTimelineEvents(contentContainer as HTMLElement);
      }, 100);
    }
  }

  private renderTimeline(timelineState: MergeTimelineState): string {
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
                <div class="timeline-item relative flex items-center gap-4 cursor-pointer"
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

  private attachTimelineEvents(container: HTMLElement): void {
    // Attach control button handlers
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

    // Attach timeline item click handlers
    container.querySelectorAll('.timeline-item').forEach((item) => {
      item.addEventListener('click', (e) => this.handleNodeClick(e));
    });
  }

  private handleNodeClick(e: Event): void {
    const target = e.currentTarget as HTMLElement;
    const snapshotId = target.getAttribute('data-snapshot-id');
    if (snapshotId) {
      appState.navigateToSnapshot(snapshotId);
      this.updateTimelineContent();
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

