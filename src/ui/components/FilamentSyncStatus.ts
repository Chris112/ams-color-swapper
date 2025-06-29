/**
 * Subtle sync status indicator for filament database
 * Shows progress without blocking the UI
 */

import { Component } from '../../core/Component';
import { FilamentDatabase, SyncProgress } from '../../services/FilamentDatabase';
import {
  FilamentSyncController,
  SyncStateUpdate,
  UIState,
  ButtonState,
} from '../../services/FilamentSyncController';

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));

  if (i === 0) return `${bytes} ${sizes[i]}`;

  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${sizes[i]}`;
}

export class FilamentSyncStatus extends Component {
  private filamentDb: FilamentDatabase;
  private syncController: FilamentSyncController;
  private unsubscribeSync: (() => void) | null = null;
  private unsubscribeSyncController: (() => void) | null = null;
  private syncEnabled: boolean = true;

  constructor(containerId: string) {
    super(containerId);
    this.filamentDb = FilamentDatabase.getInstance();
    this.syncController = FilamentSyncController.getInstance();
    this.initialize();
  }

  protected render(): void {
    // This component manages its own rendering
  }

  protected async initialize(): Promise<void> {
    await this.createStatusIndicator();
    this.attachEventListeners();

    // Show initializing status first
    await this.showInitializingStatus();

    // Small delay to show initializing state
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Update status
    await this.updateStatus();

    // Start auto-sync if needed and enabled
    if (this.syncEnabled) {
      // Check if database needs initial sync
      const stats = await this.filamentDb.getStats();
      if (stats.totalFilaments === 0) {
        // Use sync controller for auto-sync
        await this.syncController.startSync('auto', false);
      } else {
        // Just check for updates in background
        this.filamentDb.autoSync();
      }
    }
  }

  private async createStatusIndicator(): Promise<void> {
    // Create and append the status indicator instead of replacing body content
    const statusHTML = `
      <div id="filament-sync-status" class="fixed bottom-4 right-4 z-40 max-w-sm">
        <!-- Sync indicator (initially hidden) -->
        <div id="sync-indicator" class="hidden mb-2 p-3 glass rounded-lg border border-white/20 animate-slide-up">
          <div class="flex items-center gap-3">
            <div class="sync-spinner w-4 h-4 border-2 border-vibrant-blue border-t-transparent rounded-full animate-spin"></div>
            <div class="flex-1">
              <div class="text-sm font-medium text-white">Updating Color Database</div>
              <div class="text-xs text-white/60">
                <span id="sync-progress-text">Preparing...</span>
              </div>
            </div>
            <button id="sync-cancel" class="text-white/60 hover:text-white transition-colors" title="Cancel sync">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <div class="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
            <div id="sync-progress-bar" class="h-full bg-gradient-to-r from-vibrant-blue to-vibrant-purple transition-all duration-300" style="width: 0%"></div>
          </div>
        </div>

        <!-- Status summary (toggleable) -->
        <div id="status-summary" class="hidden p-2 glass rounded-lg border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
          <div class="flex items-center gap-2">
            <div id="status-icon" class="w-2 h-2 rounded-full bg-green-400"></div>
            <div class="text-xs text-white/70">
              <span id="status-text">Color database ready</span>
            </div>
            <div class="text-white/40">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>
        </div>

        <!-- Detailed status (expandable) -->
        <div id="status-details" class="hidden mt-2 p-3 glass rounded-lg border border-white/10">
          <div class="text-sm font-medium text-white mb-2">Filament Database</div>
          
          <!-- Sync toggle -->
          <div class="flex items-center justify-between mb-3 p-3 bg-gradient-to-r from-white/5 to-white/10 rounded-lg border border-white/10">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              <span class="text-xs font-medium text-white/80">Enable synchronization</span>
            </div>
            <label class="relative inline-flex items-center cursor-pointer group">
              <input id="sync-toggle" type="checkbox" class="sr-only peer" checked>
              <div class="w-11 h-6 bg-dark-surface/80 peer-focus:ring-2 peer-focus:ring-vibrant-blue/30 rounded-full peer 
                          peer-checked:after:translate-x-full peer-checked:after:border-white 
                          after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                          after:bg-white/80 after:rounded-full after:h-5 after:w-5 
                          after:transition-all after:duration-300 after:shadow-sm
                          peer-checked:bg-gradient-to-r peer-checked:from-vibrant-blue peer-checked:to-vibrant-purple
                          border border-white/20 peer-checked:border-vibrant-blue/50
                          group-hover:border-white/30 peer-checked:group-hover:border-vibrant-blue/70
                          transition-all duration-300"></div>
            </label>
          </div>
          
          <div class="space-y-1 text-xs text-white/70">
            <div class="flex justify-between">
              <span>Colors:</span>
              <span id="total-colors">-</span>
            </div>
            <div class="flex justify-between">
              <span>Manufacturers:</span>
              <span id="total-manufacturers">-</span>
            </div>
            <div class="flex justify-between">
              <span>Database Size:</span>
              <span id="database-size">-</span>
            </div>
            <div class="flex justify-between">
              <span>Last Updated:</span>
              <span id="last-sync">-</span>
            </div>
          </div>
          <div class="flex gap-2 mt-3">
            <button id="refresh-db" class="flex-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-white transition-colors">
              Refresh
            </button>
            <button id="clear-db" class="flex-1 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-xs text-white transition-colors">
              Clear
            </button>
            <button id="sync-db" class="flex-1 px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 rounded text-xs text-white transition-colors hidden">
              Sync
            </button>
          </div>
        </div>
      </div>
    `;

    // Create a temporary div to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = statusHTML;
    const statusIndicator = tempDiv.firstElementChild as HTMLElement;

    // Append to body instead of replacing body content
    this.element.appendChild(statusIndicator);
  }

  private attachEventListeners(): void {
    // Subscribe to sync controller state changes
    this.unsubscribeSyncController = this.syncController.subscribe((state) => {
      this.updateSyncStateUI(state);
    });

    // Also subscribe to legacy sync progress for backwards compatibility
    this.unsubscribeSync = this.filamentDb.onSyncProgress((progress) => {
      this.updateSyncIndicator(progress);
    });

    // Cancel sync button
    const cancelBtn = this.element.querySelector('#sync-cancel');
    cancelBtn?.addEventListener('click', () => {
      this.syncController.cancelSync();
    });

    // Toggle status details
    const statusSummary = this.element.querySelector('#status-summary');
    const statusDetails = this.element.querySelector('#status-details');
    let detailsVisible = false;

    statusSummary?.addEventListener('click', () => {
      detailsVisible = !detailsVisible;
      if (detailsVisible) {
        statusDetails?.classList.remove('hidden');
        this.updateDetailedStatus();
      } else {
        statusDetails?.classList.add('hidden');
      }
    });

    // Refresh database button
    const refreshBtn = this.element.querySelector('#refresh-db') as HTMLButtonElement;
    refreshBtn?.addEventListener('click', async () => {
      if (!this.syncEnabled) {
        alert('Filament synchronization is disabled. Enable it in the settings to sync.');
        return;
      }

      // Check if currently syncing - if so, this becomes a cancel button
      if (this.syncController.isSyncing() && refreshBtn.textContent === 'Cancel') {
        await this.syncController.cancelSync();
      } else {
        // Use sync controller for consistent behavior
        await this.syncController.startSync('refresh', false);
      }
    });

    // Sync database button (shown when database is empty)
    const syncBtn = this.element.querySelector('#sync-db') as HTMLButtonElement;
    syncBtn?.addEventListener('click', async () => {
      if (!this.syncEnabled) {
        alert('Filament synchronization is disabled. Enable it in the settings to sync.');
        return;
      }

      // Check if currently syncing - the controller handles this
      if (this.syncController.isSyncing()) {
        await this.syncController.cancelSync();
      } else {
        // Use sync controller for consistent behavior
        await this.syncController.startSync('manual', false);
      }
    });

    // Sync toggle
    const syncToggle = this.element.querySelector('#sync-toggle') as HTMLInputElement;
    syncToggle?.addEventListener('change', () => {
      this.syncEnabled = syncToggle.checked;
      this.updateStatus();

      // Save preference to localStorage
      localStorage.setItem('filamentSyncEnabled', this.syncEnabled.toString());
    });

    // Load saved preference
    const savedPref = localStorage.getItem('filamentSyncEnabled');
    if (savedPref !== null) {
      this.syncEnabled = savedPref === 'true';
      if (syncToggle) {
        syncToggle.checked = this.syncEnabled;
      }
    }

    // Clear database button
    const clearBtn = this.element.querySelector('#clear-db');
    clearBtn?.addEventListener('click', async () => {
      if (
        confirm('Clear all cached filament data? This will require re-downloading the database.')
      ) {
        try {
          // Disable button during operation
          clearBtn.setAttribute('disabled', 'true');
          clearBtn.textContent = 'Clearing...';

          await this.filamentDb.clearCache();

          // Wait a moment for the database to be cleared
          await new Promise((resolve) => setTimeout(resolve, 100));

          // Show success feedback
          clearBtn.textContent = 'Cleared!';
          clearBtn.classList.add('bg-green-500/20');
          clearBtn.classList.remove('bg-red-500/20');

          // Update status and buttons immediately
          await this.updateStatus();
          await this.updateDetailedStatus();

          // Remove success styling after delay
          setTimeout(() => {
            clearBtn.removeAttribute('disabled');
            clearBtn.classList.remove('bg-green-500/20');
          }, 2000);
        } catch (error) {
          console.error('Failed to clear cache:', error);
          clearBtn.textContent = 'Clear';
          clearBtn.removeAttribute('disabled');
        }
      }
    });
  }

  /**
   * Update UI based on sync controller state
   */
  private async updateSyncStateUI(state: SyncStateUpdate): Promise<void> {
    // Get database stats for context
    const stats = await this.filamentDb.getStats();

    // Get UI state with database context
    const uiState = this.syncController.getUIStateWithContext(stats, this.syncEnabled);

    // Check if the state has special UI properties
    const uiWithExtras =
      state.ui && 'showUpToDateFeedback' in state.ui
        ? {
            ...uiState,
            showUpToDateFeedback: (state.ui as { showUpToDateFeedback: boolean })
              .showUpToDateFeedback,
          }
        : uiState;

    // Update UI elements based on centralized state
    this.applyUIState(uiWithExtras);

    // Update progress if available
    if (state.progress) {
      const progressBar = this.element.querySelector('#sync-progress-bar') as HTMLElement;
      if (progressBar) {
        progressBar.style.width = `${Math.max(state.progress.percentage, 5)}%`;
      }
    }
  }

  /**
   * Apply UI state to DOM elements
   */
  private applyUIState(uiState: UIState & { showUpToDateFeedback?: boolean }): void {
    const syncBtn = this.element.querySelector('#sync-db') as HTMLButtonElement;
    const refreshBtn = this.element.querySelector('#refresh-db') as HTMLButtonElement;
    const clearBtn = this.element.querySelector('#clear-db') as HTMLButtonElement;
    const indicator = this.element.querySelector('#sync-indicator');
    const progressText = this.element.querySelector('#sync-progress-text');
    const statusSummary = this.element.querySelector('#status-summary');
    const statusIcon = this.element.querySelector('#status-icon') as HTMLElement;
    const statusText = this.element.querySelector('#status-text');

    // Update progress indicator visibility
    if (uiState.showProgress) {
      indicator?.classList.remove('hidden');
      statusSummary?.classList.add('hidden');
      if (progressText && uiState.progressText) {
        progressText.textContent = uiState.progressText;
      }
    } else {
      indicator?.classList.add('hidden');
      statusSummary?.classList.remove('hidden');
    }

    // Update status message and icon
    if (statusText) {
      statusText.textContent = uiState.statusMessage;
    }
    if (statusIcon) {
      statusIcon.className = this.getIconClass(uiState.statusIcon);
    }

    // Apply button states
    this.applyButtonState(syncBtn, uiState.buttons.sync);
    this.applyButtonState(refreshBtn, uiState.buttons.refresh);
    this.applyButtonState(clearBtn, uiState.buttons.clear);

    // Special handling for "up to date" feedback
    if (uiState.showUpToDateFeedback && refreshBtn && !refreshBtn.classList.contains('hidden')) {
      refreshBtn.textContent = 'Up to date!';
      refreshBtn.classList.add('bg-green-500/20');
      refreshBtn.classList.remove('bg-white/10');
      setTimeout(() => {
        refreshBtn.textContent = 'Refresh';
        refreshBtn.classList.remove('bg-green-500/20');
        refreshBtn.classList.add('bg-white/10');
      }, 2000);
    }
  }

  /**
   * Apply button state to a button element
   */
  private applyButtonState(button: HTMLButtonElement | null, state: ButtonState): void {
    if (!button) return;

    // Visibility
    if (state.visible) {
      button.classList.remove('hidden');
    } else {
      button.classList.add('hidden');
      return; // No need to update other properties if hidden
    }

    // Enabled state
    if (state.enabled) {
      button.removeAttribute('disabled');
    } else {
      button.setAttribute('disabled', 'true');
    }

    // Text
    button.textContent = state.text;

    // Style
    button.className = button.className.replace(/bg-\S+\/20|hover:bg-\S+\/30/g, '').trim();

    switch (state.style) {
      case 'primary':
        button.classList.add('bg-blue-500/20', 'hover:bg-blue-500/30');
        break;
      case 'danger':
        button.classList.add('bg-red-500/20', 'hover:bg-red-500/30');
        break;
      case 'success':
        button.classList.add('bg-green-500/20', 'hover:bg-green-500/30');
        break;
      case 'default':
        button.classList.add('bg-white/10', 'hover:bg-white/20');
        break;
    }

    // Add common button classes
    button.classList.add(
      'flex-1',
      'px-2',
      'py-1',
      'rounded',
      'text-xs',
      'text-white',
      'transition-colors'
    );
  }

  /**
   * Get icon class based on icon type
   */
  private getIconClass(iconType: UIState['statusIcon']): string {
    const baseClass = 'w-2 h-2 rounded-full';

    switch (iconType) {
      case 'loading':
        return `${baseClass} bg-blue-400 animate-pulse`;
      case 'success':
        return `${baseClass} bg-green-400`;
      case 'error':
        return `${baseClass} bg-red-400`;
      case 'warning':
        return `${baseClass} bg-yellow-400`;
      case 'disabled':
        return `${baseClass} bg-gray-400`;
      default:
        return `${baseClass} bg-gray-400`;
    }
  }

  private updateSyncIndicator(progress: SyncProgress): void {
    const indicator = this.element.querySelector('#sync-indicator');
    const progressText = this.element.querySelector('#sync-progress-text');
    const progressBar = this.element.querySelector('#sync-progress-bar') as HTMLElement;
    const syncBtn = this.element.querySelector('#sync-db') as HTMLElement;

    if (!indicator || !progressText || !progressBar) return;

    if (progress.isActive) {
      // Show sync indicator
      indicator.classList.remove('hidden');

      // Update progress text
      if (progress.totalPages > 0) {
        progressText.textContent = `Page ${progress.syncedPages} of ${progress.totalPages} (${progress.totalFilaments} colors)`;
      } else {
        progressText.textContent = 'Initializing...';
      }

      // Update progress bar
      progressBar.style.width = `${Math.max(progress.progress, 5)}%`;

      // Hide status summary while syncing
      const statusSummary = this.element.querySelector('#status-summary');
      statusSummary?.classList.add('hidden');

      // Update sync button to show cancel button during sync
      if (syncBtn && !syncBtn.classList.contains('hidden')) {
        syncBtn.removeAttribute('disabled');
        syncBtn.dataset.syncing = 'true';
        syncBtn.textContent = 'Cancel';
        // Change button color to indicate it's a cancel action
        syncBtn.classList.remove('bg-blue-500/20', 'hover:bg-blue-500/30');
        syncBtn.classList.add('bg-red-500/20', 'hover:bg-red-500/30');
      }
    } else {
      // Hide sync indicator
      indicator.classList.add('hidden');

      // Restore sync button
      if (syncBtn) {
        syncBtn.removeAttribute('disabled');
        syncBtn.dataset.syncing = 'false';
        syncBtn.textContent = 'Sync';
        // Restore original blue color
        syncBtn.classList.remove('bg-red-500/20', 'hover:bg-red-500/30');
        syncBtn.classList.add('bg-blue-500/20', 'hover:bg-blue-500/30');
      }

      // Show status summary
      this.showStatusSummary(progress.error);

      // Update detailed status and button visibility
      this.updateDetailedStatus();
      this.updateStatus();
    }
  }

  private async showInitializingStatus(): Promise<void> {
    const statusSummary = this.element.querySelector('#status-summary');
    const statusIcon = this.element.querySelector('#status-icon') as HTMLElement;
    const statusText = this.element.querySelector('#status-text');

    if (!statusSummary || !statusIcon || !statusText) return;

    statusSummary.classList.remove('hidden');
    statusIcon.className = 'w-2 h-2 rounded-full bg-blue-400 animate-pulse';
    statusText.textContent = 'Filaments initializing...';
  }

  private async showStatusSummary(error?: string): Promise<void> {
    // This method is now simplified as the state machine handles status messages
    const stats = await this.filamentDb.getStats();
    const uiState = this.syncController.getUIStateWithContext(stats, this.syncEnabled);
    this.applyUIState(uiState);
  }

  private async updateStatus(): Promise<void> {
    try {
      const stats = await this.filamentDb.getStats();
      const uiState = this.syncController.getUIStateWithContext(stats, this.syncEnabled);
      this.applyUIState(uiState);
    } catch (error) {
      console.warn('Failed to update sync status:', error);
    }
  }

  private async updateDetailedStatus(): Promise<void> {
    try {
      const stats = await this.filamentDb.getStats();

      const totalColors = this.element.querySelector('#total-colors');
      const totalManufacturers = this.element.querySelector('#total-manufacturers');
      const databaseSize = this.element.querySelector('#database-size');
      const lastSync = this.element.querySelector('#last-sync');

      if (totalColors) totalColors.textContent = stats.totalFilaments.toLocaleString();
      if (totalManufacturers)
        totalManufacturers.textContent = stats.manufacturers.length.toString();
      if (databaseSize) databaseSize.textContent = formatBytes(stats.estimatedSizeBytes);

      if (lastSync) {
        if (stats.lastSync) {
          const timeAgo = this.getTimeAgo(stats.lastSync);
          lastSync.textContent = timeAgo;
        } else {
          lastSync.textContent = 'Never';
        }
      }
    } catch (error) {
      console.warn('Failed to update detailed status:', error);
    }
  }

  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Recently';
    }
  }

  protected cleanup(): void {
    if (this.unsubscribeSync) {
      this.unsubscribeSync();
      this.unsubscribeSync = null;
    }
    if (this.unsubscribeSyncController) {
      this.unsubscribeSyncController();
      this.unsubscribeSyncController = null;
    }
  }
}
