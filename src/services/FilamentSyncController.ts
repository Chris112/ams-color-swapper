/**
 * Unified sync controller for managing all filament database synchronization operations
 * Provides consistent state management and UI behavior across all sync triggers
 */

export type SyncState = 'idle' | 'checking' | 'syncing' | 'cancelling' | 'error' | 'complete';

export type SyncTrigger = 'manual' | 'refresh' | 'auto' | 'background';

export interface SyncOperation {
  id: string;
  trigger: SyncTrigger;
  state: SyncState;
  startTime: number;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
  error?: string;
}

export interface ButtonState {
  visible: boolean;
  enabled: boolean;
  text: string;
  style: 'primary' | 'danger' | 'success' | 'default';
}

export interface UIState {
  statusMessage: string;
  statusIcon: 'loading' | 'success' | 'error' | 'warning' | 'disabled';
  showProgress: boolean;
  progressText?: string;
  buttons: {
    sync: ButtonState;
    refresh: ButtonState;
    clear: ButtonState;
  };
}

export interface SyncStateUpdate {
  state: SyncState;
  operation?: SyncOperation;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
  error?: string;
  message?: string;
  ui?: UIState;
}

type SyncStateListener = (update: SyncStateUpdate) => void;

export class FilamentSyncController {
  private static instance: FilamentSyncController;
  private currentOperation: SyncOperation | null = null;
  private stateListeners = new Set<SyncStateListener>();
  private abortController: AbortController | null = null;

  // State machine rules
  private readonly validTransitions: Record<SyncState, SyncState[]> = {
    idle: ['checking', 'syncing'],
    checking: ['syncing', 'idle', 'error'],
    syncing: ['cancelling', 'complete', 'error'],
    cancelling: ['idle', 'error'],
    error: ['idle'],
    complete: ['idle'],
  };

  public static getInstance(): FilamentSyncController {
    if (!FilamentSyncController.instance) {
      FilamentSyncController.instance = new FilamentSyncController();
    }
    return FilamentSyncController.instance;
  }

  private constructor() {}

  /**
   * Start a sync operation with consistent state management
   */
  public async startSync(trigger: SyncTrigger, force: boolean = false): Promise<void> {
    // Prevent multiple simultaneous operations
    if (this.currentOperation && this.currentOperation.state !== 'idle') {
      console.warn(
        `[SyncController] Sync already in progress (${this.currentOperation.state}), ignoring new request`
      );
      return;
    }

    // Create new operation
    const operation: SyncOperation = {
      id: `${trigger}-${Date.now()}`,
      trigger,
      state: 'idle',
      startTime: Date.now(),
    };

    this.currentOperation = operation;
    this.abortController = new AbortController();

    try {
      // Transition to checking state
      await this.transitionTo('checking', operation);

      // Notify FilamentDatabase to start sync
      const { FilamentDatabase } = await import('./FilamentDatabase');
      const db = FilamentDatabase.getInstance();

      // For refresh, check if update is needed first
      if (trigger === 'refresh' && !force) {
        const needsUpdate = await db.needsUpdate();
        if (!needsUpdate) {
          // Special handling for "up to date" status
          operation.state = 'complete';
          const ui = this.generateUIState('complete', operation);

          // Override the message and add special handling
          ui.statusMessage = 'Database is up to date';

          // Create a special UI state with the feedback flag
          const uiWithFeedback = {
            ...ui,
            showUpToDateFeedback: true,
          } as UIState & { showUpToDateFeedback: boolean };

          this.notifyListeners({
            state: 'complete',
            operation,
            message: 'Database is up to date',
            ui: uiWithFeedback,
          });

          // Reset to idle after delay
          setTimeout(() => {
            this.resetToIdle();
          }, 2000);
          return;
        }
      }

      // Transition to syncing state
      await this.transitionTo('syncing', operation);

      // Start the actual sync
      db.startSync(force);
    } catch (error) {
      await this.handleError(error, operation);
    }
  }

  /**
   * Cancel the current sync operation
   */
  public async cancelSync(): Promise<void> {
    if (!this.currentOperation || this.currentOperation.state !== 'syncing') {
      console.warn('[SyncController] No active sync to cancel');
      return;
    }

    try {
      await this.transitionTo('cancelling', this.currentOperation);

      // Abort the operation
      if (this.abortController) {
        this.abortController.abort();
      }

      // Stop the database sync
      const { FilamentDatabase } = await import('./FilamentDatabase');
      const db = FilamentDatabase.getInstance();
      db.stopSync();

      // Wait a bit for cancellation to process
      setTimeout(() => {
        this.transitionTo('idle', this.currentOperation!);
      }, 500);
    } catch (error) {
      await this.handleError(error, this.currentOperation);
    }
  }

