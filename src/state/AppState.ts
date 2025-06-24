import { GcodeStats, OptimizationResult } from '../types';

export interface AppStateData {
  currentFile: File | null;
  isLoading: boolean;
  loadingMessage: string;
  loadingProgress: number;
  stats: GcodeStats | null;
  optimization: OptimizationResult | null;
  logs: any[];
  error: string | null;
  view: 'upload' | 'results';
  debugVisible: boolean;
  debugTab: 'logs' | 'performance' | 'raw';
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
  };

  private listeners = new Set<StateListener>();

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
    this.notifyListeners();
  }

  // Specific state update methods
  setLoading(isLoading: boolean, message = '', progress = 0): void {
    this.setState({ isLoading, loadingMessage: message, loadingProgress: progress });
  }

  setError(error: string | null): void {
    this.setState({ error, isLoading: false });
  }

  setAnalysisResults(stats: GcodeStats, optimization: OptimizationResult, logs: any[]): void {
    this.setState({
      stats,
      optimization,
      logs,
      view: 'results',
      isLoading: false,
      error: null,
    });
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
    this.listeners.forEach(listener => listener(this.state));
  }
}

// Singleton instance
export const appState = new AppState();