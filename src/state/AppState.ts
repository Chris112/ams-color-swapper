import { GcodeStats, OptimizationResult, LogEntry, SystemConfiguration } from '../types';
import { hmrStateRepository } from '../repositories/HMRStateRepository';

export interface AppStateData {
  currentFile: File | null;
  isLoading: boolean;
  loadingMessage: string;
  loadingProgress: number;
  stats: GcodeStats | null;
  optimization: OptimizationResult | null;
  logs: LogEntry[];
  error: string | null;
  view: 'upload' | 'results';
  debugVisible: boolean;
  debugTab: 'logs' | 'performance' | 'raw';
  configuration: SystemConfiguration;
}

export type StateListener = (state: AppStateData) => void;

export class AppState {
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
    debugVisible: false,
    debugTab: 'logs',
    configuration: {
      type: 'ams',
      unitCount: 1,
      totalSlots: 4,
    },
  };

  private listeners = new Set<StateListener>();
  private persistenceTimer: number | null = null;
  private readonly PERSISTENCE_DELAY = 1000; // 1 second debounce

  constructor() {
    // Load persisted state on startup (only in development)
    if (import.meta.env.DEV) {
      this.initializeHMRPersistence();
    }
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

  setAnalysisResults(stats: GcodeStats, optimization: OptimizationResult, logs: LogEntry[]): void {
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
      debugVisible: false,
      debugTab: 'logs',
    });
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
      console.warn('Failed to initialize HMR persistence:', error);
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
}

// Singleton instance
export const appState = new AppState();
