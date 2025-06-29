import * as THREE from 'three';
import { Component } from '../../core/Component';
import { GcodeStats } from '../../types/gcode';
import { HologramConfig, ViewMode, HologramEvents, VolumetricData } from './volumetric/types';
import { VoxelDataStructure } from './volumetric/VoxelDataStructure';
import { InteractionController } from './volumetric/InteractionController';
// import { GCodeLoader } from 'three/examples/jsm/loaders/GCodeLoader.js'; // Not used

// Shader sources removed - not currently used

export class VolumetricHologram extends Component {
  private scene: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  // private clock: THREE.Clock; // For future animation use

  private voxelStructure: VoxelDataStructure;
  private volumetricData: VolumetricData;
  private hologramMesh: THREE.Group | null = null;
  private hologramMaterial: THREE.ShaderMaterial | null = null;

  private interactionController!: InteractionController;

  private config: HologramConfig = {
    resolution: new THREE.Vector3(128, 128, 128),
    voxelSize: 1.0,
    particleCount: 10000,
    enableEffects: true,
    showScanlines: true,
    showParticles: true,
  };

  private animationFrameId: number | null = null;
  private container: HTMLElement;

  constructor(
    selector: string,
    private stats: GcodeStats,
    config?: Partial<HologramConfig>,
    private events?: Partial<HologramEvents>
  ) {
    super(selector);

    // Merge config
    this.config = { ...this.config, ...config };

    // Create container for Three.js
    this.container = document.createElement('div');
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.position = 'relative';
    this.element.appendChild(this.container);

    // Initialize Three.js
    this.scene = new THREE.Scene();
    // this.clock = new THREE.Clock(); // Initialize when needed for animation

    // Initialize placeholder data (not used for real geometry)
    this.voxelStructure = new VoxelDataStructure(
      this.stats,
      this.config.resolution,
      this.config.voxelSize
    );
    this.volumetricData = this.voxelStructure.getVolumetricData();

    this.setupRenderer();
    this.setupCamera();
    this.setupLights();

    // Initialize G-code loader
    // this.gcodeLoader = new GCodeLoader(); // Not used - using custom converter

    // Initialize components
    this.interactionController = new InteractionController(
      this.camera,
      this.renderer,
      this.scene,
      this.events
    );

    // Create visualization
    this.createGeometryVisualization().catch((error) => {
      // Error handled internally
    });
    // Disable effects temporarily to avoid shader issues
    // this.setupEffects();

    // Add UI overlay
    this.createUIOverlay();

    // Start rendering
    this.animate();

    // Handle resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private setupRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(0x000000, 0.9);
    this.container.appendChild(this.renderer.domElement);

    // Enable required extensions
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  private setupCamera(): void {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(150, 100, 150);
    this.camera.lookAt(0, this.volumetricData.dimensions.y / 2, 0);
  }

  private setupLights(): void {
    // Ambient light for base visibility
    const ambientLight = new THREE.AmbientLight(0x0a0a0a);
    this.scene.add(ambientLight);

    // Point lights for holographic glow
    const colors = [0x00ffff, 0xff00ff, 0x00ff00];
    colors.forEach((color, i) => {
      const light = new THREE.PointLight(color, 0.5, 200);
      const angle = (i / colors.length) * Math.PI * 2;
      light.position.set(
        Math.cos(angle) * 100,
        this.volumetricData.dimensions.y / 2,
        Math.sin(angle) * 100
      );
      this.scene.add(light);
    });
  }

  private async createGeometryVisualization(): Promise<void> {
    if (!this.stats.rawContent) {
      this.createErrorMessage('Raw G-code content not available');
      return;
    }

    try {
      // Use our own converter which separates extrusion from travel moves
      const { GcodeToGeometryConverter } = await import('../../parser/gcodeToGeometry');
      const converter = new GcodeToGeometryConverter();
      const geometry = converter.convertGcodeToGeometry(this.stats.rawContent, this.stats);

      this.createCustomVisualization(geometry);
    } catch (error) {
      // Failed to parse G-code with custom converter
      this.createErrorMessage(
        `G-code parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async createCustomVisualization(geometry: any): Promise<void> {
    try {
      // Import the static method
      const { GcodeToGeometryConverter } = await import('../../parser/gcodeToGeometry');

      // Create a mesh from the geometry
      const printMesh = GcodeToGeometryConverter.createPreviewMesh(geometry);

      // Apply center offset
      printMesh.position.copy(geometry.centerOffset);

      // Add to scene
      this.scene.add(printMesh);

      // Position camera
      const box = geometry.boundingBox;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Custom geometry dimensions calculated

      const maxDim = Math.max(size.x, size.y, size.z);
      const distance = maxDim * 2.5;

      this.camera.position.set(distance, distance * 0.8, distance);
      this.camera.lookAt(center);

      // Store for cleanup
      this.hologramMesh = printMesh;

      // Custom G-code visualization created successfully
    } catch (error) {
      // Failed to create custom visualization
      this.createErrorMessage(
        `Visualization creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private createErrorMessage(message: string): void {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'absolute inset-0 flex items-center justify-center text-white z-10';
    errorDiv.innerHTML = `
      <div class="text-center p-8 glass rounded-xl max-w-md">
        <svg class="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 class="text-lg font-bold mb-2 text-red-400">Visualization Error</h3>
        <p class="text-sm text-white/70">${message}</p>
      </div>
    `;
    this.container.appendChild(errorDiv);
  }

  private createUIOverlay(): void {
    const overlay = document.createElement('div');
    overlay.className = 'hologram-ui-overlay';
    overlay.innerHTML = `
      <div class="hologram-controls glass rounded-lg p-4 absolute bottom-4 left-4">
        <div class="mb-2">
          <label class="text-white text-sm">Layer: <span id="currentLayer">0</span>/${this.volumetricData.totalLayers}</label>
          <input type="range" id="layerSlider" min="0" max="${this.volumetricData.totalLayers - 1}" value="0" class="w-full">
        </div>
        <div class="flex gap-2 mb-2">
          <button id="playBtn" class="btn-glass text-sm px-3 py-1">Play</button>
          <button id="xrayBtn" class="btn-glass text-sm px-3 py-1">X-Ray</button>
          <button id="explodeBtn" class="btn-glass text-sm px-3 py-1">Explode</button>
        </div>
        <div class="text-white text-xs opacity-70">
          <div>Click: Select voxel</div>
          <div>Drag: Rotate view</div>
          <div>Scroll: Zoom</div>
          <div>Space: Play/Pause</div>
        </div>
      </div>
    `;

    this.container.appendChild(overlay);

    // Attach UI event listeners
    const layerSlider = overlay.querySelector('#layerSlider') as HTMLInputElement;
    const currentLayerSpan = overlay.querySelector('#currentLayer') as HTMLSpanElement;
    const playBtn = overlay.querySelector('#playBtn') as HTMLButtonElement;
    const xrayBtn = overlay.querySelector('#xrayBtn') as HTMLButtonElement;
    const explodeBtn = overlay.querySelector('#explodeBtn') as HTMLButtonElement;

    layerSlider.addEventListener('input', (e) => {
      const layer = parseInt((e.target as HTMLInputElement).value);
      this.interactionController.setLayer(layer, this.volumetricData.totalLayers);
      currentLayerSpan.textContent = layer.toString();
    });

    playBtn.addEventListener('click', () => {
      this.interactionController.togglePlayback();
      playBtn.textContent = this.interactionController.getState().isPlaying ? 'Pause' : 'Play';
    });

    xrayBtn.addEventListener('click', () => {
      this.interactionController.toggleViewMode(ViewMode.XRAY);
      const isXray = this.interactionController.getState().viewMode === ViewMode.XRAY;
      xrayBtn.classList.toggle('active', isXray);
    });

    explodeBtn.addEventListener('click', () => {
      this.interactionController.toggleViewMode(ViewMode.EXPLODED);
      const isExploded = this.interactionController.getState().viewMode === ViewMode.EXPLODED;
      explodeBtn.classList.toggle('active', isExploded);
    });

    // Update layer display on layer change
    if (this.events?.onLayerChange) {
      const originalHandler = this.events.onLayerChange;
      this.events.onLayerChange = (layer: number) => {
        currentLayerSpan.textContent = layer.toString();
        layerSlider.value = layer.toString();
        originalHandler(layer);
      };
    }
  }

  private animate(): void {
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

    // const time = this.clock.getElapsedTime(); // For future animation use

    // Basic material updates can be added here later

    // Update effects (disabled temporarily)
    // this.effects.update(time);

    // Update controls
    this.interactionController.update();

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  protected render(): void {
    // Component render - not used for Three.js
  }

  protected cleanup(): void {
    // Stop animation
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Dispose Three.js resources
    if (this.hologramMesh) {
      this.scene.remove(this.hologramMesh);
      // Dispose all children (hologramMesh is always a Group)
      this.hologramMesh.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    }

    if (this.hologramMaterial) {
      this.hologramMaterial.dispose();
    }

    // this.effects.dispose();
    this.interactionController.dispose();

    this.renderer.dispose();

    // Remove event listeners
    window.removeEventListener('resize', this.onWindowResize.bind(this));

    // Clear container
    this.container.innerHTML = '';
  }
}

// Style for UI overlay
const style = document.createElement('style');
style.textContent = `
.hologram-ui-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.hologram-controls {
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 255, 255, 0.3);
}

.hologram-controls button.active {
  background: rgba(0, 255, 255, 0.2);
  border-color: rgba(0, 255, 255, 0.5);
}

.hologram-controls input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: rgba(0, 255, 255, 0.2);
  outline: none;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.hologram-controls input[type="range"]:hover {
  opacity: 1;
}

.hologram-controls input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: #00ffff;
  cursor: pointer;
  border-radius: 50%;
}

.hologram-controls input[type="range"]::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: #00ffff;
  cursor: pointer;
  border-radius: 50%;
}
`;
document.head.appendChild(style);
