import { appState } from '../state/AppState';
import { eventBus, AppEvents } from './EventEmitter';
import { FileUploader } from '../ui/components/FileUploader';
import { ResultsView } from '../ui/components/ResultsView';
import { ExamplePanel } from '../ui/components/ExamplePanel';
import { ConfigurationModal } from '../ui/components/ConfigurationModal';
import { FilamentSyncStatus } from '../ui/components/FilamentSyncStatus';
import { Logger } from '../utils/logger';
import { Component } from './Component';
import { parserWorkerService } from '../services/ParserWorkerService';
import { gcodeCache } from '../services/GcodeCache';
import { ColorMergeService, MergeHistoryEntry } from '../services/ColorMergeService';
import { ColorMergePanel } from '../ui/components/ColorMergePanel';
import { MergeHistoryTimeline } from '../ui/components/MergeHistoryTimeline';

// Services
import { FileProcessingService } from '../services/FileProcessingService';
import { OptimizationService, OptimizationAlgorithm } from '../services/OptimizationService';
import { ExportService } from '../services/ExportService';

// Repositories
import { CacheRepository, FileRepository, ICacheRepository } from '../repositories';

// Commands
import {
  CommandExecutor,
  AnalyzeFileCommand,
  ExportResultsCommand,
  ClearCacheCommand,
  ExportFormat,
} from '../commands';

export class App {
  private components: Component[] = [];
  private logger: Logger;

  // Services
  private fileProcessingService: FileProcessingService;
  private optimizationService: OptimizationService;
  private exportService: ExportService;
  private colorMergeService: ColorMergeService;

  // Repositories
  private cacheRepository: ICacheRepository;
  private fileRepository: FileRepository;

  // Command executor
  private commandExecutor: CommandExecutor;

  // UI Components
  private resultsView: ResultsView | null = null;
  private colorMergePanel: ColorMergePanel | null = null;
  private mergeHistoryTimeline: MergeHistoryTimeline | null = null;

  constructor() {
    this.logger = new Logger();

    // Initialize repositories
    this.cacheRepository = new CacheRepository();
    this.fileRepository = new FileRepository();

    // Initialize services
    this.fileProcessingService = new FileProcessingService(this.logger);

    this.optimizationService = new OptimizationService();

    this.exportService = new ExportService(this.fileRepository, this.optimizationService);

    this.colorMergeService = new ColorMergeService();

    // Initialize command executor
    this.commandExecutor = new CommandExecutor(this.logger);

    // Initialize UI components
    this.initializeComponents();
    this.attachEventListeners();

    // Initialize cache
    this.initializeCache();
  }

  private async initializeCache(): Promise<void> {
    const result = await this.cacheRepository.initialize();
    if (!result.ok) {
      this.logger.error('Failed to initialize cache', result.error);
      return;
    }

    // Clean up cache entries with old algorithm versions
    try {
      // Initialize gcodeCache if not already done
      await gcodeCache.initialize();

      // Clean up old algorithm versions
      const deletedCount = await gcodeCache.cleanupOldAlgorithmVersions();
      if (deletedCount > 0) {
        this.logger.info(
          `Cleaned up ${deletedCount} cache entries with outdated algorithm versions`
        );
      }

      // Also clean up expired entries
      const expiredCount = await gcodeCache.cleanupExpired();
      if (expiredCount > 0) {
        this.logger.info(`Cleaned up ${expiredCount} expired cache entries`);
      }
    } catch (error) {
      this.logger.warn('Cache cleanup failed', error);
    }
  }

