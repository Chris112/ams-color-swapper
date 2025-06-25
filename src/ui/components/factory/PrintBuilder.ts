import * as THREE from 'three';
import { EventEmitter } from '../../../core/EventEmitter';
import type { PrintGeometry } from '../../../parser/gcodeToGeometry';

export interface PrintBuilderEvents {
  layerComplete: (layer: number, totalLayers: number) => void;
  buildComplete: () => void;
  buildStarted: () => void;
  buildPaused: () => void;
  buildResumed: () => void;
  speedChanged: (speed: number) => void;
}

export enum BuildState {
  IDLE = 'idle',
  BUILDING = 'building',
  PAUSED = 'paused',
  COMPLETE = 'complete'
}

export interface BuilderConfig {
  defaultSpeed: number; // layers per second
  enableSoundEffects: boolean;
  showProgress: boolean;
  highlightCurrentLayer: boolean;
}

export class PrintBuilder {
  private eventEmitter: EventEmitter<PrintBuilderEvents>;
  private geometry: PrintGeometry;
  private group: THREE.Group;
  private config: BuilderConfig;
  
  private state: BuildState = BuildState.IDLE;
  private currentLayer: number = -1;
  private targetLayer: number = -1;
  private speed: number = 2; // layers per second
  private animationId: number | null = null;
  private startTime: number = 0;
  private pausedTime: number = 0;
  
  // Animation control
  private isPlaying: boolean = false;
  private layerMeshes: Map<number, THREE.Object3D[]> = new Map();
  private currentLayerIndicator?: THREE.Mesh;
  
  constructor(geometry: PrintGeometry, config: Partial<BuilderConfig> = {}) {
    this.eventEmitter = new EventEmitter();
    this.geometry = geometry;
    this.config = {
      defaultSpeed: 2,
      enableSoundEffects: false,
      showProgress: true,
      highlightCurrentLayer: true,
      ...config
    };
    this.speed = this.config.defaultSpeed;
    
    this.setupMeshes();
    this.createCurrentLayerIndicator();
  }
  
  private setupMeshes(): void {
    this.group = new THREE.Group();
    this.layerMeshes.clear();
    
    // Group geometry layers by layer number
    this.geometry.layers.forEach(geometryLayer => {
      if (!this.layerMeshes.has(geometryLayer.layer)) {
        this.layerMeshes.set(geometryLayer.layer, []);
      }
      
      const mesh = new THREE.Mesh(geometryLayer.geometry, geometryLayer.material);
      mesh.userData = {
        layer: geometryLayer.layer,
        toolIndex: geometryLayer.toolIndex,
        color: geometryLayer.color,
        originalMaterial: geometryLayer.material.clone()
      };
      mesh.visible = false;
      
      this.layerMeshes.get(geometryLayer.layer)!.push(mesh);
      this.group.add(mesh);
    });
    
    // Apply center offset
    this.group.position.copy(this.geometry.centerOffset);
  }
  
