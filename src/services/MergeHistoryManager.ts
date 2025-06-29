import { GcodeStats } from '../types/gcode';
import { OptimizationResult } from '../types/optimization';
import { ConstraintValidationResult } from '../types/constraints';
import { TimelineStateMachine, TimelineAction } from './TimelineStateMachine';
import { TimelineRepository } from '../repositories/TimelineRepository';
import { Color } from '../domain/models/Color';
import { assertDefined, getFromMap } from '../utils/typeGuards';

export interface StateSnapshot {
  id: string;
  timestamp: number;
  stats: GcodeStats;
  optimization: OptimizationResult;
  constraintValidation?: ConstraintValidationResult;
  mergeInfo?: {
    targetColorId: string;
    sourceColorIds: string[];
    freedSlots: string[];
    description: string;
  };
  parentId?: string;
  branchName?: string;
  violationCount: number;
  colorCount: number;
}

export interface MergeTimelineState {
  snapshots: StateSnapshot[];
  currentIndex: number;
  branches: Map<string, string[]>; // branch name -> snapshot ids
  currentBranch: string;
}

export class MergeHistoryManager {
  private static readonly MAX_HISTORY_SIZE = 50;
  private static readonly STORAGE_KEY = 'ams-merge-timeline';
  private static readonly TIMELINE_ID = 'current-timeline';

  private snapshots: StateSnapshot[] = [];
  private currentIndex: number = -1;
  private branches: Map<string, string[]> = new Map();
  private currentBranch: string = 'main';
  private stateMachine: TimelineStateMachine;
  private timelineRepository: TimelineRepository;
  private isInitialized: boolean = false;
  private saveDebounceTimer: number | null = null;

  constructor() {
    this.branches.set('main', []);
    this.stateMachine = new TimelineStateMachine();
    this.timelineRepository = new TimelineRepository();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    const result = await this.timelineRepository.initialize();
    if (result.ok) {
      this.isInitialized = true;
    } else {
      console.error('Failed to initialize timeline repository:', result.error);
    }
  }

  /**
   * Add initial state snapshot
   */
  public addInitialState(stats: GcodeStats, optimization: OptimizationResult): void {
    if (!this.stateMachine.canPerformAction(TimelineAction.INITIALIZE)) {
      console.warn(
        'Cannot initialize timeline in current state:',
        this.stateMachine.getCurrentState()
      );
      return;
    }

    this.stateMachine.performAction(TimelineAction.INITIALIZE);

    const violationCount = stats.constraintValidation?.summary.impossibleLayerCount || 0;
    const colorCount = stats.colors.length;

    const snapshot: StateSnapshot = {
      id: this.generateId(),
      timestamp: Date.now(),
      stats: this.cloneStats(stats),
      optimization: this.cloneOptimization(optimization),
      constraintValidation: stats.constraintValidation,
      branchName: this.currentBranch,
      violationCount,
      colorCount,
    };

    this.snapshots = [snapshot];
    this.currentIndex = 0;
    const branch = getFromMap(
      this.branches,
      this.currentBranch,
      `Branch not found: ${this.currentBranch}`
    );
    branch.push(snapshot.id);

    // Update state machine context
    this.stateMachine.updateContext({
      currentSnapshot: snapshot,
      canUndo: false,
      canRedo: false,
    });
  }

  /**
   * Add a new merge state
   */
  public addMergeState(
    stats: GcodeStats,
    optimization: OptimizationResult,
    mergeInfo: StateSnapshot['mergeInfo']
  ): void {
    if (!this.stateMachine.canPerformAction(TimelineAction.ADD_MERGE)) {
      console.warn(
        'Cannot add merge state in current timeline state:',
        this.stateMachine.getCurrentState()
      );
      return;
    }

    this.stateMachine.performAction(TimelineAction.ADD_MERGE);

    // Remove any states after current index (when we're not at the end)
    if (this.currentIndex < this.snapshots.length - 1) {
      this.snapshots = this.snapshots.slice(0, this.currentIndex + 1);
      // Update branch
      const branchIds = getFromMap(
        this.branches,
        this.currentBranch,
        `Branch not found: ${this.currentBranch}`
      );
      const currentSnapshot = this.snapshots[this.currentIndex];
      assertDefined(currentSnapshot, 'Current snapshot not found');
      const currentSnapshotIndex = branchIds.indexOf(currentSnapshot.id);
      this.branches.set(this.currentBranch, branchIds.slice(0, currentSnapshotIndex + 1));
    }

    const violationCount = stats.constraintValidation?.summary.impossibleLayerCount || 0;
    const colorCount = stats.colors.length;

    const snapshot: StateSnapshot = {
      id: this.generateId(),
      timestamp: Date.now(),
      stats: this.cloneStats(stats),
      optimization: this.cloneOptimization(optimization),
      constraintValidation: stats.constraintValidation,
      mergeInfo,
      parentId: this.snapshots[this.currentIndex]?.id,
      branchName: this.currentBranch,
      violationCount,
      colorCount,
    };

    this.snapshots.push(snapshot);
    this.currentIndex++;
    const branch = getFromMap(
      this.branches,
      this.currentBranch,
      `Branch not found: ${this.currentBranch}`
    );
    branch.push(snapshot.id);

    // Complete the merge action
    this.stateMachine.performAction(TimelineAction.ADD_MERGE);

    // Update state machine context
    this.stateMachine.updateContext({
      currentSnapshot: snapshot,
      canUndo: this.currentIndex > 0,
      canRedo: false,
    });

    // Enforce history size limit
    if (this.snapshots.length > MergeHistoryManager.MAX_HISTORY_SIZE) {
      const removedSnapshot = this.snapshots.shift();
      this.currentIndex--;
      // Update all branches
      this.branches.forEach((ids, branchName) => {
        assertDefined(removedSnapshot, 'Removed snapshot is undefined');
        const index = ids.indexOf(removedSnapshot.id);
        if (index !== -1) {
          ids.splice(index, 1);
        }
      });
    }

    // Auto-save after adding merge state
    this.saveToStorage();
  }

