import { appState } from '../state/AppState';
import { eventBus, AppEvents } from './EventEmitter';
import { FileUploader } from '../ui/components/FileUploader';
import { ResultsView } from '../ui/components/ResultsView';
import { FactoryFloorUI } from '../ui/components/FactoryFloorUI';
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

// Factory Floor Components
import { FactoryFloorScene } from '../ui/components/factory/FactoryFloorScene';
import { FactoryFloorService, FactoryState } from '../services/FactoryFloorService';

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

  // Factory Floor
  private factoryFloorScene: FactoryFloorScene | null = null;
  private factoryFloorService: FactoryFloorService | null = null;
  private factoryFloorUI: FactoryFloorUI | null = null;
  private currentView: 'analysis' | 'factory' = 'analysis';

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

    // Initialize factory floor UI separately when needed
    this.factoryFloorUI = new FactoryFloorUI();
    // Initialize factory floor UI immediately so button listeners work
    this.factoryFloorUI.initialize();
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

    // View toggle event
    eventBus.on('VIEW_TOGGLE' as any, (view: 'analysis' | 'factory') => {
      this.switchView(view);
    });

    // Factory floor events
    eventBus.on('BUILD_SPEED_CHANGED' as any, (speed: number) => {
      if (this.factoryFloorService) {
        this.factoryFloorService.setBuildSpeed(speed);
      }
    });

    eventBus.on('PAUSE_ALL_BUILDS' as any, () => {
      if (this.factoryFloorService) {
        this.factoryFloorService.pauseAllBuilds();
      }
    });

    eventBus.on('RESUME_ALL_BUILDS' as any, () => {
      if (this.factoryFloorService) {
        this.factoryFloorService.resumeAllBuilds();
      }
    });

    eventBus.on('CLEAR_FACTORY' as any, () => {
      if (this.factoryFloorService) {
        this.factoryFloorService.clearFactory();
      }
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
          
          // Attach timeline button listener
          const timelineBtn = document.getElementById('openTimelineBtn');
          if (timelineBtn && this.mergeHistoryTimeline) {
            timelineBtn.addEventListener('click', () => {
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

    // Show view navigation now that analysis is complete
    const viewNavigation = document.getElementById('viewNavigation');
    if (viewNavigation) {
      viewNavigation.style.display = 'block';
      viewNavigation.classList.remove('hidden');
      viewNavigation.removeAttribute('hidden');
    }

    // Initialize factory floor UI now that results section is visible
    if (this.factoryFloorUI) {
      this.factoryFloorUI.initialize();
    }

    // Add to factory floor if service is available
    if (this.factoryFloorService) {
      try {
        const fileContent = await file.text();
        await this.factoryFloorService.addPrint(file.name, fileContent, stats);
      } catch (error) {
        console.warn('Failed to add print to factory floor:', error);
      }
    }
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

    // Hide the view navigation section
    const viewNavigation = document.getElementById('viewNavigation');
    if (viewNavigation) {
      viewNavigation.setAttribute('hidden', '');
    }

    // Switch back to analysis view if in factory view
    if (this.currentView === 'factory') {
      this.switchView('analysis');
    }
  }

  private switchView(view: 'analysis' | 'factory'): void {
    this.currentView = view;

    const analysisSection = document.getElementById('resultsSection');
    const factorySection = document.getElementById('factorySection');
    const viewNavigation = document.getElementById('viewNavigation');

    // Always show the navigation header when switching views (if results exist)
    if (viewNavigation && appState.getState().stats) {
      viewNavigation.style.display = 'block';
      viewNavigation.classList.remove('hidden');
      viewNavigation.removeAttribute('hidden');
    }

    if (view === 'factory') {
      // Show factory section FIRST so container has dimensions
      if (analysisSection) {
        analysisSection.style.display = 'none';
        analysisSection.classList.add('hidden');
        analysisSection.setAttribute('hidden', '');
      }
      if (factorySection) {
        factorySection.style.display = 'block';
        factorySection.classList.remove('hidden');
        factorySection.removeAttribute('hidden');
      }

      // Initialize factory floor AFTER showing the section
      if (!this.factoryFloorScene) {
        // Wait a frame for the layout to update
        requestAnimationFrame(() => {
          this.initializeFactoryFloor();
        });
      }
    } else {
      // Show analysis section, hide factory
      if (analysisSection) {
        analysisSection.style.display = 'block';
        analysisSection.classList.remove('hidden');
        analysisSection.removeAttribute('hidden');
      }
      if (factorySection) {
        factorySection.style.display = 'none';
        factorySection.classList.add('hidden');
        factorySection.setAttribute('hidden', '');
      }
    }

    // Update toggle buttons
    this.updateViewToggleButtons();
  }

  private initializeFactoryFloor(): void {
    // Initializing factory floor...
    const container = document.getElementById('factoryFloorContainer');
    // Container found

    if (!container) {
      // Factory floor container not found
      return;
    }

    // Clear any loading messages
    const loadingDivs = container.querySelectorAll('.absolute, div');
    loadingDivs.forEach((div) => {
      if (div !== container && div.parentNode === container) {
        // Removing loading div
        div.remove();
      }
    });

    try {
      // Creating FactoryFloorScene...
      this.factoryFloorScene = new FactoryFloorScene(container);

      // Creating FactoryFloorService...
      this.factoryFloorService = new FactoryFloorService(this.factoryFloorScene, {
        autoStartBuilding: true,
        maxConcurrentBuilds: 3,
        buildSpeed: 2,
        persistData: true, // Re-enabled with IndexedDB
        enableAnimations: true,
      });

      // Set up factory floor event listeners
      this.setupFactoryFloorEvents();

      // Add current file to factory floor if available
      this.addCurrentFileToFactory();

      // Factory floor initialized successfully
    } catch (error) {
      // Failed to initialize factory floor
    }
  }

  private setupFactoryFloorEvents(): void {
    if (!this.factoryFloorService) return;

    this.factoryFloorService.on('printSelected', (_data: { printId: string | null }) => {
      this.updateFactoryFloorUI();
    });

    this.factoryFloorService.on('factoryStateChanged', (data: { state: FactoryState }) => {
      this.updateFactoryStatsUI(data.state);
    });

    this.factoryFloorService.on('buildingStarted', (_data: { printId: string }) => {
      // Started building print
    });

    this.factoryFloorService.on('buildingCompleted', (_data: { printId: string }) => {
      // Completed building print
    });
  }

  private async addCurrentFileToFactory(): Promise<void> {
    if (!this.factoryFloorService) return;

    const state = appState.getState();
    if (state.currentFile && state.stats) {
      try {
        // Adding current file to factory floor

        // Read the file content
        const fileContent = await this.readFileAsText(state.currentFile);

        // Add to factory floor
        await this.factoryFloorService.addPrint(state.currentFile.name, fileContent, state.stats);

        // Successfully added current file to factory floor
      } catch (error) {
        // Failed to add current file to factory floor
      }
    }
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result && typeof e.target.result === 'string') {
          resolve(e.target.result);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  private updateViewToggleButtons(): void {
    const analysisBtn = document.getElementById('analysisViewBtn');
    const factoryBtn = document.getElementById('factoryViewBtn');

    if (analysisBtn && factoryBtn) {
      if (this.currentView === 'analysis') {
        analysisBtn.classList.add('bg-vibrant-blue', 'text-white');
        analysisBtn.classList.remove('bg-white/10', 'text-white/70');
        factoryBtn.classList.remove('bg-vibrant-blue', 'text-white');
        factoryBtn.classList.add('bg-white/10', 'text-white/70');
      } else {
        factoryBtn.classList.add('bg-vibrant-blue', 'text-white');
        factoryBtn.classList.remove('bg-white/10', 'text-white/70');
        analysisBtn.classList.remove('bg-vibrant-blue', 'text-white');
        analysisBtn.classList.add('bg-white/10', 'text-white/70');
      }
    }
  }

  private updateFactoryFloorUI(): void {
    if (!this.factoryFloorService) return;

    const selectedPrint = this.factoryFloorService.getSelectedPrint();
    const infoPanel = document.getElementById('printInfoPanel');

    if (selectedPrint && infoPanel) {
      infoPanel.innerHTML = `
        <h4 class="text-lg font-semibold text-white mb-2">${selectedPrint.filename}</h4>
        <div class="space-y-1 text-sm text-white/70">
          <p>Layers: ${selectedPrint.stats.totalLayers}</p>
          <p>Colors: ${selectedPrint.stats.colors.length}</p>
          <p>Progress: ${Math.round(selectedPrint.buildProgress * 100)}%</p>
          <p>Added: ${selectedPrint.dateAdded.toLocaleDateString()}</p>
        </div>
      `;
      infoPanel.style.display = 'block';
    } else if (infoPanel) {
      infoPanel.style.display = 'none';
    }
  }

  private updateFactoryStatsUI(state: FactoryState): void {
    const statsPanel = document.getElementById('factoryStatsPanel');
    if (statsPanel) {
      statsPanel.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div class="glass rounded-lg p-3">
            <div class="text-2xl font-bold text-vibrant-blue">${state.totalPrints}</div>
            <div class="text-sm text-white/60">Total Prints</div>
          </div>
          <div class="glass rounded-lg p-3">
            <div class="text-2xl font-bold text-vibrant-green">${state.activePrints}</div>
            <div class="text-sm text-white/60">Building</div>
          </div>
          <div class="glass rounded-lg p-3">
            <div class="text-2xl font-bold text-vibrant-purple">${state.completedPrints}</div>
            <div class="text-sm text-white/60">Completed</div>
          </div>
          <div class="glass rounded-lg p-3">
            <div class="text-2xl font-bold text-vibrant-orange">${state.queuedPrints}</div>
            <div class="text-sm text-white/60">Queued</div>
          </div>
        </div>
      `;
    }
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
      storageReady: (filamentDb as any).isStorageReady,
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
      const mergeResult = this.colorMergeService.mergeColors(
        state.stats,
        targetColorId,
        [sourceColorId]
      );

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
          this.logger.info(`Remaining violations after merge: ${cv.summary.impossibleLayerCount} impossible layers`);
        }
      }

      // The view will automatically update through state listeners

      appState.setLoading(false);
    } catch (error) {
      console.error('Error merging colors:', error);
      appState.setError(`Failed to merge colors: ${error instanceof Error ? error.message : 'Unknown error'}`);
      appState.setLoading(false);
    }
  }

  private showMergeNotification(mergeHistory: MergeHistoryEntry): void {
    const state = appState.getState();
    const hasViolations = state.stats?.constraintValidation?.hasViolations || false;
    const violationCount = state.stats?.constraintValidation?.summary.impossibleLayerCount || 0;

    // Create and show a notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 z-50 glass rounded-lg p-4 animate-fade-in max-w-md';
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
          ${!hasViolations ? `
            <div class="text-green-400 text-sm mt-1 font-medium">
              ✓ All constraint violations resolved!
            </div>
          ` : `
            <div class="text-amber-400 text-sm mt-1">
              ${violationCount} layer${violationCount !== 1 ? 's' : ''} still need attention
            </div>
          `}
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
    // Clean up factory floor
    if (this.factoryFloorService) {
      this.factoryFloorService.dispose();
    }

    if (this.factoryFloorUI) {
      this.factoryFloorUI.destroy();
    }
    
    // Save timeline before destroying
    if (this.mergeHistoryTimeline) {
      try {
        const timelineManager = (appState as any).mergeHistoryManager;
        if (timelineManager && timelineManager.saveToStorage) {
          // Trigger save but don't await (app is shutting down)
          timelineManager.saveToStorage().catch((error: any) => {
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
