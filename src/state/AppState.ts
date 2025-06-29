import { GcodeStats } from '../types/gcode';
import { OptimizationResult } from '../types/optimization';
import { DebugLog } from '../types/logging';
import { SystemConfiguration } from '../types/configuration';
import { hmrStateRepository } from '../repositories/HMRStateRepository';
import { MergeHistoryEntry } from '../services/ColorMergeService';
import { MergeHistoryManager, StateSnapshot } from '../services/MergeHistoryManager';
import { eventBus, AppEvents } from '../core/EventEmitter';

export interface AppStateData {
  currentFile: File | null;
  isLoading: boolean;
  loadingMessage: string;
  loadingProgress: number;
  stats: GcodeStats | null;
  optimization: OptimizationResult | null;
  logs: DebugLog[];
  error: string | null;
  view: 'upload' | 'results';
  configuration: SystemConfiguration;
  preferences: {
    timelineView: 'color' | 'slot';
    swapInstructionDesign: 'glassmorphism';
  };
  mergeHistory: MergeHistoryEntry[];
  originalStats: GcodeStats | null; // Keep original stats for undo
}

export type StateListener = (state: AppStateData) => void;

export class AppState {
  private mergeHistoryManager: MergeHistoryManager;
  private state: AppStateData = {
    currentFile: null,
    isLoading: false,
    loadingMessage: '',
    loadingProgress: 0,
    stats: null,
    optimization: null,
    logs: [],
    error: null,
    view: 'upload',
    configuration: {
      type: 'ams',
      unitCount: 1,
      totalSlots: 4,
      parserAlgorithm: 'optimized',
    },
    preferences: {
      timelineView: 'color',
      swapInstructionDesign: 'glassmorphism',
    },
    mergeHistory: [],
    originalStats: null,
  };

  private listeners = new Set<StateListener>();
  private persistenceTimer: number | null = null;
  private readonly PERSISTENCE_DELAY = 1000; // 1 second debounce

  constructor() {
    // Initialize merge history manager
    this.mergeHistoryManager = new MergeHistoryManager();

    // Load persisted preferences from localStorage
    this.loadPersistedPreferences();

    // Try to load saved timeline asynchronously
    this.loadTimelineAsync();

    // Load persisted state on startup (only in development)
    if (import.meta.env.DEV) {
      this.initializeHMRPersistence();
    }

    // Set up keyboard shortcuts for timeline navigation
    this.setupKeyboardShortcuts();
  }

  // Get current state
  getState(): Readonly<AppStateData> {
    return { ...this.state };
  }