  /**
   * Update sync progress
   */
  public updateProgress(current: number, total: number): void {
    if (!this.currentOperation || this.currentOperation.state !== 'syncing') {
      return;
    }

    const progress = {
      current,
      total,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0,
    };

    this.currentOperation.progress = progress;

    this.notifyListeners({
      state: 'syncing',
      operation: this.currentOperation,
      progress,
    });
  }

  /**
   * Handle sync completion
   */
  public async handleSyncComplete(success: boolean, message?: string): Promise<void> {
    if (!this.currentOperation) {
      return;
    }

    const targetState: SyncState = success ? 'complete' : 'error';
    await this.transitionTo(targetState, this.currentOperation);

    this.notifyListeners({
      state: targetState,
      operation: this.currentOperation,
      message: message || (success ? 'Sync completed successfully' : 'Sync failed'),
    });

    // Reset to idle after a delay
    setTimeout(() => {
      this.resetToIdle();
    }, 2000);
  }

  /**
   * Get current sync state
   */
  public getCurrentState(): SyncStateUpdate {
    const state = this.currentOperation?.state || 'idle';
    const ui = this.generateUIState(state, this.currentOperation);

    return {
      state,
      operation: this.currentOperation || undefined,
      progress: this.currentOperation?.progress,
      ui, // Always included
    };
  }

  /**
   * Check if sync is active
   */
  public isSyncing(): boolean {
    return (
      this.currentOperation?.state === 'checking' ||
      this.currentOperation?.state === 'syncing' ||
      this.currentOperation?.state === 'cancelling'
    );
  }

  /**
   * Get UI state with database context
   * This allows the component to provide database stats to determine button visibility
   */
  public getUIStateWithContext(
    databaseStats: { totalFilaments: number; isAvailable: boolean },
    syncEnabled: boolean
  ): UIState {
    const currentState = this.getCurrentState();

    // Ensure we have a complete UI state
    if (!currentState.ui) {
      // Generate a default UI state if missing
      const state = this.currentOperation?.state || 'idle';
      return this.generateUIState(state, this.currentOperation);
    }

    const ui = { ...currentState.ui };

    // If we're syncing, use the state machine's UI state as-is
    if (this.isSyncing()) {
      return ui;
    }

    // For idle states, determine button visibility based on database state
    if (
      currentState.state === 'idle' ||
      currentState.state === 'complete' ||
      currentState.state === 'error'
    ) {
      // Reset all buttons first
      ui.buttons = {
        sync: { visible: false, enabled: true, text: 'Sync', style: 'primary' },
        refresh: { visible: false, enabled: true, text: 'Refresh', style: 'default' },
        clear: { visible: false, enabled: true, text: 'Clear', style: 'danger' },
      };

      if (!syncEnabled) {
        // Sync disabled - only show clear if there's data
        ui.statusMessage = 'Filament sync disabled';
        ui.statusIcon = 'disabled';
        if (databaseStats.totalFilaments > 0) {
          ui.buttons.clear.visible = true;
        }
      } else if (!databaseStats.isAvailable) {
        // Database not initialized
        ui.statusMessage = 'Filaments initializing...';
        ui.statusIcon = 'loading';
      } else if (databaseStats.totalFilaments === 0) {
        // Empty database - show sync button
        ui.statusMessage = 'Filaments not synchronized';
        ui.statusIcon = 'warning';
        ui.buttons.sync.visible = true;
      } else {
        // Database has data - show refresh and clear
        ui.statusMessage = 'Filaments ready';
        ui.statusIcon = 'success';
        ui.buttons.refresh.visible = true;
        ui.buttons.clear.visible = true;
      }
    }

    return ui;
  }