  /**
   * Navigate to previous state
   */
  public undo(): StateSnapshot | null {
    if (!this.stateMachine.canPerformAction(TimelineAction.UNDO)) {
      return null;
    }

    this.stateMachine.performAction(TimelineAction.UNDO);

    if (this.currentIndex > 0) {
      this.currentIndex--;
      const snapshot = this.getCurrentSnapshot();

      this.stateMachine.performAction(TimelineAction.UNDO);
      this.stateMachine.updateContext({
        currentSnapshot: snapshot || undefined,
        canUndo: this.currentIndex > 0,
        canRedo: true,
      });

      return snapshot;
    }
    return null;
  }

  /**
   * Navigate to next state
   */
  public redo(): StateSnapshot | null {
    if (!this.stateMachine.canPerformAction(TimelineAction.REDO)) {
      return null;
    }

    this.stateMachine.performAction(TimelineAction.REDO);

    if (this.currentIndex < this.snapshots.length - 1) {
      this.currentIndex++;
      const snapshot = this.getCurrentSnapshot();

      this.stateMachine.performAction(TimelineAction.REDO);
      this.stateMachine.updateContext({
        currentSnapshot: snapshot || undefined,
        canUndo: true,
        canRedo: this.currentIndex < this.snapshots.length - 1,
      });

      return snapshot;
    }
    return null;
  }

  /**
   * Jump to specific snapshot
   */
  public jumpToSnapshot(snapshotId: string): StateSnapshot | null {
    if (!this.stateMachine.canPerformAction(TimelineAction.JUMP_TO)) {
      return null;
    }

    this.stateMachine.performAction(TimelineAction.JUMP_TO);

    const index = this.snapshots.findIndex((s) => s.id === snapshotId);
    if (index !== -1) {
      this.currentIndex = index;
      const snapshot = this.getCurrentSnapshot();

      this.stateMachine.performAction(TimelineAction.JUMP_TO);
      this.stateMachine.updateContext({
        currentSnapshot: snapshot || undefined,
        canUndo: this.currentIndex > 0,
        canRedo: this.currentIndex < this.snapshots.length - 1,
      });

      return snapshot;
    }
    return null;
  }

  /**
   * Reset to initial state
   */
  public reset(): StateSnapshot | null {
    if (!this.stateMachine.canPerformAction(TimelineAction.RESET)) {
      return null;
    }

    this.stateMachine.performAction(TimelineAction.RESET);

    if (this.snapshots.length > 0) {
      // Keep only the initial snapshot
      const initialSnapshot = this.snapshots[0];
      this.snapshots = [initialSnapshot];
      this.currentIndex = 0;

      // Clear all branches except master
      this.branches.clear();
      this.branches.set('master', [initialSnapshot.id]);
      this.currentBranch = 'master';

      // Save to storage
      this.saveToStorage();

      this.stateMachine.updateContext({
        currentSnapshot: initialSnapshot,
        canUndo: false,
        canRedo: false,
      });

      return initialSnapshot;
    }
    return null;
  }

