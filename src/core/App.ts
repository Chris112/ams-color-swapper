import { appState } from '../state/AppState';
import { eventBus, AppEvents } from './EventEmitter';
import { FileUploader } from '../ui/components/FileUploader';
import { ResultsView } from '../ui/components/ResultsView';
import { DebugPanel } from '../ui/components/DebugPanel';
import { GcodeParser } from '../parser/gcodeParser';
import { Logger } from '../utils/logger';
import { GcodeStats, OptimizationResult, SlotAssignment } from '../types';

export class App {
  private components: any[] = [];
  private logger: Logger;
  private parser: GcodeParser;

  constructor() {
    this.logger = new Logger();
    this.parser = new GcodeParser(this.logger);
    
    this.initializeComponents();
    this.attachEventListeners();
  }

  private initializeComponents(): void {
    // Initialize all components
    this.components = [
      new FileUploader(),
      new ResultsView(),
      new DebugPanel(),
    ];
  }

  private attachEventListeners(): void {
    // File selected event
    eventBus.on(AppEvents.FILE_SELECTED, (file: File) => {
      this.handleFileSelected(file);
    });

    // Export requested event
    eventBus.on(AppEvents.EXPORT_REQUESTED, () => {
      this.exportResults();
    });

    // Reset requested event
    eventBus.on(AppEvents.RESET_REQUESTED, () => {
      this.reset();
    });

    // Debug toggle event
    eventBus.on(AppEvents.DEBUG_TOGGLE, () => {
      const currentState = appState.getState();
      appState.setState({ debugVisible: !currentState.debugVisible });
    });
  }

  private async handleFileSelected(file: File): Promise<void> {
    try {
      // Show loading state
      appState.setLoading(true, 'Reading file...', 10);

      // Simulate progress updates with more granular steps
      const progressInterval = setInterval(() => {
        const state = appState.getState();
        if (state.loadingProgress < 90) {
          const newProgress = Math.min(state.loadingProgress + 5, 90);
          const message = newProgress < 30 ? 'Reading file...' : 
                         newProgress < 60 ? 'Parsing G-code...' : 
                         'Analyzing colors...';
          appState.setLoading(true, message, newProgress);
        }
      }, 100);

      // Parse the file
      const stats = await this.parser.parse(file);
      
      clearInterval(progressInterval);
      appState.setLoading(true, 'Optimizing...', 95);

      // Add a small delay to show the final progress
      await new Promise(resolve => setTimeout(resolve, 300));

      // Generate optimization
      const optimization = this.createOptimization(stats);
      
      // Get logs
      const logs = this.logger.getLogs();

      // Show 100% briefly before showing results
      appState.setLoading(true, 'Complete!', 100);
      await new Promise(resolve => setTimeout(resolve, 200));

      // Update state with results
      console.log('Setting analysis results:', { stats, optimization, logsCount: logs.length });
      appState.setAnalysisResults(stats, optimization, logs);

    } catch (error) {
      console.error('Error processing file:', error);
      appState.setError(`Failed to process file: ${(error as Error).message}`);
      appState.setLoading(false);
    }
  }

  private createOptimization(stats: GcodeStats): OptimizationResult {
    // Simple optimization for demo - in production this would be more sophisticated
    const colorCount = stats.colors.length;
    
    // For 4 or fewer colors, assign each to a slot
    if (colorCount <= 4) {
      const slotAssignments: SlotAssignment[] = stats.colors.map((color, index) => ({
        slot: index + 1,
        colors: [color.id],
        isPermanent: true,
      }));

      return {
        totalColors: colorCount,
        requiredSlots: colorCount,
        slotAssignments: slotAssignments.slice(0, 4),
        manualSwaps: [],
        estimatedTimeSaved: 0,
        canShareSlots: [],
      };
    }

    // For more than 4 colors, we need manual swaps
    const permanentSlots = stats.colors.slice(0, 3).map((color, index) => ({
      slot: index + 1,
      colors: [color.id],
      isPermanent: true,
    }));

    const sharedSlot: SlotAssignment = {
      slot: 4,
      colors: stats.colors.slice(3).map(c => c.id),
      isPermanent: false,
    };

    const manualSwaps = this.generateManualSwaps(stats, sharedSlot);

    return {
      totalColors: colorCount,
      requiredSlots: 4,
      slotAssignments: [...permanentSlots, sharedSlot],
      manualSwaps,
      estimatedTimeSaved: manualSwaps.length * 120, // 2 minutes per swap saved
      canShareSlots: sharedSlot.colors,
    };
  }

  private generateManualSwaps(stats: GcodeStats, sharedSlot: SlotAssignment): any[] {
    const swaps: any[] = [];
    const sharedColors = sharedSlot.colors;

    for (let i = 1; i < sharedColors.length; i++) {
      const fromColor = stats.colors.find(c => c.id === sharedColors[i - 1]);
      const toColor = stats.colors.find(c => c.id === sharedColors[i]);
      
      if (fromColor && toColor) {
        swaps.push({
          slot: sharedSlot.slot,
          fromColor: fromColor.id,
          toColor: toColor.id,
          atLayer: toColor.firstLayer,
          zHeight: 0, // Would calculate from layer height
          reason: `Color ${toColor.id} starts at layer ${toColor.firstLayer}`,
        });
      }
    }

    return swaps;
  }

  private exportResults(): void {
    const state = appState.getState();
    if (!state.stats || !state.optimization) return;

    const exportData = {
      fileName: state.stats.fileName,
      analysis: {
        colors: state.stats.colors,
        optimization: state.optimization,
      },
      instructions: this.generateInstructions(state.stats, state.optimization),
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `ams-optimization-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  private generateInstructions(stats: GcodeStats, opt: OptimizationResult): string {
    let instructions = `AMS COLOR OPTIMIZATION REPORT\n`;
    instructions += `============================\n\n`;
    instructions += `File: ${stats.fileName}\n`;
    instructions += `Total Colors: ${opt.totalColors}\n`;
    instructions += `Required Slots: ${opt.requiredSlots}\n`;
    instructions += `Manual Swaps: ${opt.manualSwaps.length}\n\n`;

    instructions += `SLOT ASSIGNMENTS:\n`;
    opt.slotAssignments.forEach(slot => {
      instructions += `  Slot ${slot.slot}: ${slot.colors.join(', ')} ${slot.isPermanent ? '(Permanent)' : '(Shared)'}\n`;
    });

    if (opt.manualSwaps.length > 0) {
      instructions += `\nMANUAL SWAP INSTRUCTIONS:\n`;
      opt.manualSwaps.forEach((swap, index) => {
        instructions += `  ${index + 1}. At layer ${swap.atLayer}: Remove ${swap.fromColor}, Insert ${swap.toColor} in Slot ${swap.slot}\n`;
      });
    }

    return instructions;
  }

  private reset(): void {
    appState.reset();
    this.logger.clearLogs();
  }

  public destroy(): void {
    // Clean up all components
    this.components.forEach(component => component.destroy());
    
    // Remove all event listeners
    eventBus.removeAllListeners();
  }
}