  /**
   * Subscribe to state changes
   */
  public subscribe(listener: SyncStateListener): () => void {
    this.stateListeners.add(listener);

    // Send current state immediately
    listener(this.getCurrentState());

    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Transition to a new state with validation
   */
  private async transitionTo(newState: SyncState, operation: SyncOperation): Promise<void> {
    const currentState = operation.state;

    // Validate transition
    if (!this.validTransitions[currentState].includes(newState)) {
      throw new Error(`[SyncController] Invalid state transition: ${currentState} → ${newState}`);
    }

    console.log(`[SyncController] State transition: ${currentState} → ${newState}`);
    operation.state = newState;

    this.notifyListeners({
      state: newState,
      operation,
    });
  }

  /**
   * Handle errors during sync operations
   */
  private async handleError(error: unknown, operation: SyncOperation): Promise<void> {
    console.error('[SyncController] Sync error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    operation.error = errorMessage;

    await this.transitionTo('error', operation);

    this.notifyListeners({
      state: 'error',
      operation,
      error: errorMessage,
    });

    // Reset to idle after delay
    setTimeout(() => {
      this.resetToIdle();
    }, 3000);
  }

  /**
   * Reset controller to idle state
   */
  private resetToIdle(): void {
    this.currentOperation = null;
    this.abortController = null;

    this.notifyListeners({
      state: 'idle',
    });
  }

  /**
   * Generate UI state based on current sync state
   */
  private generateUIState(state: SyncState, operation: SyncOperation | null): UIState {
    // Default button states
    const defaultButtons: UIState['buttons'] = {
      sync: { visible: false, enabled: true, text: 'Sync', style: 'primary' },
      refresh: { visible: false, enabled: true, text: 'Refresh', style: 'default' },
      clear: { visible: false, enabled: true, text: 'Clear', style: 'danger' },
    };

    switch (state) {
      case 'idle':
        // Need to check database state to determine which buttons to show
        // This will be set by the component based on database stats
        return {
          statusMessage: 'Filaments ready', // Will be overridden if DB is empty
          statusIcon: 'success',
          showProgress: false,
          buttons: defaultButtons,
        };

      case 'checking':
        const checkingButtons = { ...defaultButtons };
        const trigger = operation?.trigger || 'manual';

        if (trigger === 'refresh') {
          checkingButtons.refresh = {
            visible: true,
            enabled: false,
            text: 'Checking...',
            style: 'default',
          };
        } else {
          checkingButtons.sync = {
            visible: true,
            enabled: false,
            text: 'Starting...',
            style: 'primary',
          };
        }

        return {
          statusMessage: 'Checking for updates...',
          statusIcon: 'loading',
          showProgress: true,
          progressText: 'Checking for updates...',
          buttons: checkingButtons,
        };

      case 'syncing':
        const syncingButtons = { ...defaultButtons };
        const syncTrigger = operation?.trigger || 'manual';

        // Show cancel button based on which operation triggered the sync
        if (syncTrigger === 'refresh') {
          syncingButtons.refresh = {
            visible: true,
            enabled: true,
            text: 'Cancel',
            style: 'danger',
          };
        } else {
          syncingButtons.sync = {
            visible: true,
            enabled: true,
            text: 'Cancel',
            style: 'danger',
          };
        }

        const progressText = operation?.progress
          ? `Page ${operation.progress.current} of ${operation.progress.total}`
          : 'Initializing...';

        return {
          statusMessage: 'Updating filament database...',
          statusIcon: 'loading',
          showProgress: true,
          progressText,
          buttons: syncingButtons,
        };

      case 'cancelling':
        const cancellingButtons = { ...defaultButtons };
        const cancelTrigger = operation?.trigger || 'manual';

        if (cancelTrigger === 'refresh') {
          cancellingButtons.refresh = {
            visible: true,
            enabled: false,
            text: 'Cancelling...',
            style: 'danger',
          };
        } else {
          cancellingButtons.sync = {
            visible: true,
            enabled: false,
            text: 'Cancelling...',
            style: 'danger',
          };
        }

        return {
          statusMessage: 'Cancelling and clearing partial data...',
          statusIcon: 'loading',
          showProgress: true,
          progressText: 'Cleaning up...',
          buttons: cancellingButtons,
        };

      case 'complete':
        // Buttons will be set based on database state after completion
        const message = operation?.error || 'Sync completed successfully';

        return {
          statusMessage: message,
          statusIcon: 'success',
          showProgress: false,
          buttons: defaultButtons,
        };

      case 'error':
        const errorButtons = { ...defaultButtons };
        const errorTrigger = operation?.trigger || 'manual';

        if (errorTrigger === 'refresh') {
          errorButtons.refresh = {
            visible: true,
            enabled: true,
            text: 'Retry',
            style: 'danger',
          };
        } else {
          errorButtons.sync = {
            visible: true,
            enabled: true,
            text: 'Retry',
            style: 'danger',
          };
        }

        return {
          statusMessage: operation?.error || 'Sync failed',
          statusIcon: 'error',
          showProgress: false,
          buttons: errorButtons,
        };

      default:
        return {
          statusMessage: 'Unknown state',
          statusIcon: 'warning',
          showProgress: false,
          buttons: defaultButtons,
        };
    }
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(update: SyncStateUpdate): void {
    const ui = this.generateUIState(update.state, update.operation || null);
    const fullUpdate: SyncStateUpdate = {
      ...update,
      ui,
    };

    this.stateListeners.forEach((listener) => {
      try {
        listener(fullUpdate);
      } catch (error) {
        console.error('[SyncController] Error in state listener:', error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.stateListeners.clear();
    this.currentOperation = null;
  }
}
