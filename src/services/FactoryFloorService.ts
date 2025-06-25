import * as THREE from 'three';
import { EventEmitter } from '../core/EventEmitter';
import { FactoryFloorScene, PrintObject } from '../ui/components/factory/FactoryFloorScene';
import { PrintBuilder, PrintBuilderManager, BuildState } from '../ui/components/factory/PrintBuilder';
import { GcodeStats } from '../types';
import { IFactoryFloorRepository, FactoryFloorRepository } from '../repositories';

export interface FactoryFloorEvents {
  printAdded: (printId: string) => void;
  printRemoved: (printId: string) => void;
  printSelected: (printId: string | null) => void;
  buildingStarted: (printId: string) => void;
  buildingCompleted: (printId: string) => void;
  factoryStateChanged: (state: FactoryState) => void;
}

export interface PrintData {
  id: string;
  filename: string;
  gcodeContent: string;
  stats: GcodeStats;
  dateAdded: Date;
  buildProgress: number;
  isBuilding: boolean;
}

export interface FactoryState {
  totalPrints: number;
  activePrints: number;
  completedPrints: number;
  queuedPrints: number;
}

export interface FactoryFloorConfig {
  autoStartBuilding: boolean;
  maxConcurrentBuilds: number;
  buildSpeed: number;
  persistData: boolean;
  enableAnimations: boolean;
}

export class FactoryFloorService {
  private eventEmitter: EventEmitter<FactoryFloorEvents>;
  private scene: FactoryFloorScene;
  private builderManager: PrintBuilderManager;
  private config: FactoryFloorConfig;
  private repository: IFactoryFloorRepository;
  
  private prints: Map<string, PrintData> = new Map();
  private selectedPrintId: string | null = null;
  private activeBuildCount: number = 0;
  private storageKey = 'factoryFloorPrints';
  
  constructor(
    scene: FactoryFloorScene,
    config: Partial<FactoryFloorConfig> = {}
  ) {
    this.eventEmitter = new EventEmitter();
    this.scene = scene;
    this.builderManager = new PrintBuilderManager();
    this.repository = new FactoryFloorRepository();
    
    this.config = {
      autoStartBuilding: true,
      maxConcurrentBuilds: 3,
      buildSpeed: 2,
      persistData: true, // Re-enable persistence with IndexedDB
      enableAnimations: true,
      ...config
    };
    
    this.setupEventListeners();
    
    if (this.config.persistData) {
      this.initializeRepository();
    }
  }
  
  private setupEventListeners(): void {
    // Scene events
    this.scene.on('printClicked', (printId) => {
      this.selectPrint(printId);
    });
    
    // Builder manager events
    this.builderManager.on('builderStateChanged', (printId, state) => {
      this.handleBuilderStateChange(printId, state);
    });
  }
  
  private handleBuilderStateChange(printId: string, state: BuildState): void {
    const printData = this.prints.get(printId);
    if (!printData) return;
    
    switch (state) {
      case BuildState.BUILDING:
        printData.isBuilding = true;
        this.activeBuildCount++;
        this.eventEmitter.emit('buildingStarted', printId);
        break;
        
      case BuildState.COMPLETE:
        printData.isBuilding = false;
        printData.buildProgress = 1;
        this.activeBuildCount = Math.max(0, this.activeBuildCount - 1);
        this.eventEmitter.emit('buildingCompleted', printId);
        this.tryStartNextBuild();
        break;
        
      case BuildState.PAUSED:
      case BuildState.IDLE:
        printData.isBuilding = false;
        this.activeBuildCount = Math.max(0, this.activeBuildCount - 1);
        break;
    }
    
    this.emitFactoryStateChanged();
    
    if (this.config.persistData) {
      this.persistData().catch(error => 
        console.warn('Failed to persist data after state change:', error)
      );
    }
  }
  