  private createCurrentLayerIndicator(): void {
    if (!this.config.highlightCurrentLayer) return;
    
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.2, // More subtle
      side: THREE.DoubleSide,
      depthWrite: false // Don't interfere with depth testing
    });
    
    this.currentLayerIndicator = new THREE.Mesh(geometry, material);
    this.currentLayerIndicator.rotation.x = -Math.PI / 2;
    this.currentLayerIndicator.visible = false;
    this.currentLayerIndicator.renderOrder = -1; // Render behind other objects
    this.group.add(this.currentLayerIndicator);
  }
  
  public play(): void {
    if (this.state === BuildState.COMPLETE) {
      this.reset();
    }
    
    if (this.state === BuildState.PAUSED) {
      this.pausedTime += Date.now() - this.startTime;
      this.isPlaying = true;
      this.state = BuildState.BUILDING;
      this.eventEmitter.emit('buildResumed');
      this.animate();
      return;
    }
    
    this.isPlaying = true;
    this.state = BuildState.BUILDING;
    this.targetLayer = this.geometry.totalLayers - 1;
    this.startTime = Date.now();
    this.pausedTime = 0;
    
    this.eventEmitter.emit('buildStarted');
    this.animate();
  }
  
  public pause(): void {
    if (this.state !== BuildState.BUILDING) return;
    
    this.isPlaying = false;
    this.state = BuildState.PAUSED;
    this.eventEmitter.emit('buildPaused');
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  public stop(): void {
    this.isPlaying = false;
    this.state = BuildState.IDLE;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    this.reset();
  }
  
  public reset(): void {
    this.currentLayer = -1;
    this.setVisibleLayer(-1);
    this.state = BuildState.IDLE;
    this.isPlaying = false;
  }
  
  public setSpeed(speed: number): void {
    this.speed = Math.max(0.1, Math.min(speed, 20)); // Clamp between 0.1 and 20
    this.eventEmitter.emit('speedChanged', this.speed);
  }
  
  public getSpeed(): number {
    return this.speed;
  }
  
  public jumpToLayer(layer: number): void {
    const targetLayer = Math.max(-1, Math.min(layer, this.geometry.totalLayers - 1));
    this.currentLayer = targetLayer;
    this.setVisibleLayer(targetLayer);
    
    if (targetLayer >= this.geometry.totalLayers - 1) {
      this.state = BuildState.COMPLETE;
      this.eventEmitter.emit('buildComplete');
    }
  }
  
  public getCurrentLayer(): number {
    return this.currentLayer;
  }
  
  public getTotalLayers(): number {
    return this.geometry.totalLayers;
  }
  
  public getProgress(): number {
    const progress = this.geometry.totalLayers > 0 ? 
      (this.currentLayer + 1) / this.geometry.totalLayers : 0;
    
    // Debug log only if progress is NaN or for first few calls
    if (isNaN(progress) || this.currentLayer < 3) {
      console.log('PrintBuilder progress:', {
        currentLayer: this.currentLayer,
        totalLayers: this.geometry.totalLayers,
        progress,
        isNaN: isNaN(progress)
      });
    }
    
    return progress;
  }
  
  public getState(): BuildState {
    return this.state;
  }
  
  public isAnimating(): boolean {
    return this.isPlaying;
  }

  public toggleLayerIndicator(enabled: boolean): void {
    this.config.highlightCurrentLayer = enabled;
    if (this.currentLayerIndicator) {
      this.currentLayerIndicator.visible = enabled && this.currentLayer >= 0;
    }
  }
  
  private animate(): void {
    if (!this.isPlaying) return;
    
    const elapsed = Date.now() - this.startTime - this.pausedTime;
    const layersToShow = Math.floor((elapsed / 1000) * this.speed);
    const targetLayer = Math.min(layersToShow, this.geometry.totalLayers - 1);
    
    if (targetLayer > this.currentLayer) {
      this.currentLayer = targetLayer;
      this.setVisibleLayer(this.currentLayer);
      
      this.eventEmitter.emit('layerComplete', this.currentLayer, this.geometry.totalLayers);
      
      if (this.currentLayer >= this.geometry.totalLayers - 1) {
        this.state = BuildState.COMPLETE;
        this.isPlaying = false;
        this.eventEmitter.emit('buildComplete');
        return;
      }
    }
    
    this.animationId = requestAnimationFrame(() => this.animate());
  }
  
  private setVisibleLayer(targetLayer: number): void {
    // Update mesh visibility
    for (const [layerNum, meshes] of this.layerMeshes) {
      const visible = layerNum <= targetLayer;
      meshes.forEach(mesh => {
        mesh.visible = visible;
        
        // Highlight current layer
        if (this.config.highlightCurrentLayer && layerNum === targetLayer) {
          this.highlightLayer(mesh);
        } else {
          this.unhighlightLayer(mesh);
        }
      });
    }
    
    // Update layer indicator
    if (this.currentLayerIndicator && this.config.highlightCurrentLayer) {
      if (targetLayer >= 0 && targetLayer < this.geometry.totalLayers) {
        this.updateLayerIndicator(targetLayer);
        this.currentLayerIndicator.visible = true;
      } else {
        this.currentLayerIndicator.visible = false;
      }
    }
  }
  
  private highlightLayer(mesh: THREE.Object3D): void {
    if (mesh instanceof THREE.LineSegments && mesh.material instanceof THREE.LineBasicMaterial) {
      const originalMaterial = mesh.userData.originalMaterial as THREE.LineBasicMaterial;
      mesh.material.color.copy(originalMaterial.color);
      mesh.material.opacity = 1.0;
    }
  }
  
  private unhighlightLayer(mesh: THREE.Object3D): void {
    if (mesh instanceof THREE.LineSegments && mesh.material instanceof THREE.LineBasicMaterial) {
      const originalMaterial = mesh.userData.originalMaterial as THREE.LineBasicMaterial;
      mesh.material.color.copy(originalMaterial.color);
      mesh.material.opacity = 0.6;
    }
  }
  
  private updateLayerIndicator(layer: number): void {
    if (!this.currentLayerIndicator) return;
    
    // Get actual geometry data for this layer
    const layerMeshes = this.layerMeshes.get(layer) || [];
    let actualLayerHeight = 0;
    
    if (layerMeshes.length > 0) {
      // Find the actual Y position of geometry in this layer
      let minY = Infinity;
      let maxY = -Infinity;
      
      layerMeshes.forEach(mesh => {
        const geometry = mesh.geometry;
        const positions = geometry.getAttribute('position');
        if (positions) {
          for (let i = 1; i < positions.count * 3; i += 3) { // Every 3rd element is Y
            const y = positions.array[i];
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      });
      
      if (minY !== Infinity) {
        // Use the average Y position of this layer's geometry
        actualLayerHeight = (minY + maxY) / 2;
      }
    }
    
    // Fallback calculation if we can't find actual geometry
    if (actualLayerHeight === 0) {
      const boundingBox = this.geometry.boundingBox;
      const totalHeight = boundingBox.max.y - boundingBox.min.y;
      const layerHeight = this.geometry.totalLayers > 1 ? totalHeight / this.geometry.totalLayers : 0.02;
      actualLayerHeight = boundingBox.min.y + (layer * layerHeight);
    }
    
    // Position the indicator at the actual layer height
    this.currentLayerIndicator.position.y = actualLayerHeight;
    
    // Scale the indicator to roughly match the print bounds
    const boundingBox = this.geometry.boundingBox;
    const size = boundingBox.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.z);
    this.currentLayerIndicator.scale.set(maxDimension * 1.1, maxDimension * 1.1, 1);
    
    console.log(`Layer indicator: layer=${layer}, actualHeight=${actualLayerHeight.toFixed(3)}, boundingBox Y: ${boundingBox.min.y.toFixed(3)} to ${boundingBox.max.y.toFixed(3)}`);
  }
  
  // Event handling methods
  public on<K extends keyof PrintBuilderEvents>(
    event: K,
    handler: PrintBuilderEvents[K]
  ): void {
    this.eventEmitter.on(event, handler);
  }
  
  public off<K extends keyof PrintBuilderEvents>(
    event: K,
    handler: PrintBuilderEvents[K]
  ): void {
    this.eventEmitter.off(event, handler);
  }
  
  public getMesh(): THREE.Group {
    return this.group;
  }
  
  public dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    // Dispose of geometries and materials
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) {
          object.material.dispose();
        }
        if (object.userData.originalMaterial instanceof THREE.Material) {
          object.userData.originalMaterial.dispose();
        }
      }
    });
    
    this.layerMeshes.clear();
    this.eventEmitter.removeAllListeners();
  }
  
  // Static factory methods
  public static async createFromGcode(
    gcodeContent: string,
    stats: any,
    config?: Partial<BuilderConfig>
  ): Promise<PrintBuilder> {
    const { GcodeToGeometryConverter } = await import('../../../parser/gcodeToGeometry');
    const converter = new GcodeToGeometryConverter();
    const geometry = converter.convertGcodeToGeometry(gcodeContent, stats);
    return new PrintBuilder(geometry, config);
  }
  
  public static async createQuickPreview(geometry: PrintGeometry): Promise<THREE.Group> {
    const { GcodeToGeometryConverter } = await import('../../../parser/gcodeToGeometry');
    return GcodeToGeometryConverter.createPreviewMesh(geometry);
  }
}

