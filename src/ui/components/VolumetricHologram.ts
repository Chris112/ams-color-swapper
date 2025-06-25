import * as THREE from 'three';
import { Component } from '../../core/Component';
import { GcodeStats } from '../../types';
import { 
  HologramConfig, 
  ViewMode, 
  HologramEvents,
  VolumetricData 
} from './volumetric/types';
import { VoxelDataStructure } from './volumetric/VoxelDataStructure';
import { HologramEffects } from './volumetric/HologramEffects';
import { InteractionController } from './volumetric/InteractionController';
import { GCodeLoader } from 'three/examples/jsm/loaders/GCodeLoader.js';

// Shader sources
const hologramVertexShader = `
attribute float layer;
attribute float voxelDensity;

varying vec3 vColor;
varying float vOpacity;

void main() {
  vColor = color;
  vOpacity = voxelDensity * 0.8;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = 4.0;
}
`;

const hologramFragmentShader = `
precision mediump float;

varying vec3 vColor;
varying float vOpacity;

void main() {
  vec2 uv = gl_PointCoord;
  float dist = length(uv - 0.5) * 2.0;
  
  if (dist > 1.0) discard;
  
  float alpha = smoothstep(1.0, 0.3, dist) * vOpacity;
  gl_FragColor = vec4(vColor, alpha);
}
`;

export class VolumetricHologram extends Component {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;
  
  private voxelStructure: VoxelDataStructure;
  private volumetricData: VolumetricData;
  private hologramMesh: THREE.Group | null = null;
  private gcodeLoader: GCodeLoader;
  private hologramMaterial: THREE.ShaderMaterial | null = null;
  
  private effects: HologramEffects;
  private interactionController: InteractionController;
  