  public async addPrint(
    filename: string,
    gcodeContent: string,
    stats: GcodeStats
  ): Promise<string> {
    const printId = this.generatePrintId();
    
    try {
      // Convert G-code to geometry
      const { GcodeToGeometryConverter } = await import('../parser/gcodeToGeometry');
      const converter = new GcodeToGeometryConverter();
      const geometry = await this.processGcodeAsync(converter, gcodeContent, stats);
      
      // Create print builder
      const builder = new PrintBuilder(geometry, {
        defaultSpeed: this.config.buildSpeed,
        enableSoundEffects: false,
        showProgress: true,
        highlightCurrentLayer: false // Disable confusing layer indicator
      });
      
      // Create print object for the scene
      const printObject: PrintObject = {
        id: printId,
        mesh: builder.getMesh(),
        position: new THREE.Vector3(),
        metadata: {
          filename,
          layers: stats.totalLayers,
          colors: stats.colors.map(c => c.hexColor || '#ffffff'),
          printTime: stats.printTime
        }
      };
      
      // Create print data
      const printData: PrintData = {
        id: printId,
        filename,
        gcodeContent,
        stats,
        dateAdded: new Date(),
        buildProgress: 0,
        isBuilding: false
      };
      
      // Add to collections
      this.prints.set(printId, printData);
      this.builderManager.addBuilder(printId, builder);
      this.scene.addPrint(printObject);
      
      // Set up builder event listeners
      builder.on('layerComplete', (layer, totalLayers) => {
        printData.buildProgress = layer / totalLayers;
      });
      
      this.eventEmitter.emit('printAdded', printId);
      this.emitFactoryStateChanged();
      
      // Auto-start building if enabled and we have capacity
      if (this.config.autoStartBuilding && this.canStartNewBuild()) {
        this.startBuilding(printId);
      }
      
      if (this.config.persistData) {
        this.persistData();
      }
      
      return printId;
      
    } catch (error) {
      console.error('Failed to add print:', error);
      throw new Error(`Failed to process G-code file: ${error.message}`);
    }
  }
  