  /**
   * Create a new branch from current state
   */
  public createBranch(branchName: string): boolean {
    if (!this.stateMachine.canPerformAction(TimelineAction.CREATE_BRANCH)) {
      return false;
    }

    if (this.branches.has(branchName)) {
      return false;
    }

    this.stateMachine.performAction(TimelineAction.CREATE_BRANCH);

    const currentSnapshot = this.getCurrentSnapshot();
    if (!currentSnapshot) {
      return false;
    }

    // Create branch from current position
    const currentBranchIds = getFromMap(
      this.branches,
      this.currentBranch,
      `Branch not found: ${this.currentBranch}`
    );
    const currentIdIndex = currentBranchIds.indexOf(currentSnapshot.id);
    const newBranchIds = currentBranchIds.slice(0, currentIdIndex + 1);

    this.branches.set(branchName, newBranchIds);
    this.currentBranch = branchName;

    this.stateMachine.performAction(TimelineAction.CREATE_BRANCH);
    this.stateMachine.updateContext({
      currentBranch: branchName,
    });

    return true;
  }

  /**
   * Switch to a different branch
   */
  public switchBranch(branchName: string): StateSnapshot | null {
    if (!this.stateMachine.canPerformAction(TimelineAction.SWITCH_BRANCH)) {
      return null;
    }

    if (!this.branches.has(branchName)) {
      return null;
    }

    this.stateMachine.performAction(TimelineAction.SWITCH_BRANCH);

    this.currentBranch = branchName;
    const branchIds = getFromMap(this.branches, branchName, `Branch not found: ${branchName}`);

    if (branchIds.length > 0) {
      const lastId = branchIds[branchIds.length - 1];
      assertDefined(lastId, 'No snapshots in branch');
      const result = this.jumpToSnapshot(lastId);

      this.stateMachine.performAction(TimelineAction.SWITCH_BRANCH);
      this.stateMachine.updateContext({
        currentBranch: branchName,
      });

      return result;
    }

    return null;
  }

