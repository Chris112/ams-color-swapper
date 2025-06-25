import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VoxelData, InteractionState, ViewMode, HologramEvents } from './types';

export class InteractionController {
  private controls: OrbitControls;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private state: InteractionState;
  private events: Partial<HologramEvents>;
  private animationId: number | null = null;
  
  constructor(
    private camera: THREE.Camera,
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    events: Partial<HologramEvents> = {}
  ) {
    this.controls = new OrbitControls(camera, renderer.domElement);
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.events = events;
    
    this.state = {
      currentLayer: 0,
      selectedVoxel: null,
      viewMode: ViewMode.NORMAL,
      isPlaying: false,
      playbackSpeed: 1.0
    };
    
    this.setupControls();
    this.attachEventListeners();
  }
  
  private setupControls(): void {
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 50;
    this.controls.maxDistance = 500;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0.5;
  }
  
  private attachEventListeners(): void {
    this.renderer.domElement.addEventListener('click', this.onMouseClick.bind(this));
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    
    // Keyboard controls
    window.addEventListener('keydown', this.onKeyDown.bind(this));
  }
  
  private onMouseClick(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    if (intersects.length > 0) {
      // Find voxel at intersection point
      const point = intersects[0].point;
      // In a real implementation, we'd look up the voxel from the data structure
      const mockVoxel: VoxelData = {
        position: point,
        colorIndex: 0,
        layer: this.state.currentLayer,
        density: 1.0
      };
      
      this.state.selectedVoxel = mockVoxel;
      this.events.onVoxelClick?.(mockVoxel);
    }
  }
  
  private onMouseMove(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }
  
  private onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case ' ':
        this.togglePlayback();
        break;
      case 'ArrowUp':
        this.setLayer(this.state.currentLayer + 1);
        break;
      case 'ArrowDown':
        this.setLayer(this.state.currentLayer - 1);
        break;
      case 'x':
        this.toggleViewMode(ViewMode.XRAY);
        break;
      case 'e':
        this.toggleViewMode(ViewMode.EXPLODED);
        break;
      case 'w':
        this.toggleViewMode(ViewMode.WIREFRAME);
        break;
      case 'n':
        this.toggleViewMode(ViewMode.NORMAL);
        break;
      case 'r':
        this.controls.autoRotate = !this.controls.autoRotate;
        break;
    }
  }
  
  public setLayer(layer: number, totalLayers: number = 100): void {
    this.state.currentLayer = Math.max(0, Math.min(layer, totalLayers - 1));
    this.events.onLayerChange?.(this.state.currentLayer);
  }
  
  public togglePlayback(): void {
    this.state.isPlaying = !this.state.isPlaying;
    this.events.onPlaybackToggle?.(this.state.isPlaying);
    
    if (this.state.isPlaying) {
      this.startAnimation();
    } else {
      this.stopAnimation();
    }
  }
  
  private startAnimation(): void {
    let lastTime = performance.now();
    
    const animate = (currentTime: number) => {
      if (!this.state.isPlaying) return;
      
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;
      
      // Advance layer based on playback speed
      const layerAdvance = deltaTime * this.state.playbackSpeed * 10; // 10 layers per second
      this.setLayer(this.state.currentLayer + layerAdvance);
      
      this.animationId = requestAnimationFrame(animate);
    };
    
    this.animationId = requestAnimationFrame(animate);
  }
  
  private stopAnimation(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
  
  public toggleViewMode(mode: ViewMode): void {
    this.state.viewMode = mode;
    this.events.onModeChange?.(mode);
  }
  
  public getState(): InteractionState {
    return { ...this.state };
  }
  
  public setPlaybackSpeed(speed: number): void {
    this.state.playbackSpeed = Math.max(0.1, Math.min(speed, 10));
  }
  
  public update(): void {
    this.controls.update();
  }
  
  public dispose(): void {
    this.controls.dispose();
    this.stopAnimation();
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
  }
}