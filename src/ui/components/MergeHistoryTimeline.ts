import { Component } from '../../core/Component';
import { appState } from '../../state/AppState';
import { StateSnapshot, MergeTimelineState } from '../../services/MergeHistoryManager';

export class MergeHistoryTimeline extends Component {
  private isVisible: boolean = false;
  private tooltipElement: HTMLElement | null = null;
  private storageMetrics: { totalSize: number; timelineCount: number } | null = null;

  constructor() {
    const container = document.createElement('div');
    container.id = 'mergeHistoryTimeline';
    container.className = 'merge-timeline-container hidden';
    document.body.appendChild(container);

    super('#mergeHistoryTimeline');
    this.initialize();
  }

  protected render(): void {
    const state = appState.getState();
    if (!state.stats || state.view !== 'results') {
      this.hide();
      return;
    }

    const timelineState = appState.getTimelineState();
    if (!timelineState || timelineState.snapshots.length === 0) {
      this.hide();
      return;
    }

    this.element.innerHTML = `
      <div class="glass rounded-2xl p-6 border border-white/10 bg-black/40 backdrop-blur-sm">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-white flex items-center gap-2">
            <svg class="w-5 h-5 text-vibrant-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Merge Timeline
            <span class="text-sm text-white/60 font-normal">(${timelineState.snapshots.length} states)</span>
          </h3>
          <div class="flex items-center gap-2">
            ${this.renderControls()}
            <button id="closeTimeline" class="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white/70 hover:text-white">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        <div class="mb-4">
          ${this.renderBranchSelector(timelineState)}
        </div>

        <div class="timeline-track-container relative">
          ${this.renderTimelineTrack(timelineState)}
        </div>

        <div class="mt-4 text-xs text-white/50 text-center">
          Use Ctrl+Z/Ctrl+Y for quick navigation • Click nodes to jump to any state
        </div>
      </div>
    `;

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

    const trackWidth = Math.max(600, snapshots.length * 80);
    const nodeSpacing = Math.max(60, (trackWidth - 40) / Math.max(1, snapshots.length - 1));

    return `
      <div class="timeline-track relative overflow-x-auto pb-6" style="min-height: 120px;">
        <svg width="${trackWidth}" height="100" class="timeline-svg">
          <!-- Timeline line -->
          <line x1="20" y1="50" x2="${trackWidth - 20}" y2="50" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
          
          <!-- Snapshot nodes -->
          ${snapshots
            .map((snapshot: StateSnapshot, index: number) => {
              const x = 20 + index * nodeSpacing;
              const isCurrent = index === timelineState.currentIndex;
              const isOptimal = snapshot.violationCount === 0;
              const isInitial = index === 0;

              return this.renderTimelineNode(snapshot, index, x, 50, {
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
                   style="left: ${x - 25}px; top: 70px; width: 50px;"
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
    let strokeWidth = 2;

    if (isCurrent) {
      nodeColor = '#8b5cf6';
      fillColor = 'rgba(139, 92, 246, 0.2)';
      strokeWidth = 3;
    } else if (isOptimal) {
      nodeColor = '#10b981';
      fillColor = 'rgba(16, 185, 129, 0.2)';
    } else if (snapshot.violationCount > 0) {
      nodeColor = '#f59e0b';
      fillColor = 'rgba(245, 158, 11, 0.2)';
    }

    const nodeSize = isCurrent ? 8 : 6;
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
      nodeElement += `<circle cx="${x}" cy="${y}" r="${nodeSize + 3}" 
                             fill="none" stroke="${nodeColor}" stroke-width="1" opacity="0.5"
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
    // Control buttons
    const undoBtn = this.element.querySelector('#timelineUndo');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        appState.undoLastMerge();
        this.render();
      });
    }

    const redoBtn = this.element.querySelector('#timelineRedo');
    if (redoBtn) {
      redoBtn.addEventListener('click', () => {
        appState.redoMerge();
        this.render();
      });
    }

    const resetBtn = this.element.querySelector('#timelineReset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        appState.resetToInitialState();
        this.render();
      });
    }

    // Close button
    const closeBtn = this.element.querySelector('#closeTimeline');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Branch selector
    const branchSelector = this.element.querySelector('#branchSelector') as HTMLSelectElement;
    if (branchSelector) {
      branchSelector.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        appState.switchMergeBranch(target.value);
        this.render();
      });
    }

    // Create branch button
    const createBranchBtn = this.element.querySelector('#createBranch');
    if (createBranchBtn) {
      createBranchBtn.addEventListener('click', () => this.showCreateBranchDialog());
    }

    // Export timeline button
    const exportBtn = this.element.querySelector('#exportTimeline');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportTimeline());
    }

    // Timeline node clicks
    this.element.querySelectorAll('.timeline-node').forEach((node) => {
      node.addEventListener('click', (e) => {
        const target = e.target as SVGElement;
        const snapshotId = target.getAttribute('data-snapshot-id');
        if (snapshotId) {
          appState.navigateToSnapshot(snapshotId);
          this.render();
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
        this.render();
      } else {
        alert('Branch name already exists or is invalid');
      }
    }
  }

  public async show(): Promise<void> {
    this.isVisible = true;
    this.element.classList.remove('hidden');

    // Load storage metrics
    await this.loadStorageMetrics();

    this.render();
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
    this.element.classList.add('hidden');
    this.hideTooltip();
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