  /**
   * Get current state snapshot
   */
  public getCurrentSnapshot(): StateSnapshot | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.snapshots.length) {
      return this.snapshots[this.currentIndex];
    }
    return null;
  }

  /**
   * Get all snapshots for timeline display
   */
  public getTimeline(): MergeTimelineState {
    return {
      snapshots: this.snapshots,
      currentIndex: this.currentIndex,
      branches: this.branches,
      currentBranch: this.currentBranch,
    };
  }

  /**
   * Get snapshot by ID
   */
  public getSnapshot(id: string): StateSnapshot | null {
    return this.snapshots.find((s) => s.id === id) || null;
  }

  /**
   * Check if can undo
   */
  public canUndo(): boolean {
    return this.stateMachine.canPerformAction(TimelineAction.UNDO);
  }

  /**
   * Check if can redo
   */
  public canRedo(): boolean {
    return this.stateMachine.canPerformAction(TimelineAction.REDO);
  }

  /**
   * Get current timeline state
   */
  public getTimelineState() {
    return this.stateMachine.getCurrentState();
  }

  /**
   * Get available actions
   */
  public getAvailableActions() {
    return this.stateMachine.getAvailableActions();
  }

  /**
   * Get storage metrics
   */
  public async getStorageMetrics() {
    if (!this.isInitialized) {
      return null;
    }
    const result = await this.timelineRepository.getStorageMetrics();
    return result.ok ? result.value : null;
  }

  /**
   * Save timeline to IndexedDB with compression
   */
  public async saveToStorage(): Promise<void> {
    if (!this.isInitialized) {
      console.warn('Timeline repository not initialized');
      return;
    }

    // Debounce saves to avoid excessive writes
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = setTimeout(async () => {
      const timelineState: MergeTimelineState = {
        snapshots: this.snapshots,
        currentIndex: this.currentIndex,
        branches: this.branches,
        currentBranch: this.currentBranch,
      };

      const result = await this.timelineRepository.saveTimeline(
        MergeHistoryManager.TIMELINE_ID,
        timelineState,
        this.currentIndex
      );

      if (!result.ok) {
        console.error('Failed to save timeline:', result.error);
        // Fallback to localStorage for critical data only
        this.saveMinimalToLocalStorage();
      }
    }, 500) as unknown as number;
  }

  private saveMinimalToLocalStorage(): void {
    try {
      // Save only minimal data to localStorage as fallback
      const minimalData = {
        currentIndex: this.currentIndex,
        currentBranch: this.currentBranch,
        snapshotCount: this.snapshots.length,
      };
      localStorage.setItem(
        MergeHistoryManager.STORAGE_KEY + '-minimal',
        JSON.stringify(minimalData)
      );
    } catch (error) {
      console.error('Failed to save minimal timeline data:', error);
    }
  }

  /**
   * Load timeline from IndexedDB
   */
  public async loadFromStorage(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const result = await this.timelineRepository.loadTimeline(MergeHistoryManager.TIMELINE_ID);

      if (result.ok && result.value) {
        const { state, currentIndex } = result.value;
        this.snapshots = state.snapshots;
        this.currentIndex = currentIndex;
        this.branches = state.branches;
        this.currentBranch = state.currentBranch;

        // Update state machine context
        const currentSnapshot = this.snapshots[this.currentIndex];
        if (this.currentIndex >= 0 && currentSnapshot) {
          this.stateMachine.updateContext({
            currentSnapshot: currentSnapshot,
            canUndo: this.currentIndex > 0,
            canRedo: this.currentIndex < this.snapshots.length - 1,
          });
        }

        return true;
      }

      // Try to migrate from localStorage if IndexedDB is empty
      return this.migrateFromLocalStorage();
    } catch (error) {
      console.error('Failed to load timeline from IndexedDB:', error);
      return false;
    }
  }

  private migrateFromLocalStorage(): boolean {
    try {
      const data = localStorage.getItem(MergeHistoryManager.STORAGE_KEY);
      if (!data) return false;

      const parsed = JSON.parse(data);
      this.snapshots = parsed.snapshots || [];
      this.currentIndex = parsed.currentIndex || -1;
      this.branches = new Map(parsed.branches || []);
      this.currentBranch = parsed.currentBranch || 'main';

      // Save to IndexedDB and remove from localStorage
      this.saveToStorage();
      localStorage.removeItem(MergeHistoryManager.STORAGE_KEY);

      console.log('Successfully migrated timeline from localStorage to IndexedDB');
      return true;
    } catch (error) {
      console.error('Failed to migrate from localStorage:', error);
      return false;
    }
  }

  /**
   * Clear saved timeline
   */
  public async clearStorage(): Promise<void> {
    if (this.isInitialized) {
      await this.timelineRepository.deleteTimeline(MergeHistoryManager.TIMELINE_ID);
    }
    localStorage.removeItem(MergeHistoryManager.STORAGE_KEY);
    localStorage.removeItem(MergeHistoryManager.STORAGE_KEY + '-minimal');
  }

  /**
   * Export timeline as JSON
   */
  public exportTimeline(): string {
    return JSON.stringify(
      {
        snapshots: this.snapshots,
        branches: Array.from(this.branches.entries()),
        metadata: {
          exportDate: new Date().toISOString(),
          version: '1.0',
        },
      },
      null,
      2
    );
  }

  /**
   * Import timeline from JSON
   */
  public importTimeline(json: string): boolean {
    try {
      const data = JSON.parse(json);
      if (!data.snapshots || !Array.isArray(data.snapshots)) {
        return false;
      }

      this.snapshots = data.snapshots;
      this.branches = new Map(
        data.branches || [['main', data.snapshots.map((s: StateSnapshot) => s.id)]]
      );
      this.currentIndex = this.snapshots.length - 1;
      this.currentBranch = 'main';

      return true;
    } catch (error) {
      console.error('Failed to import timeline:', error);
      return false;
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Deep clone stats
   */
  private cloneStats(stats: GcodeStats): GcodeStats {
    // Properly clone stats while preserving Map types
    return {
      ...stats,
      colors: stats.colors.map(
        (c) =>
          new Color({
            id: c.id,
            name: c.name,
            hexValue: c.hexValue,
            firstLayer: c.firstLayer,
            lastLayer: c.lastLayer,
            layersUsed: new Set(c.layersUsed),
            partialLayers: new Set(c.partialLayers),
            totalLayers: stats.totalLayers,
          })
      ),
      toolChanges: [...stats.toolChanges],
      layerColorMap: new Map(stats.layerColorMap),
      colorUsageRanges: [...stats.colorUsageRanges],
      layerDetails: stats.layerDetails ? [...stats.layerDetails] : undefined,
      filamentEstimates: stats.filamentEstimates ? [...stats.filamentEstimates] : undefined,
      parserWarnings: [...stats.parserWarnings],
      constraintValidation: stats.constraintValidation
        ? {
            ...stats.constraintValidation,
            violations: stats.constraintValidation.violations.map((v) => ({
              ...v,
              affectedLayers: v.affectedLayers.map((al) => ({ ...al })),
              suggestions: v.suggestions.map((s) => ({ ...s })),
            })),
            summary: { ...stats.constraintValidation.summary },
          }
        : undefined,
      deduplicationInfo: stats.deduplicationInfo
        ? {
            ...stats.deduplicationInfo,
            duplicatesFound: [...stats.deduplicationInfo.duplicatesFound],
            freedSlots: [...stats.deduplicationInfo.freedSlots],
            colorMapping: new Map(stats.deduplicationInfo.colorMapping),
          }
        : undefined,
    };
  }

  /**
   * Deep clone optimization
   */
  private cloneOptimization(optimization: OptimizationResult): OptimizationResult {
    // Deep clone to prevent mutations
    return JSON.parse(JSON.stringify(optimization));
  }

  /**
   * Clear all timeline data
   */
  public clear(): void {
    // Force reset regardless of current state
    this.snapshots = [];
    this.currentIndex = -1;
    this.branches.clear();
    this.branches.set('main', []);
    this.currentBranch = 'main';
    this.stateMachine.reset();
  }
}