// Utility class for managing multiple print builders
export class PrintBuilderManager {
  private builders: Map<string, PrintBuilder> = new Map();
  private eventEmitter: EventEmitter<{ builderStateChanged: (id: string, state: BuildState) => void }>;
  
  constructor() {
    this.eventEmitter = new EventEmitter();
  }
  
  public addBuilder(id: string, builder: PrintBuilder): void {
    if (this.builders.has(id)) {
      this.removeBuilder(id);
    }
    
    this.builders.set(id, builder);
    
    // Listen to builder events
    builder.on('buildStarted', () => {
      this.eventEmitter.emit('builderStateChanged', id, BuildState.BUILDING);
    });
    
    builder.on('buildPaused', () => {
      this.eventEmitter.emit('builderStateChanged', id, BuildState.PAUSED);
    });
    
    builder.on('buildComplete', () => {
      this.eventEmitter.emit('builderStateChanged', id, BuildState.COMPLETE);
    });
  }
  
  public removeBuilder(id: string): void {
    const builder = this.builders.get(id);
    if (builder) {
      builder.dispose();
      this.builders.delete(id);
    }
  }
  
  public getBuilder(id: string): PrintBuilder | undefined {
    return this.builders.get(id);
  }
  
  public pauseAll(): void {
    this.builders.forEach(builder => builder.pause());
  }
  
  public playAll(): void {
    this.builders.forEach(builder => builder.play());
  }
  
  public stopAll(): void {
    this.builders.forEach(builder => builder.stop());
  }
  
  public setGlobalSpeed(speed: number): void {
    this.builders.forEach(builder => builder.setSpeed(speed));
  }
  
  public on(event: 'builderStateChanged', handler: (id: string, state: BuildState) => void): void {
    this.eventEmitter.on(event, handler);
  }
  
  public dispose(): void {
    this.builders.forEach(builder => builder.dispose());
    this.builders.clear();
    this.eventEmitter.removeAllListeners();
  }
}