  private config: HologramConfig = {
    resolution: new THREE.Vector3(128, 128, 128),
    voxelSize: 1.0,
    particleCount: 10000,
    enableEffects: true,
    showScanlines: true,
    showParticles: true
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
    this.clock = new THREE.Clock();
    
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
    this.gcodeLoader = new GCodeLoader();
    
    // Initialize components
    this.interactionController = new InteractionController(
      this.camera,
      this.renderer,
      this.scene,
      this.events
    );
    
    // Create visualization
    this.createGeometryVisualization().catch(error => 
      console.error('Failed to create geometry visualization:', error)
    );
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
      alpha: true
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
      console.log('Using custom G-code to geometry converter...');
      
      // Use our own converter which separates extrusion from travel moves
      const { GcodeToGeometryConverter } = await import('../../parser/gcodeToGeometry');
      const converter = new GcodeToGeometryConverter();
      const geometry = converter.convertGcodeToGeometry(this.stats.rawContent, this.stats);
      
      console.log('G-code geometry generated:', {
        layersCount: geometry.layers.length,
        totalLayers: geometry.totalLayers,
        colorsCount: geometry.colors.size,
        boundingBox: geometry.boundingBox
      });

      this.createCustomVisualization(geometry);

    } catch (error) {
      console.error('Failed to parse G-code with custom converter:', error);
      this.createErrorMessage(`G-code parsing failed: ${error.message}`);
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
      
      console.log('Custom geometry dimensions:', {
        size: size,
        center: center,
        boundingBox: box
      });
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const distance = maxDim * 2.5;
      
      this.camera.position.set(distance, distance * 0.8, distance);
      this.camera.lookAt(center);
      
      // Store for cleanup
      this.hologramMesh = printMesh;
      
      console.log('Custom G-code visualization created successfully');
      
    } catch (error) {
      console.error('Failed to create custom visualization:', error);
      this.createErrorMessage(`Visualization creation failed: ${error.message}`);
    }
  }

  private createThreeJSVisualization(gcodeObject: THREE.Group): void {
    console.log('Creating Three.js visualization...');
    console.log('G-code object children count:', gcodeObject.children.length);
    
    // Add the G-code object to the scene first
    this.scene.add(gcodeObject);
    
    // Apply multi-color materials based on our color analysis
    this.applyMultiColorMaterials(gcodeObject);
    
    // Calculate bounding box and position camera
    const box = new THREE.Box3().setFromObject(gcodeObject);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    console.log('Print dimensions:', {
      size: size,
      center: center,
      boundingBox: box
    });
    
    // Position camera to frame the print nicely
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2.5;
    
    this.camera.position.set(distance, distance * 0.8, distance);
    this.camera.lookAt(center);
    
    // Store for cleanup
    this.hologramMesh = gcodeObject;
    
    console.log('Three.js G-code visualization created successfully');
  }

  private applyMultiColorMaterials(gcodeObject: THREE.Group): void {
    // Get colors from our analysis
    const colors = this.stats.colors || [];
    const toolChanges = this.stats.toolChanges || [];
    
    console.log('Applying colors with data:', {
      colorsCount: colors.length,
      toolChangesCount: toolChanges.length,
      colors: colors.map(c => ({ id: c.id, hex: c.hexColor }))
    });

    // Debug the actual structure
    console.log('G-code object structure:');
    gcodeObject.children.forEach((child, index) => {
      console.log(`Child ${index}:`, {
        type: child.type,
        name: child.name,
        userData: child.userData,
        material: child.material,
        geometry: child.geometry
      });
    });

    // Use bright colors for visualization
    const brightColors = [
      '#ff6b6b', // Bright red
      '#4ecdc4', // Bright teal
      '#45b7d1', // Bright blue
      '#f9ca24', // Bright yellow
      '#f0932b', // Bright orange
      '#eb4d4b', // Dark red
      '#6c5ce7', // Purple
      '#a29bfe'  // Light purple
    ];

    let objectIndex = 0;

    console.log('Starting to traverse G-code object...');

    // First pass: collect all line objects and analyze them
    const lineObjects: Array<{
      object: THREE.LineSegments | THREE.Line;
      positions: Float32Array;
      vertexCount: number;
      isTravel: boolean;
    }> = [];

    gcodeObject.traverse((child) => {
      console.log('Traversing child:', {
        type: child.type,
        constructor: child.constructor.name,
        material: child.material,
        userData: child.userData,
        name: child.name
      });

      if (child instanceof THREE.LineSegments || child instanceof THREE.Line) {
        const material = child.material as THREE.LineBasicMaterial;
        if (material) {
          const geometry = child.geometry;
          const positions = geometry.attributes.position.array as Float32Array;
          const vertexCount = positions.length / 3;
          
          console.log(`Found object ${lineObjects.length} with ${vertexCount} vertices, name: "${child.name}"`);
          
          // Check if this is likely a travel move object
          const isLikelyTravelMoves = this.isLikelyTravelObject(child, positions);
          
          lineObjects.push({
            object: child,
            positions,
            vertexCount,
            isTravel: isLikelyTravelMoves
          });
        }
      }
    });

    // Second pass: process objects safely
    lineObjects.forEach((item, index) => {
      if (item.isTravel) {
        console.log(`Removing travel move object ${index}`);
        if (item.object.parent) {
          item.object.parent.remove(item.object);
        }
      } else {
        console.log(`Processing extrusion object ${index}`);
        
        // This is likely extrusion - apply multiple colors
        if (item.vertexCount > 1000) {
          // Create multiple child objects with different colors
          this.splitGeometryIntoColoredSegments(item.object, index, brightColors);
        } else {
          // Small geometry, just apply one color
          const material = item.object.material as THREE.LineBasicMaterial;
          material.opacity = 0.9;
          material.transparent = true;
          material.linewidth = 3;
          
          const colorIndex = objectIndex % brightColors.length;
          const color = brightColors[colorIndex];
          
          console.log(`Setting object ${index} to color ${color}`);
          
          try {
            material.color.setHex(parseInt(color.replace('#', ''), 16));
          } catch (e) {
            console.error('Failed to parse color:', color, e);
            material.color.setHex(0xff6b6b);
          }
        }
        objectIndex++;
      }
    });

    console.log(`Applied colors to ${objectIndex} objects`);
  }

  private isLikelyTravelObject(lineObject: THREE.LineSegments | THREE.Line, positions: Float32Array): boolean {
    // Check the object name - GCodeLoader often names travel moves differently
    if (lineObject.name) {
      const name = lineObject.name.toLowerCase();
      if (name.includes('move') || name.includes('travel') || name.includes('rapid')) {
        console.log(`Object named "${lineObject.name}" identified as travel moves`);
        return true;
      }
    }

    // Check userData
    if (lineObject.userData && lineObject.userData.type) {
      if (lineObject.userData.type === 'move' || lineObject.userData.type === 'travel') {
        console.log(`Object with userData.type "${lineObject.userData.type}" identified as travel moves`);
        return true;
      }
    }

    // Analyze the geometry - travel moves typically have:
    // 1. Longer average segment lengths
    // 2. More variation in Z coordinates
    // 3. Segments that span large distances
    let totalDistance = 0;
    let maxDistance = 0;
    let zVariation = 0;
    let segmentCount = 0;
    let minZ = Infinity, maxZ = -Infinity;

    for (let i = 0; i < positions.length - 3; i += 6) {
      const dx = positions[i + 3] - positions[i];
      const dy = positions[i + 4] - positions[i + 1];
      const dz = positions[i + 5] - positions[i + 2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      totalDistance += distance;
      maxDistance = Math.max(maxDistance, distance);
      segmentCount++;
      
      minZ = Math.min(minZ, positions[i + 2], positions[i + 5]);
      maxZ = Math.max(maxZ, positions[i + 2], positions[i + 5]);
    }

    const avgDistance = totalDistance / segmentCount;
    zVariation = maxZ - minZ;

    console.log(`Object analysis: avgDist=${avgDistance.toFixed(2)}, maxDist=${maxDistance.toFixed(2)}, zVar=${zVariation.toFixed(2)}`);

    // Be much more conservative - only hide if it's clearly mostly travel moves
    // Objects with mixed content (extrusion + travel) should be kept and filtered later
    const isHighAvgDistance = avgDistance > 15; // Much higher threshold
    const isMostlyLongSegments = (segmentCount > 100) && (maxDistance > 100) && (avgDistance > 10);
    
    // Only hide if it's clearly a travel-only object
    return isHighAvgDistance || isMostlyLongSegments;
  }

  private splitGeometryIntoColoredSegments(
    lineObject: THREE.LineSegments | THREE.Line, 
    objectIndex: number, 
    colors: string[]
  ): void {
    const geometry = lineObject.geometry;
    const positions = geometry.attributes.position.array as Float32Array;
    const parent = lineObject.parent;
    
    if (!parent) return;
    
    console.log(`Splitting geometry with ${positions.length / 3} vertices into colored segments`);
    
    // Remove the original object
    parent.remove(lineObject);
    
    // Filter out travel segments first
    const filteredPositions = this.filterTravelSegments(positions);
    
    if (filteredPositions.length === 0) {
      console.log('All segments were travel moves, skipping object');
      return;
    }
    
    console.log(`After filtering: ${filteredPositions.length / 3} vertices remaining`);
    
    // Calculate how many segments to create (4 for the 4 colors)
    const segmentCount = 4;
    const verticesPerSegment = Math.floor(filteredPositions.length / (segmentCount * 3));
    
    for (let i = 0; i < segmentCount; i++) {
      const startIndex = i * verticesPerSegment * 3;
      const endIndex = Math.min((i + 1) * verticesPerSegment * 3, filteredPositions.length);
      
      if (startIndex >= filteredPositions.length) break;
      
      // Create new geometry for this segment
      const segmentPositions = filteredPositions.slice(startIndex, endIndex);
      
      if (segmentPositions.length < 6) continue; // Skip very small segments
      
      const segmentGeometry = new THREE.BufferGeometry();
      segmentGeometry.setAttribute('position', new THREE.Float32BufferAttribute(segmentPositions, 3));
      
      // Create material with the appropriate color
      const colorIndex = i % colors.length;
      const color = colors[colorIndex];
      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(parseInt(color.replace('#', ''), 16)),
        opacity: 0.9,
        transparent: true,
        linewidth: 3
      });
      
      // Create new line segments object
      const segmentObject = new THREE.LineSegments(segmentGeometry, material);
      segmentObject.userData = { ...lineObject.userData, segmentIndex: i, isExtruding: true };
      
      parent.add(segmentObject);
      
      console.log(`Created segment ${i} with color ${color} (${segmentPositions.length / 3} vertices)`);
    }
  }

  private shouldHideObject(lineObject: THREE.LineSegments | THREE.Line, positions: Float32Array): boolean {
    // Check userData for hints from GCodeLoader
    if (lineObject.userData) {
      // Some loaders mark travel moves differently
      if (lineObject.userData.type === 'move' || lineObject.userData.type === 'travel') {
        return true;
      }
      // Check the object name
      if (lineObject.name && lineObject.name.toLowerCase().includes('move')) {
        return true;
      }
    }
    
    // Much more aggressive analysis to detect travel moves
    let longSegmentCount = 0;
    let veryLongSegmentCount = 0;
    let zJumpCount = 0;
    let totalSegments = 0;
    let avgSegmentLength = 0;
    
    for (let i = 0; i < positions.length - 3; i += 6) { // Every pair of vertices
      const dx = positions[i + 3] - positions[i];
      const dy = positions[i + 4] - positions[i + 1]; 
      const dz = positions[i + 5] - positions[i + 2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      totalSegments++;
      avgSegmentLength += distance;
      
      if (distance > 5) longSegmentCount++; // Lower threshold
      if (distance > 15) veryLongSegmentCount++;
      if (Math.abs(dz) > 0.5) zJumpCount++; // Z jumps indicate layer changes/travel
    }
    
    avgSegmentLength /= totalSegments;
    
    const longSegmentRatio = longSegmentCount / totalSegments;
    const veryLongSegmentRatio = veryLongSegmentCount / totalSegments;
    const zJumpRatio = zJumpCount / totalSegments;
    
    console.log(`Object analysis: avg=${avgSegmentLength.toFixed(2)}, long=${(longSegmentRatio * 100).toFixed(1)}%, veryLong=${(veryLongSegmentRatio * 100).toFixed(1)}%, zJumps=${(zJumpRatio * 100).toFixed(1)}%`);
    
    // Hide if:
    // 1. More than 30% of segments are long (lowered from 60%)
    // 2. More than 10% are very long segments
    // 3. More than 20% have Z jumps
    // 4. Average segment length is high
    return longSegmentRatio > 0.3 || veryLongSegmentRatio > 0.1 || zJumpRatio > 0.2 || avgSegmentLength > 8;
  }

  private filterTravelSegments(positions: Float32Array): Float32Array {
    const filtered: number[] = [];
    let filteredCount = 0;
    let totalCount = 0;
    
    for (let i = 0; i < positions.length - 3; i += 6) { // Every pair of vertices (line segment)
      const x1 = positions[i], y1 = positions[i + 1], z1 = positions[i + 2];
      const x2 = positions[i + 3], y2 = positions[i + 4], z2 = positions[i + 5];
      
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dz = z2 - z1;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      totalCount++;
      
      // More balanced filtering - keep segments that are likely printing
      // Filter out obvious travel moves but keep printing moves
      const isReasonableLength = distance < 15; // Allow longer segments for print moves
      const isSmallZChange = Math.abs(dz) < 2.0; // Allow some Z movement
      const isNotMassiveJump = distance < 50; // Filter out only very long travel moves
      
      // Filter out edge movements (travel to build plate edges)
      const isNotEdgeMovement = Math.abs(x1) < 100 && Math.abs(y1) < 100 && Math.abs(x2) < 100 && Math.abs(y2) < 100;
      
      // Keep most segments except obvious travel moves
      if (isReasonableLength && isSmallZChange && isNotMassiveJump && isNotEdgeMovement) {
        // Keep this segment - it's likely actual printing
        filtered.push(x1, y1, z1, x2, y2, z2);
        filteredCount++;
      }
    }
    
    console.log(`Filtered segments: kept ${filteredCount}/${totalCount} (${(filteredCount/totalCount*100).toFixed(1)}%)`);
    
    return new Float32Array(filtered);
  }

  private detectTravelMove(positions: Float32Array): boolean {
    if (positions.length < 6) return false; // Short segments are likely print moves
    
    // Calculate segment properties
    let maxSegmentLength = 0;
    let hasLargeZJump = false;
    
    for (let i = 0; i < positions.length - 3; i += 3) {
      const dx = positions[i + 3] - positions[i];
      const dy = positions[i + 4] - positions[i + 1]; 
      const dz = positions[i + 5] - positions[i + 2];
      
      const segmentLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
      maxSegmentLength = Math.max(maxSegmentLength, segmentLength);
      
      // Large Z jumps (layer changes) are often travel moves
      if (Math.abs(dz) > 1.0) {
        hasLargeZJump = true;
      }
    }
    
    // More conservative detection: only flag as travel if very long segments or clear Z jumps
    return maxSegmentLength > 20 || hasLargeZJump;
  }

  private estimateLayerFromPosition(positions: Float32Array): number {
    if (positions.length < 3) return 0;
    
    // Use Z position to estimate layer (assuming 0.2mm layer height)
    const z = positions[2]; // First Z position
    return Math.floor(z / 0.2);
  }

  private getDefaultColor(index: number): string {
    const defaultColors = [
      '#FF6B6B', // Red
      '#4ECDC4', // Teal  
      '#45B7D1', // Blue
      '#F9CA24', // Yellow
      '#F0932B', // Orange
      '#EB4D4B', // Dark Red
      '#6C5CE7', // Purple
      '#A29BFE'  // Light Purple
    ];
    return defaultColors[index % defaultColors.length];
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

  
  private setupEffects(): void {
    if (this.config.enableEffects) {
      this.effects.createGrid(this.volumetricData.dimensions);
      
      if (this.config.showScanlines) {
        this.effects.createScanlines(this.volumetricData.dimensions);
      }
      
      if (this.config.showParticles) {
        this.effects.createAmbientParticles(
          this.volumetricData.dimensions,
          this.config.particleCount
        );
      }
    }
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
    
    const time = this.clock.getElapsedTime();
    
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
      // If it's a group (real geometry), dispose all children
      if (this.hologramMesh instanceof THREE.Group) {
        this.hologramMesh.traverse((child) => {
          if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
      } else if (this.hologramMesh.geometry) {
        this.hologramMesh.geometry.dispose();
      }
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