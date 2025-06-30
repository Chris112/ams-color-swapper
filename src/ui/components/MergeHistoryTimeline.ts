import { Component } from '../../core/Component';
import { appState } from '../../state/AppState';
import { StateSnapshot, MergeTimelineState } from '../../services/MergeHistoryManager';
import { queryElement } from '../../utils/domHelpers';

export class MergeHistoryTimeline extends Component {
  private isVisible: boolean = false;
  private tooltipElement: HTMLElement | null = null;
  private storageMetrics: { totalSize: number; timelineCount: number } | null = null;
  private clickOutsideHandler: ((e: MouseEvent) => void) | null = null;
  private scrollPosition: number = 0;

  constructor() {
    // Create a wrapper element that will be our component root
    const wrapper = document.createElement('div');
    wrapper.id = 'mergeHistoryTimeline';
    document.body.appendChild(wrapper);

    super('#mergeHistoryTimeline');
    this.initialize();
  }

  protected render(): void {
    // Create the modal structure only if it doesn't exist
    if (!this.element.innerHTML) {
      this.element.innerHTML = `
        <div id="timelineModal" class="fixed inset-0 z-50 hidden opacity-0 transition-opacity duration-300">
          <!-- Backdrop -->
          <div class="modal-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          
          <!-- Modal Content -->
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
              <div class="p-8 space-y-6">
                <!-- Controls Section -->
                <div id="timelineControls" class="flex items-center justify-between"></div>
                
                <!-- Branch Selector -->
                <div id="branchSelector"></div>
                
                <!-- Timeline Track -->
                <div id="timelineTrack" class="timeline-track-container relative min-h-[120px]"></div>
                
                <!-- Help Text -->
                <div class="text-xs text-white/50 text-center">
                  Use Ctrl+Z/Ctrl+Y for quick navigation • Click nodes to jump to any state
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Update dynamic content
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

    // Update controls
    const controlsContainer = this.element.querySelector('#timelineControls');
    if (controlsContainer) {
      controlsContainer.innerHTML = this.renderControls();
    }

    // Update branch selector
    const branchContainer = this.element.querySelector('#branchSelector');
    if (branchContainer) {
      branchContainer.innerHTML = this.renderBranchSelector(timelineState);
    }

    // Update timeline track
    const trackContainer = this.element.querySelector('#timelineTrack');
    if (trackContainer) {
      trackContainer.innerHTML = this.renderTimelineTrack(timelineState);
    }

    // Attach event listeners after content update
    this.attachEventListeners();
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

  private renderBranchSelector(timelineState: MergeTimelineState): string {
    const branches = Array.from(timelineState.branches.keys());

    if (branches.length <= 1) {
      return '';
    }

    return `
      <div class="flex items-center gap-2 text-sm">
        <span class="text-white/70">Branch:</span>
        <select id="branchSelector" class="bg-white/10 border border-white/20 rounded px-3 py-1 text-white text-sm">
          ${branches
            .map(
              (branch) => `
            <option value="${branch}" ${branch === timelineState.currentBranch ? 'selected' : ''}>${branch}</option>
          `
            )
            .join('')}
        </select>
        <button id="createBranch" class="px-3 py-1 bg-vibrant-purple rounded text-white text-sm hover:bg-vibrant-purple/80 transition-colors">
          + New Branch
        </button>
        <button id="exportTimeline" class="px-3 py-1 bg-green-600 rounded text-white text-sm hover:bg-green-700 transition-colors">
          Export
        </button>
        ${this.renderStorageInfo()}
      </div>
    `;
  }

  private renderTimelineTrack(timelineState: MergeTimelineState): string {
    const snapshots = timelineState.snapshots;
    if (snapshots.length === 0) return '';

    const trackWidth = Math.max(600, snapshots.length * 100);
    const nodeSpacing = Math.max(80, (trackWidth - 40) / Math.max(1, snapshots.length - 1));

    return `
      <div class="timeline-track relative overflow-x-auto pb-6" style="min-height: 160px;">
        <svg width="${trackWidth}" height="120" class="timeline-svg">
          <!-- Timeline line -->
          <line x1="20" y1="40" x2="${trackWidth - 20}" y2="40" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
          
          <!-- Snapshot nodes -->
          ${snapshots
            .map((snapshot: StateSnapshot, index: number) => {
              const x = 20 + index * nodeSpacing;
              const isCurrent = index === timelineState.currentIndex;
              const isOptimal = snapshot.violationCount === 0;
              const isInitial = index === 0;

              return this.renderTimelineNode(snapshot, index, x, 40, {
                isCurrent,
                isOptimal,
                isInitial,
              });
            })
            .join('')}
        </svg>
        
        <!-- Node labels and violation counts -->
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

  private renderTimelineNode(
    snapshot: StateSnapshot,
    index: number,
    x: number,
    y: number,
    flags: { isCurrent: boolean; isOptimal: boolean; isInitial: boolean }
  ): string {
    const { isCurrent, isOptimal, isInitial } = flags;

    let nodeColor = 'rgba(255,255,255,0.6)';
    let fillColor = 'rgba(255,255,255,0.1)';
    let strokeWidth = 3;

    if (isCurrent) {
      nodeColor = '#8b5cf6';
      fillColor = 'rgba(139, 92, 246, 0.2)';
      strokeWidth = 4;
    } else if (isOptimal) {
      nodeColor = '#10b981';
      fillColor = 'rgba(16, 185, 129, 0.2)';
    } else if (snapshot.violationCount > 0) {
      nodeColor = '#f59e0b';
      fillColor = 'rgba(245, 158, 11, 0.2)';
    }

    const nodeSize = isCurrent ? 12 : 10;
    const nodeType = isInitial ? 'rect' : isOptimal ? 'polygon' : 'circle';

    let nodeElement = '';
    if (nodeType === 'rect') {
      // Square for initial state
      nodeElement = `<rect x="${x - nodeSize}" y="${y - nodeSize}" 
                           width="${nodeSize * 2}" height="${nodeSize * 2}" 
                           fill="${fillColor}" stroke="${nodeColor}" stroke-width="${strokeWidth}"
                           class="timeline-node cursor-pointer hover:scale-110 transition-transform"
                           data-snapshot-id="${snapshot.id}" data-index="${index}"/>`;
    } else if (nodeType === 'polygon') {
      // Star for optimal states
      const points = this.generateStarPoints(x, y, nodeSize, 5);
      nodeElement = `<polygon points="${points}" 
                              fill="${fillColor}" stroke="${nodeColor}" stroke-width="${strokeWidth}"
                              class="timeline-node cursor-pointer hover:scale-110 transition-transform"
                              data-snapshot-id="${snapshot.id}" data-index="${index}"/>`;
    } else {
      // Circle for regular states
      nodeElement = `<circle cx="${x}" cy="${y}" r="${nodeSize}" 
                             fill="${fillColor}" stroke="${nodeColor}" stroke-width="${strokeWidth}"
                             class="timeline-node cursor-pointer hover:scale-110 transition-transform"
                             data-snapshot-id="${snapshot.id}" data-index="${index}"/>`;
    }

    // Add pulse animation for current node
    if (isCurrent) {
      nodeElement += `<circle cx="${x}" cy="${y}" r="${nodeSize + 5}" 
                             fill="none" stroke="${nodeColor}" stroke-width="2" opacity="0.5"
                             class="animate-ping"/>`;
    }

    return nodeElement;
  }

  private generateStarPoints(cx: number, cy: number, size: number, points: number): string {
    const outerRadius = size;
    const innerRadius = size * 0.4;
    const angleStep = (Math.PI * 2) / points;
    const coords: string[] = [];

    for (let i = 0; i < points * 2; i++) {
      const angle = (i * angleStep) / 2 - Math.PI / 2;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      coords.push(`${x},${y}`);
    }

    return coords.join(' ');
  }

  private attachEventListeners(): void {
    // Get the modal content container for event delegation
    const modalContent = this.element.querySelector('.modal-content');
    if (!modalContent) return;

    // Control buttons
    const undoBtn = modalContent.querySelector('#timelineUndo');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        appState.undoLastMerge();
        this.updateTimelineContent();
      });
    }