  private initializeComponents(): void {
    // Initialize main components (not the configuration modal yet)
    this.resultsView = new ResultsView();
    this.colorMergePanel = new ColorMergePanel();
    this.mergeHistoryTimeline = new MergeHistoryTimeline();
    this.components = [
      new FileUploader(),
      this.resultsView,
      new FilamentSyncStatus('body'), // Add sync status indicator
      this.colorMergePanel,
      this.mergeHistoryTimeline,
    ];

    // Initialize configuration modal
    const configModal = new ConfigurationModal();
    this.components.push(configModal);

    // Set up configuration button
    const configBtn = document.getElementById('configBtn');
    if (configBtn) {
      configBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        configModal.toggle();
      });
    }

    // Initialize example panel
    const examplePanelContainer = document.getElementById('examplePanelContainer');
    if (examplePanelContainer) {
      const examplePanel = new ExamplePanel(examplePanelContainer);

      // Set up example panel button
      const examplesBtn = document.getElementById('examplesBtn');
      if (examplesBtn) {
        examplesBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          examplePanel.toggle();
        });
      }
    }

    // Note: Optimization algorithm dropdown has been removed from the main page
    // It's now only available in the printer configuration modal
  }

  private attachEventListeners(): void {
    // File selected event
    eventBus.on(AppEvents.FILE_SELECTED, (file: File) => {
      this.handleFileSelected(file);
    });

    // Export requested event
    eventBus.on(AppEvents.EXPORT_REQUESTED, async () => {
      await this.handleExportRequest();
    });

    // Export G-code with pauses requested event
    eventBus.on(AppEvents.EXPORT_GCODE_REQUESTED, async () => {
      await this.handleExportGcodeRequest();
    });

    // Reset requested event
    eventBus.on(AppEvents.RESET_REQUESTED, () => {
      this.handleReset();
    });

    // Clear cache event
    eventBus.on(AppEvents.CLEAR_CACHE, async () => {
      await this.handleClearCache();
    });

    // Configuration changed event
    eventBus.on(AppEvents.CONFIGURATION_CHANGED, (config) => {
      appState.setConfiguration(config);
      this.logger.info('Configuration updated', config);
    });

    // State changes - re-attach merge button listener
    appState.subscribe((state) => {
      if (state.view === 'results' && state.stats) {
        // Wait for DOM update
        setTimeout(() => {
          const mergeBtn = document.getElementById('openMergePanelBtn');
          if (mergeBtn && this.colorMergePanel) {
            mergeBtn.addEventListener('click', () => {
              this.colorMergePanel!.show();
            });
          }

          // Attach timeline button listener (remove old listener first)
          const timelineBtn = document.getElementById('openTimelineBtn');
          if (timelineBtn && this.mergeHistoryTimeline) {
            // Remove any existing click handler by cloning the button
            const newTimelineBtn = timelineBtn.cloneNode(true) as HTMLElement;
            timelineBtn.parentNode?.replaceChild(newTimelineBtn, timelineBtn);

            // Add fresh click handler
            newTimelineBtn.addEventListener('click', () => {
              this.mergeHistoryTimeline!.toggle();
            });
          }
        }, 100);
      }
    });

    // Listen for Ctrl+Shift+T to toggle timeline
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        if (this.mergeHistoryTimeline && appState.getState().view === 'results') {
          this.mergeHistoryTimeline.toggle();
        }
      }
    });
  }

  private async handleFileSelected(file: File): Promise<void> {
    // Get current configuration from app state
    const currentState = appState.getState();

    // Get selected optimization algorithm from the modal
    const modalAlgorithmSelect = document.getElementById(
      'modalOptimizationAlgorithm'
    ) as HTMLSelectElement;
    const selectedAlgorithm =
      (modalAlgorithmSelect?.value as OptimizationAlgorithm) || OptimizationAlgorithm.Greedy;

    // Create and execute analyze command
    const command = new AnalyzeFileCommand(
      file,
      this.fileProcessingService,
      this.optimizationService,
      this.cacheRepository,
      this.logger,
      {
        useWebWorker: true,
        useCache: true,
        onProgress: (progress, message) => {
          appState.setLoading(true, message, progress);
        },
        configuration: currentState.configuration,
        optimizationAlgorithm: selectedAlgorithm, // Pass the selected algorithm
      }
    );

    const result = await this.commandExecutor.execute(command);

    if (!result.ok) {
      console.error('Error processing file:', result.error);
      appState.setError(`Failed to process file: ${result.error.message}`);
      appState.setLoading(false);
      return;
    }

    const { stats, optimization } = result.value;
    const logs = this.logger.getLogs();

    // Add slight delay for UI feedback
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Update state with results
    appState.setAnalysisResults(stats, optimization, logs);
  }

  private async handleExportRequest(): Promise<void> {
    const state = appState.getState();
    if (!state.stats || !state.optimization) return;

    // Create and execute export command
    const command = new ExportResultsCommand(
      state.stats,
      state.optimization,
      this.exportService,
      ExportFormat.JSON
    );

    const result = await this.commandExecutor.execute(command);

    if (!result.ok) {
      this.logger.error('Failed to export results', result.error);
      appState.setError('Failed to export results');
    }
  }

  private async handleExportGcodeRequest(): Promise<void> {
    const state = appState.getState();
    if (!state.stats || !state.optimization) return;

    const result = this.exportService.exportGcodeWithPauses(state.stats, state.optimization);

    if (!result.ok) {
      this.logger.error('Failed to export G-code with pauses', result.error);
      appState.setError(result.error.message);
    } else {
      this.logger.info('Successfully exported G-code with pauses');
    }
  }

  private async handleClearCache(): Promise<void> {
    // Create and execute clear cache command
    const command = new ClearCacheCommand(this.cacheRepository, this.logger);

    const result = await this.commandExecutor.execute(command);

    if (result.ok) {
      // Show success feedback in UI
      const btn = document.getElementById('clearCacheBtn');
      if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML =
          '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Cleared!';
        btn.classList.add('text-vibrant-teal');
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.classList.remove('text-vibrant-teal');
        }, 2000);
      }
    } else {
      appState.setError('Failed to clear cache');
    }
  }

  private handleReset(): void {
    appState.reset();
    this.logger.clearLogs();
  }

  /**
   * Debug method to force clear filament database sync state
   * Available in browser console as: window.debugFilamentDB.clearSyncState()
   */
  public debugClearFilamentSyncState(): void {
    import('../services/FilamentDatabase').then(({ FilamentDatabase }) => {
      const filamentDb = FilamentDatabase.getInstance();
      filamentDb.forceClearSyncState();
    });
  }

  /**
   * Debug method to force start filament database sync
   * Available in browser console as: window.debugFilamentDB.forceSync()
   */
  public debugForceFilamentSync(): void {
    import('../services/FilamentDatabase').then(({ FilamentDatabase }) => {
      const filamentDb = FilamentDatabase.getInstance();
      filamentDb.startSync(true);
    });
  }

  /**
   * Debug method to get filament database status
   * Available in browser console as: window.debugFilamentDB.getStatus()
   */
  public async debugGetFilamentStatus(): Promise<void> {
    const { FilamentDatabase } = await import('../services/FilamentDatabase');
    const filamentDb = FilamentDatabase.getInstance();
    const stats = await filamentDb.getStats();
    const syncStatus = await filamentDb.getSyncStatus();

    console.log('Filament Database Status:', {
      stats,
      syncStatus,
      storageReady: filamentDb.getStorageReadyStatus(),
    });
  }

  /**
   * Merge colors together
   */
  public async mergeColors(targetColorId: string, sourceColorId: string): Promise<void> {
    const state = appState.getState();
    if (!state.stats || !state.optimization) {
      console.error('No stats or optimization available for merge');
      return;
    }

    // Show loading state
    appState.setLoading(true, 'Merging colors...');

    try {
      // Perform the merge
      const mergeResult = this.colorMergeService.mergeColors(state.stats, targetColorId, [
        sourceColorId,
      ]);

      if (!mergeResult) {
        throw new Error('Failed to merge colors');
      }

      // Re-run optimization with merged stats
      const newOptimization = this.optimizationService.generateOptimization(
        mergeResult.mergedStats,
        state.configuration
      );

      // Update app state with merged results
      appState.setMergedStats(mergeResult.mergedStats, newOptimization, mergeResult.mergeHistory);

      // Show success notification
      this.showMergeNotification(mergeResult.mergeHistory);

      // Log the new constraint state
      if (mergeResult.mergedStats.constraintValidation) {
        const cv = mergeResult.mergedStats.constraintValidation;
        if (!cv.hasViolations) {
          this.logger.info('All constraint violations resolved after merge!');
        } else {
          this.logger.info(
            `Remaining violations after merge: ${cv.summary.impossibleLayerCount} impossible layers`
          );
        }
      }

      // The view will automatically update through state listeners

      appState.setLoading(false);
    } catch (error) {
      console.error('Error merging colors:', error);
      appState.setError(
        `Failed to merge colors: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      appState.setLoading(false);
    }
  }

  private showMergeNotification(mergeHistory: MergeHistoryEntry): void {
    const state = appState.getState();
    const hasViolations = state.stats?.constraintValidation?.hasViolations || false;
    const violationCount = state.stats?.constraintValidation?.summary.impossibleLayerCount || 0;

    // Create and show a notification
    const notification = document.createElement('div');
    notification.className =
      'fixed top-4 right-4 z-50 glass rounded-lg p-4 animate-fade-in max-w-md';
    notification.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <div class="flex-1">
          <div class="text-white font-semibold">Colors Merged Successfully</div>
          <div class="text-white/70 text-sm">
            ${mergeHistory.sourceColorIds.length} color${mergeHistory.sourceColorIds.length > 1 ? 's' : ''} merged, 
            ${mergeHistory.freedSlots.length} slot${mergeHistory.freedSlots.length > 1 ? 's' : ''} freed
          </div>
          ${
            !hasViolations
              ? `
            <div class="text-green-400 text-sm mt-1 font-medium">
              ✓ All constraint violations resolved!
            </div>
          `
              : `
            <div class="text-amber-400 text-sm mt-1">
              ${violationCount} layer${violationCount !== 1 ? 's' : ''} still need attention
            </div>
          `
          }
        </div>
      </div>
    `;

    document.body.appendChild(notification);

    // Remove notification after 4 seconds (slightly longer to read the extra info)
    setTimeout(() => {
      notification.classList.add('animate-fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  public destroy(): void {
    // Save timeline before destroying
    if (this.mergeHistoryTimeline) {
      try {
        const timelineManager = appState.getMergeHistoryManager();
        if (timelineManager) {
          // Trigger save but don't await (app is shutting down)
          timelineManager.saveToStorage().catch((error) => {
            console.warn('Failed to save timeline on destroy:', error);
          });
        }
      } catch (error) {
        console.warn('Failed to save timeline on destroy:', error);
      }
    }

    // Clean up all components
    this.components.forEach((component) => component.destroy());

    // Clean up Web Worker
    parserWorkerService.destroy();

    // Remove all event listeners
    eventBus.removeAllListeners();
  }
}