  private async processGcodeAsync(
    converter: GcodeToGeometryConverter,
    gcodeContent: string,
    stats: GcodeStats
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // Use setTimeout to make processing non-blocking
      setTimeout(() => {
        try {
          const geometry = converter.convertGcodeToGeometry(gcodeContent, stats);
          resolve(geometry);
        } catch (error) {
          reject(error);
        }
      }, 0);
    });
  }
  
  public removePrint(printId: string): boolean {
    const printData = this.prints.get(printId);
    if (!printData) return false;
    
    // Stop building if active
    const builder = this.builderManager.getBuilder(printId);
    if (builder) {
      builder.stop();
    }
    
    // Clean up
    this.builderManager.removeBuilder(printId);
    this.scene.removePrint(printId);
    this.prints.delete(printId);
    
    if (this.selectedPrintId === printId) {
      this.selectedPrintId = null;
      this.eventEmitter.emit('printSelected', null);
    }
    
    this.eventEmitter.emit('printRemoved', printId);
    this.emitFactoryStateChanged();
    
    if (this.config.persistData) {
      this.persistData().catch(error => 
        console.warn('Failed to persist data after state change:', error)
      );
    }
    
    return true;
  }
  
  public startBuilding(printId: string): boolean {
    if (!this.canStartNewBuild()) {
      return false;
    }
    
    const builder = this.builderManager.getBuilder(printId);
    if (!builder) return false;
    
    builder.setSpeed(this.config.buildSpeed);
    builder.play();
    return true;
  }
  
  public pauseBuilding(printId: string): boolean {
    const builder = this.builderManager.getBuilder(printId);
    if (!builder) return false;
    
    builder.pause();
    return true;
  }
  
  public stopBuilding(printId: string): boolean {
    const builder = this.builderManager.getBuilder(printId);
    if (!builder) return false;
    
    builder.stop();
    return true;
  }
  
  public selectPrint(printId: string | null): void {
    this.selectedPrintId = printId;
    this.eventEmitter.emit('printSelected', printId);
    
    if (printId) {
      this.scene.focusOnPrint(printId);
    } else {
      this.scene.resetCamera();
    }
  }
  
  public getSelectedPrint(): PrintData | null {
    return this.selectedPrintId ? this.prints.get(this.selectedPrintId) || null : null;
  }
  
  public getAllPrints(): PrintData[] {
    return Array.from(this.prints.values());
  }
  
  public getPrint(printId: string): PrintData | undefined {
    return this.prints.get(printId);
  }
  
  public getFactoryState(): FactoryState {
    const allPrints = Array.from(this.prints.values());
    
    return {
      totalPrints: allPrints.length,
      activePrints: allPrints.filter(p => p.isBuilding).length,
      completedPrints: allPrints.filter(p => p.buildProgress >= 1).length,
      queuedPrints: allPrints.filter(p => p.buildProgress === 0 && !p.isBuilding).length
    };
  }
  
  public setBuildSpeed(speed: number): void {
    this.config.buildSpeed = Math.max(0.1, Math.min(speed, 20));
    this.builderManager.setGlobalSpeed(this.config.buildSpeed);
  }
  
  public getBuildSpeed(): number {
    return this.config.buildSpeed;
  }
  
  public pauseAllBuilds(): void {
    this.builderManager.pauseAll();
  }
  
  public resumeAllBuilds(): void {
    this.builderManager.playAll();
  }
  
  public stopAllBuilds(): void {
    this.builderManager.stopAll();
    this.activeBuildCount = 0;
    this.emitFactoryStateChanged();
  }
  
  public clearFactory(): void {
    this.stopAllBuilds();
    
    const printIds = Array.from(this.prints.keys());
    printIds.forEach(id => this.removePrint(id));
    
    if (this.config.persistData) {
      this.clearPersistedData();
    }
  }
  
  private canStartNewBuild(): boolean {
    return this.activeBuildCount < this.config.maxConcurrentBuilds;
  }
  
  private tryStartNextBuild(): void {
    if (!this.config.autoStartBuilding || !this.canStartNewBuild()) {
      return;
    }
    
    // Find next queued print
    const queuedPrint = Array.from(this.prints.values())
      .find(p => p.buildProgress === 0 && !p.isBuilding);
    
    if (queuedPrint) {
      this.startBuilding(queuedPrint.id);
    }
  }
  
  private emitFactoryStateChanged(): void {
    this.eventEmitter.emit('factoryStateChanged', this.getFactoryState());
  }
  
  private generatePrintId(): string {
    return `print_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Persistence methods
  private async initializeRepository(): Promise<void> {
    try {
      await this.repository.initialize();
      await this.loadPersistedData();
    } catch (error) {
      console.warn('Failed to initialize factory floor repository:', error);
    }
  }

  private async persistData(): Promise<void> {
    if (!this.config.persistData) return;
    
    try {
      await this.repository.save(this.prints);
    } catch (error) {
      console.warn('Failed to persist factory floor data:', error);
    }
  }
  
  private async loadPersistedData(): Promise<void> {
    try {
      const result = await this.repository.load();
      if (!result.ok) {
        console.warn('Failed to load persisted data:', result.error);
        return;
      }
      
      this.prints = result.value;
      
      // Note: We only load metadata, not the actual G-code content
      // Users will need to re-upload files to see the 3D visualization
      // Found persisted prints. Re-upload files to view them.
      
    } catch (error) {
      console.warn('Failed to load persisted factory floor data:', error);
    }
  }
  
  private async clearPersistedData(): Promise<void> {
    try {
      await this.repository.clear();
    } catch (error) {
      console.warn('Failed to clear persisted data:', error);
    }
  }
  
  // Event handling
  public on<K extends keyof FactoryFloorEvents>(
    event: K,
    handler: FactoryFloorEvents[K]
  ): void {
    this.eventEmitter.on(event, handler);
  }
  
  public off<K extends keyof FactoryFloorEvents>(
    event: K,
    handler: FactoryFloorEvents[K]
  ): void {
    this.eventEmitter.off(event, handler);
  }
  
  public dispose(): void {
    this.stopAllBuilds();
    this.builderManager.dispose();
    this.scene.dispose();
    this.prints.clear();
    this.eventEmitter.removeAllListeners();
  }
}

// Factory Floor Statistics
export class FactoryFloorStats {
  private service: FactoryFloorService;
  
  constructor(service: FactoryFloorService) {
    this.service = service;
  }
  
  public getTotalPrintTime(): string {
    const prints = this.service.getAllPrints();
    const totalMinutes = prints.reduce((sum, print) => {
      const timeStr = print.stats.printTime;
      if (timeStr) {
        const minutes = this.parseTimeString(timeStr);
        return sum + minutes;
      }
      return sum;
    }, 0);
    
    return this.formatMinutes(totalMinutes);
  }
  
  public getTotalFilamentUsed(): number {
    const prints = this.service.getAllPrints();
    return prints.reduce((sum, print) => {
      return sum + (print.stats.filamentUsage?.total || 0);
    }, 0);
  }
  
  public getColorDistribution(): Map<string, number> {
    const colorCounts = new Map<string, number>();
    const prints = this.service.getAllPrints();
    
    prints.forEach(print => {
      print.stats.colors.forEach(color => {
        const colorKey = color.hexColor || color.name || 'Unknown';
        colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
      });
    });
    
    return colorCounts;
  }
  
  public getAverageComplexity(): number {
    const prints = this.service.getAllPrints();
    if (prints.length === 0) return 0;
    
    const totalLayers = prints.reduce((sum, print) => sum + print.stats.totalLayers, 0);
    return totalLayers / prints.length;
  }
  
  private parseTimeString(timeStr: string): number {
    // Parse strings like "2h 30m" or "45m" into minutes
    const hours = timeStr.match(/(\d+)h/);
    const minutes = timeStr.match(/(\d+)m/);
    
    return (hours ? parseInt(hours[1]) * 60 : 0) + (minutes ? parseInt(minutes[1]) : 0);
  }
  
  private formatMinutes(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}