  // Subscribe to state changes
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    // Return unsubscribe function
    return () => this.listeners.delete(listener);
  }

  // Update state and notify listeners
  setState(updates: Partial<AppStateData>): void {
    this.state = { ...this.state, ...updates };

    // Persist state in development mode with debouncing
    if (import.meta.env.DEV) {
      this.schedulePersistence();
    }

    this.notifyListeners();
  }

  // Specific state update methods
  setLoading(isLoading: boolean, message = '', progress = 0): void {
    this.setState({ isLoading, loadingMessage: message, loadingProgress: progress });
  }

  setError(error: string | null): void {
    this.setState({ error, isLoading: false });
  }

  setConfiguration(configuration: SystemConfiguration): void {
    this.setState({ configuration });
  }

  setPreferences(preferences: Partial<AppStateData['preferences']>): void {
    this.setState({
      preferences: { ...this.state.preferences, ...preferences },
    });

    // Immediately persist preferences to localStorage
    try {
      Object.entries(preferences).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value));
      });
    } catch (error) {
      console.warn('Failed to persist preferences to localStorage:', error);
    }
  }

  setAnalysisResults(stats: GcodeStats, optimization: OptimizationResult, logs: DebugLog[]): void {
    // AppState: Setting analysis results, switching to results view
    this.setState({
      stats,
      optimization,
      logs,
      view: 'results',
      isLoading: false,
      loadingMessage: '',
      loadingProgress: 0,
      error: null,
      originalStats: stats, // Keep original for undo
      mergeHistory: [], // Reset merge history for new file
    });

    // Initialize merge history timeline with initial state
    this.mergeHistoryManager.addInitialState(stats, optimization);

    // Auto-save timeline asynchronously
    this.mergeHistoryManager.saveToStorage().catch((error) => {
      console.error('Failed to save timeline:', error);
    });

    // Force immediate persistence when analysis is complete
    if (import.meta.env.DEV) {
      this.persistState();
    }
  }

  reset(): void {
    this.setState({
      currentFile: null,
      isLoading: false,
      loadingMessage: '',
      loadingProgress: 0,
      stats: null,
      optimization: null,
      logs: [],
      error: null,
      view: 'upload',
      mergeHistory: [],
      originalStats: null,
    });
  }

  setMergedStats(
    stats: GcodeStats,
    optimization: OptimizationResult,
    mergeEntry: MergeHistoryEntry
  ): void {
    // Add to merge history timeline
    this.mergeHistoryManager.addMergeState(stats, optimization, {
      targetColorId: mergeEntry.targetColorId,
      sourceColorIds: mergeEntry.sourceColorIds,
      freedSlots: mergeEntry.freedSlots,
      description: `Merged ${mergeEntry.sourceColorIds.join(', ')} → ${mergeEntry.targetColorId}`,
    });

    this.setState({
      stats,
      optimization,
      mergeHistory: [...this.state.mergeHistory, mergeEntry],
    });

    // Auto-save timeline after merge asynchronously
    this.mergeHistoryManager.saveToStorage().catch((error) => {
      console.error('Failed to save timeline after merge:', error);
    });
  }

  undoLastMerge(): void {
    const previousSnapshot = this.mergeHistoryManager.undo();
    if (previousSnapshot) {
      this.navigateToSnapshot(previousSnapshot);
    }
  }

  redoMerge(): void {
    const nextSnapshot = this.mergeHistoryManager.redo();
    if (nextSnapshot) {
      this.navigateToSnapshot(nextSnapshot);
    }
  }

  navigateToSnapshot(snapshot: StateSnapshot | string): void {
    let targetSnapshot: StateSnapshot | null;

    if (typeof snapshot === 'string') {
      targetSnapshot = this.mergeHistoryManager.jumpToSnapshot(snapshot);
    } else {
      targetSnapshot = snapshot;
    }

    if (targetSnapshot) {
      this.setState({
        stats: targetSnapshot.stats,
        optimization: targetSnapshot.optimization,
        mergeHistory: this.state.mergeHistory, // Keep full history for UI
      });

      // Emit event for UI updates
      eventBus.emit(AppEvents.TIMELINE_NAVIGATED, { snapshot: targetSnapshot });
    }
  }

  resetToInitialState(): void {
    const initialSnapshot = this.mergeHistoryManager.reset();
    if (initialSnapshot) {
      this.navigateToSnapshot(initialSnapshot);
    }
  }

  createMergeBranch(name: string): boolean {
    return this.mergeHistoryManager.createBranch(name);
  }

  switchMergeBranch(name: string): void {
    const snapshot = this.mergeHistoryManager.switchBranch(name);
    if (snapshot) {
      this.navigateToSnapshot(snapshot);
    }
  }

  getTimelineState() {
    return this.mergeHistoryManager.getTimeline();
  }

  /**
   * Get the merge history manager instance
   * @returns The merge history manager
   */
  getMergeHistoryManager(): MergeHistoryManager {
    return this.mergeHistoryManager;
  }

  canUndo(): boolean {
    return this.mergeHistoryManager.canUndo();
  }

  canRedo(): boolean {
    return this.mergeHistoryManager.canRedo();
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }

  // HMR persistence methods
  private schedulePersistence(): void {
    // Clear any existing timer
    if (this.persistenceTimer !== null) {
      clearTimeout(this.persistenceTimer);
    }

    // Don't persist during loading operations
    if (this.state.isLoading) {
      return;
    }

    // Schedule persistence after delay
    this.persistenceTimer = setTimeout(() => {
      this.persistState();
      this.persistenceTimer = null;
    }, this.PERSISTENCE_DELAY) as unknown as number;
  }

  private async persistState(): Promise<void> {
    try {
      await hmrStateRepository.save(this.state);
    } catch (error) {
      console.warn('Failed to persist state:', error);
    }
  }

  private async initializeHMRPersistence(): Promise<void> {
    try {
      // Initialize the IndexedDB repository
      await hmrStateRepository.initialize();

      // Load any persisted state
      const restoredState = await hmrStateRepository.load();
      if (restoredState) {
        this.state = { ...this.state, ...restoredState };
        this.notifyListeners();
      }

      // Setup HMR disposal handler
      this.setupHMRPersistence();
    } catch (error) {
      console.warn('Failed to initialize HMR persistences:', error);
    }
  }

  private setupHMRPersistence(): void {
    // Listen for Vite HMR events
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        // This runs when the module is about to be replaced
        this.persistState();
      });
    }
  }

  // Method to clear persisted state (useful for debugging)
  async clearPersistedState(): Promise<void> {
    await hmrStateRepository.clear();
    console.log('🗑️ Cleared persisted state');
  }

  private loadPersistedPreferences(): void {
    try {
      // Load timeline view preference
      const timelineView = localStorage.getItem('timelineView');
      if (timelineView) {
        const parsedTimelineView = JSON.parse(timelineView);
        if (parsedTimelineView === 'color' || parsedTimelineView === 'slot') {
          this.state.preferences.timelineView = parsedTimelineView;
        }
      }

      // Load swap instruction design preference (now only glassmorphism)
      const swapInstructionDesign = localStorage.getItem('swapInstructionDesign');
      if (swapInstructionDesign) {
        try {
          // Try parsing as JSON first (new format)
          const parsedDesign = JSON.parse(swapInstructionDesign);
          if (parsedDesign === 'glassmorphism') {
            this.state.preferences.swapInstructionDesign = parsedDesign;
          }
        } catch {
          // Handle legacy plain string format (old design selection)
          // Since we only support glassmorphism now, just clear the old value
          localStorage.removeItem('swapInstructionDesign');
          this.state.preferences.swapInstructionDesign = 'glassmorphism';
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted preferences:', error);
    }
  }

  private async loadTimelineAsync(): Promise<void> {
    try {
      const loaded = await this.mergeHistoryManager.loadFromStorage();
      if (loaded) {
        console.log('Timeline loaded from storage');
      }
    } catch (error) {
      console.warn('Failed to load timeline:', error);
    }
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Only handle shortcuts when results are shown
      if (this.state.view !== 'results') return;

      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.undoLastMerge();
      }

      // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        this.redoMerge();
      }
    });
  }
}

// Singleton instance
export const appState = new AppState();