    const redoBtn = modalContent.querySelector('#timelineRedo');
    if (redoBtn) {
      redoBtn.addEventListener('click', () => {
        appState.redoMerge();
        this.updateTimelineContent();
      });
    }

    const resetBtn = modalContent.querySelector('#timelineReset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        appState.resetToInitialState();
        this.updateTimelineContent();
      });
    }

    // Close button
    const closeBtn = modalContent.querySelector('#closeTimeline');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Branch selector
    const branchSelector = queryElement<HTMLSelectElement>(modalContent, '#branchSelector select');
    if (branchSelector) {
      branchSelector.addEventListener('change', (e) => {
        const target = e.target;
        if (!target || !(target instanceof HTMLSelectElement)) return;
        appState.switchMergeBranch(target.value);
        this.updateTimelineContent();
      });
    }

    // Create branch button
    const createBranchBtn = modalContent.querySelector('#createBranch');
    if (createBranchBtn) {
      createBranchBtn.addEventListener('click', () => this.showCreateBranchDialog());
    }

    // Export timeline button
    const exportBtn = modalContent.querySelector('#exportTimeline');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportTimeline());
    }

    // Timeline node clicks
    modalContent.querySelectorAll('.timeline-node').forEach((node) => {
      node.addEventListener('click', (e) => {
        const target = e.target as SVGElement;
        const snapshotId = target.getAttribute('data-snapshot-id');
        if (snapshotId) {
          appState.navigateToSnapshot(snapshotId);
          this.updateTimelineContent();
        }
      });

      // Hover events for tooltip
      node.addEventListener('mouseenter', (e) => {
        const target = e.target as SVGElement;
        const snapshotId = target.getAttribute('data-snapshot-id');
        if (snapshotId) {
          this.showTooltip(snapshotId, e as MouseEvent);
        }
      });

      node.addEventListener('mouseleave', () => {
        this.hideTooltip();
      });
    });
  }

  private showTooltip(snapshotId: string, event: MouseEvent): void {
    const timelineState = appState.getTimelineState();
    const snapshot = timelineState.snapshots.find((s: StateSnapshot) => s.id === snapshotId);

    if (!snapshot) return;

    this.hideTooltip();

    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className =
      'timeline-tooltip absolute z-50 glass rounded-lg p-3 text-sm pointer-events-none';
    this.tooltipElement.style.left = `${event.clientX + 10}px`;
    this.tooltipElement.style.top = `${event.clientY - 50}px`;

    const isInitial = !snapshot.mergeInfo;
    const timeAgo = this.formatTimeAgo(snapshot.timestamp);

    this.tooltipElement.innerHTML = `
      <div class="text-white font-semibold mb-1">
        ${isInitial ? 'Initial State' : snapshot.mergeInfo?.description || 'Merge State'}
      </div>
      <div class="text-white/70 text-xs space-y-1">
        <div>${snapshot.colorCount} colors • ${snapshot.violationCount} violations</div>
        ${!isInitial ? `<div>Freed ${snapshot.mergeInfo?.freedSlots.length || 0} slots</div>` : ''}
        <div class="text-white/50">${timeAgo}</div>
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

  private formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }

  private showCreateBranchDialog(): void {
    const branchName = prompt('Enter branch name:');
    if (branchName && branchName.trim()) {
      const success = appState.createMergeBranch(branchName.trim());
      if (success) {
        this.updateTimelineContent();
      } else {
        alert('Branch name already exists or is invalid');
      }
    }
  }

  public async show(): Promise<void> {
    this.isVisible = true;

    // Disable body scroll while preserving scroll position
    this.scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${this.scrollPosition}px`;

    // Load storage metrics
    await this.loadStorageMetrics();

    // Ensure modal structure is rendered
    this.render();

    const modalElement = this.element.querySelector('#timelineModal');
    if (!modalElement) return;

    modalElement.classList.remove('hidden');
    // Force reflow to ensure the transition works
    void modalElement.getBoundingClientRect();

    // Use double RAF for more reliable animation
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

    // Add click outside handler
    if (!this.clickOutsideHandler) {
      this.clickOutsideHandler = (e: MouseEvent) => {
        const target = e.target as HTMLElement;

        // Check if click is on the backdrop, modal container, or centering container (but not modal content)
        if (
          target.classList.contains('modal-backdrop') ||
          target.id === 'timelineModal' ||
          (target.id === 'modalCentering' && !target.closest('.modal-content'))
        ) {
          this.hide();
        }
      };

      // Add with slight delay to prevent immediate close on open
      setTimeout(() => {
        const modalElement = this.element.querySelector('#timelineModal');
        if (modalElement) {
          modalElement.addEventListener('click', this.clickOutsideHandler! as EventListener);
        }
      }, 100);
    }
  }

  private async loadStorageMetrics(): Promise<void> {
    try {
      const timelineManager = appState.getMergeHistoryManager();
      if (timelineManager) {
        this.storageMetrics = await timelineManager.getStorageMetrics();
      }
    } catch (error) {
      console.error('Failed to load storage metrics:', error);
    }
  }

  private renderStorageInfo(): string {
    if (!this.storageMetrics) return '';

    const { totalSize } = this.storageMetrics;
    const sizeKB = (totalSize / 1024).toFixed(1);
    const sizePercent = Math.min((totalSize / (5 * 1024 * 1024)) * 100, 100); // 5MB as max

    return `
      <div class="ml-4 text-xs text-white/50">
        Storage: ${sizeKB}KB
        <div class="inline-block w-16 h-2 bg-white/10 rounded-full ml-1 align-middle">
          <div class="h-full bg-gradient-to-r from-green-500 to-amber-500 rounded-full transition-all"
               style="width: ${sizePercent}%"></div>
        </div>
      </div>
    `;
  }

  public hide(): void {
    this.isVisible = false;
    this.hideTooltip();

    // Restore body scroll
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';

    const modalElement = this.element.querySelector('#timelineModal');
    if (!modalElement) return;

    // Animate out
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

    // Remove click outside handler
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

  private exportTimeline(): void {
    try {
      const timelineManager = appState.getMergeHistoryManager();
      if (timelineManager) {
        const timelineData = timelineManager.exportTimeline();
        const blob = new Blob([timelineData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `merge-timeline-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Show success notification
        this.showNotification('Timeline exported successfully!', 'success');
      }
    } catch (error) {
      console.error('Failed to export timeline:', error);
      this.showNotification('Failed to export timeline', 'error');
    }
  }

  private showNotification(message: string, type: 'success' | 'error'): void {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 glass rounded-lg p-4 animate-fade-in ${
      type === 'success' ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'
    }`;
    notification.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-6 h-6 rounded-full flex items-center justify-center ${
          type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            ${
              type === 'success'
                ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>'
                : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>'
            }
          </svg>
        </div>
        <div class="text-white font-medium">${message}</div>
      </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('animate-fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}
