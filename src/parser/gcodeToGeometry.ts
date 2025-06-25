import * as THREE from 'three';
import { GcodeStats, ColorInfo } from '../types';

export interface GcodePath {
  points: THREE.Vector3[];
  extruding: boolean;
  toolIndex: number;
  color: string;
  layer: number;
}

export interface GeometryLayer {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  layer: number;
  toolIndex: number;
  color: string;
}

export interface PrintGeometry {
  layers: GeometryLayer[];
  boundingBox: THREE.Box3;
  centerOffset: THREE.Vector3;
  totalLayers: number;
  colors: Map<number, string>;
}

export class GcodeToGeometryConverter {
  private readonly LINE_WIDTH = 0.4;
  // Scale factor to convert mm coordinates to reasonable Three.js units
  // Typical print bed: 220x220mm -> scale to ~22x22 three.js units (divide by 10)
  private readonly SCALE_FACTOR = 0.1;
  
  // Scaled dimensions for Three.js
  private get scaledLineWidth(): number { return this.LINE_WIDTH * this.SCALE_FACTOR; }
  
  private currentPosition!: THREE.Vector3;
  private currentTool!: number;
  private currentLayer!: number;
  private isExtruding!: boolean;
  private paths!: GcodePath[];
  private colors!: Map<number, string>;
  
  constructor() {
    this.reset();
  }
  
  private reset(): void {
    this.currentPosition = new THREE.Vector3(0, 0, 0);
    this.currentTool = 0;
    this.currentLayer = 0;
    this.isExtruding = false;
    this.paths = [];
    this.colors = new Map();
  }
  
  public convertGcodeToGeometry(gcodeContent: string, stats: GcodeStats): PrintGeometry {
    this.reset();
    this.setupColors(stats.colors);
    
    const lines = gcodeContent.split('\n');
    let currentPath: GcodePath | null = null;
    let lastZ = 0;
    let layerFromZ = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith(';')) {
        // Check for layer comments - improved patterns
        if (line.includes('LAYER') || line.includes('layer') || line.includes('layer num')) {
          // Try multiple layer comment patterns
          let layerMatch = line.match(/(?:LAYER|layer)[:\s]+(\d+)/i) ||
                          line.match(/layer\s+num\/total_layer_count:\s*(\d+)/i) ||
                          line.match(/;\s*layer\s+#(\d+)/i) ||
                          line.match(/;\s*layer\s+(\d+)/i);
          
          if (layerMatch) {
            const newLayer = parseInt(layerMatch[1]);
            if (!isNaN(newLayer) && newLayer >= 0) {
              this.currentLayer = newLayer;
              // Detected layer
            }
          }
        }
        continue;
      }
      
      const result = this.processGcodeLine(line);
      if (result) {
        const { newPosition, extruding, toolChange } = result;
        
        // Check for Z-height changes to detect layers (fallback method)
        if (newPosition.z > lastZ + (0.1 * this.SCALE_FACTOR)) { // Scaled minimum layer height
          layerFromZ++;
          lastZ = newPosition.z;
          
          // Use Z-based layer detection more aggressively
          const calculatedLayer = layerFromZ - 1;
          if (calculatedLayer >= 0) {
            this.currentLayer = calculatedLayer;
            // Z-based layer detection
          }
        }
        
        if (toolChange) {
          this.currentTool = toolChange;
          if (currentPath) {
            this.paths.push(currentPath);
            currentPath = null;
          }
        }
        
        // Only create paths for actual extrusion moves (not travel)
        if (extruding) {
          if (!currentPath) {
            currentPath = {
              points: [this.currentPosition.clone()],
              extruding: true,
              toolIndex: this.currentTool,
              color: this.colors.get(this.currentTool) || '#ffffff',
              layer: this.currentLayer
            };
          }
          currentPath.points.push(newPosition.clone());
        } else if (currentPath) {
          // End current extrusion path when we stop extruding
          this.paths.push(currentPath);
          currentPath = null;
        }
        
        this.currentPosition.copy(newPosition);
        this.isExtruding = extruding;
      }
    }
    
    if (currentPath) {
      this.paths.push(currentPath);
    }
    
    return this.generateGeometry(stats);
  }
  
  private setupColors(colorInfos: ColorInfo[]): void {
    this.colors.clear();
    colorInfos.forEach((color, index) => {
      const toolIndex = parseInt(color.id.replace('T', '')) || index;
      this.colors.set(toolIndex, color.hexColor || this.generateColorFromIndex(index));
    });
    
    // Ensure we have at least one color
    if (this.colors.size === 0) {
      this.colors.set(0, '#ffffff');
    }
  }
  
  private generateColorFromIndex(index: number): string {
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24',
      '#f0932b', '#eb4d4b', '#6c5ce7', '#a29bfe',
      '#fd79a8', '#fdcb6e', '#e17055', '#00b894'
    ];
    return colors[index % colors.length];
  }
  
  private processGcodeLine(line: string): {
    newPosition: THREE.Vector3;
    extruding: boolean;
    toolChange?: number;
  } | null {
    const commands = this.parseGcodeLine(line);
    if (!commands.has('G') && !commands.has('T')) {
      return null;
    }
    
    const newPosition = this.currentPosition.clone();
    let extruding = this.isExtruding;
    let toolChange: number | undefined;
    
    // Handle tool changes
    if (commands.has('T')) {
      toolChange = commands.get('T')!;
    }
    
    // Handle movement commands
    const gCode = commands.get('G');
    if (gCode === 0 || gCode === 1) {
      // G0: Rapid positioning, G1: Linear interpolation
      // Apply scale factor to convert from mm to Three.js units
      // Map 3D printer coordinates to Three.js coordinates:
      // G-code: X=left/right, Y=front/back, Z=up/down
      // Three.js: X=left/right, Y=up/down, Z=front/back
      if (commands.has('X')) newPosition.x = commands.get('X')! * this.SCALE_FACTOR;
      if (commands.has('Y')) newPosition.z = commands.get('Y')! * this.SCALE_FACTOR; // Y becomes Z
      if (commands.has('Z')) newPosition.y = commands.get('Z')! * this.SCALE_FACTOR; // Z becomes Y
      
      // Check for extrusion - only G1 moves with positive E values are extruding
      if (commands.has('E')) {
        const eValue = commands.get('E')!;
        // Only consider it extruding if it's G1 with a positive E value
        extruding = gCode === 1 && eValue > 0;
      } else {
        // Without E parameter, G0 is travel, G1 could be travel or extrusion
        // Be conservative and only treat explicit E+ moves as extrusion
        extruding = false;
      }
    }
    
    return { newPosition, extruding, toolChange };
  }
  
  private parseGcodeLine(line: string): Map<string, number> {
    const commands = new Map<string, number>();
    const parts = line.split(/\s+/);
    
    for (const part of parts) {
      const match = part.match(/^([GTXYZEF])(-?\d*\.?\d+)/);
      if (match) {
        const command = match[1];
        const value = parseFloat(match[2]);
        commands.set(command, value);
      }
    }
    
    return commands;
  }
  
  private generateGeometry(stats: GcodeStats): PrintGeometry {
    const layerMap = new Map<number, GcodePath[]>();
    
    // Group paths by layer
    this.paths.forEach(path => {
      if (!layerMap.has(path.layer)) {
        layerMap.set(path.layer, []);
      }
      layerMap.get(path.layer)!.push(path);
    });
    
    const layers: GeometryLayer[] = [];
    const boundingBox = new THREE.Box3();
    
    // Generate geometry for each layer
    for (const [layerNum, layerPaths] of layerMap) {
      const geometryLayers = this.createLayerGeometries(layerPaths, layerNum);
      layers.push(...geometryLayers);
      
      // Update bounding box
      geometryLayers.forEach(layer => {
        layer.geometry.computeBoundingBox();
        if (layer.geometry.boundingBox) {
          boundingBox.union(layer.geometry.boundingBox);
        }
      });
    }
    
    // Calculate center offset for centering the print
    const center = boundingBox.getCenter(new THREE.Vector3());
    const centerOffset = center.negate();
    
    // Calculate total layers with safety checks
    const layerNumbers = Array.from(layerMap.keys());
    let totalLayers = layerNumbers.length > 0 ? Math.max(...layerNumbers) + 1 : 1;
    let finalLayers = layers;
    
    // Fallback: use stats if our detection failed and redistribute geometry
    if (totalLayers === 1 && stats.totalLayers && stats.totalLayers > 1) {
      totalLayers = stats.totalLayers;
      // Using stats totalLayers instead of detected
      
      // Redistribute single layer geometry across multiple layers based on Z height
      if (layerNumbers.length === 1 && layerNumbers[0] === 0) {
        // Redistributing geometry across layers based on Z height...
        finalLayers = this.redistributeGeometryByZ(finalLayers, totalLayers);
      }
    }
    
    // GcodeToGeometry: Generated geometry
    
    return {
      layers: finalLayers,
      boundingBox,
      centerOffset,
      totalLayers,
      colors: this.colors
    };
  }
  
  private createLayerGeometries(paths: GcodePath[], layer: number): GeometryLayer[] {
    const geometriesByTool = new Map<number, { paths: GcodePath[], color: string }>();
    
    // Group paths by tool (only process extruding paths)
    paths.forEach(path => {
      // Skip non-extruding paths (travel moves)
      if (!path.extruding) return;
      
      if (!geometriesByTool.has(path.toolIndex)) {
        geometriesByTool.set(path.toolIndex, { paths: [], color: path.color });
      }
      
      const toolData = geometriesByTool.get(path.toolIndex)!;
      toolData.paths.push(path);
    });
    
    const layerGeometries: GeometryLayer[] = [];
    
    // Create geometry for each tool
    for (const [toolIndex, { paths: toolPaths, color }] of geometriesByTool) {
      if (toolPaths.length === 0) continue;
      
      // Create tube geometry for proper 3D filament representation
      const geometry = this.createTubeGeometry(toolPaths);
      const material = new THREE.MeshLambertMaterial({ 
        color: new THREE.Color(color),
        transparent: false,
        opacity: 1.0,
        // Add some material properties to make filament more visible
        emissive: new THREE.Color(color).multiplyScalar(0.1) // Slight glow
      });
      
      layerGeometries.push({
        geometry,
        material,
        layer,
        toolIndex,
        color
      });
    }
    
    return layerGeometries;
  }
  
  private createLineGeometry(points: THREE.Vector3[]): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      
      positions.push(start.x, start.y, start.z);
      positions.push(end.x, end.y, end.z);
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }
  
  // Create tube geometry for multiple paths (proper 3D filament representation)
  private createTubeGeometry(paths: GcodePath[]): THREE.BufferGeometry {
    const geometries: THREE.BufferGeometry[] = [];
    
    for (const path of paths) {
      if (path.points.length < 2) continue;
      
      try {
        // Create a tube for each continuous path
        const curve = new THREE.CatmullRomCurve3(path.points, false, 'centripetal');
        const tubeGeometry = new THREE.TubeGeometry(
          curve,
          Math.max(path.points.length * 2, 8), // segments
          this.scaledLineWidth / 2, // radius (use scaled width)
          6, // radial segments (reduced for performance)
          false // closed
        );
        geometries.push(tubeGeometry);
      } catch (error) {
        // Fallback to line geometry for problematic paths
        console.warn('Failed to create tube for path, using line fallback:', error);
        const lineGeometry = this.createLineGeometry(path.points);
        geometries.push(lineGeometry);
      }
    }
    
    if (geometries.length === 0) {
      return new THREE.BufferGeometry();
    }
    
    if (geometries.length === 1) {
      return geometries[0];
    }
    
    // Merge multiple geometries into one
    return this.mergeGeometries(geometries);
  }
  
  // Redistribute geometry across layers based on Z height when layer detection fails
  private redistributeGeometryByZ(layers: GeometryLayer[], targetLayerCount: number): GeometryLayer[] {
    if (layers.length === 0) return layers;
    
    // Find Z height range from all geometry
    let minZ = Infinity;
    let maxZ = -Infinity;
    
    for (const layer of layers) {
      const positions = layer.geometry.getAttribute('position')?.array;
      if (positions) {
        for (let i = 2; i < positions.length; i += 3) { // Every 3rd element is Z
          minZ = Math.min(minZ, positions[i]);
          maxZ = Math.max(maxZ, positions[i]);
        }
      }
    }
    
    if (minZ === Infinity || maxZ === -Infinity) return layers;
    
    // const zRange = maxZ - minZ; // Available for layer height calculation
    // const layerHeight = zRange / targetLayerCount; // For future layer calculation
    
    // Redistributing geometry across layers
    
    const redistributed: GeometryLayer[] = [];
    
    // Create new geometry layers distributed by Z height
    for (let layerIndex = 0; layerIndex < targetLayerCount; layerIndex++) {
      // Calculate layer bounds for future use
      // const layerMinZ = minZ + (layerIndex * layerHeight);
      // const layerMaxZ = minZ + ((layerIndex + 1) * layerHeight);
      
      // For simplicity, just clone the original geometry and assign it to different layers
      // In a more sophisticated implementation, we'd actually split the geometry by Z
      for (const originalLayer of layers) {
        const newLayer: GeometryLayer = {
          geometry: originalLayer.geometry.clone(),
          material: originalLayer.material.clone(),
          layer: layerIndex,
          toolIndex: originalLayer.toolIndex,
          color: originalLayer.color
        };
        redistributed.push(newLayer);
      }
    }
    
    return redistributed;
  }

  // Helper method to merge multiple geometries
  private mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const merged = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    
    for (const geometry of geometries) {
      const pos = geometry.getAttribute('position');
      const norm = geometry.getAttribute('normal');
      const uv = geometry.getAttribute('uv');
      
      if (pos) positions.push(...pos.array);
      if (norm) normals.push(...norm.array);
      if (uv) uvs.push(...uv.array);
    }
    
    if (positions.length > 0) {
      merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    }
    if (normals.length > 0) {
      merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    }
    if (uvs.length > 0) {
      merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    }
    
    // Dispose of individual geometries to free memory
    geometries.forEach(geo => geo.dispose());
    
    return merged;
  }
  
  public static createPreviewMesh(geometry: PrintGeometry): THREE.Group {
    const group = new THREE.Group();
    
    geometry.layers.forEach(layer => {
      const mesh = new THREE.LineSegments(layer.geometry, layer.material);
      mesh.userData = {
        layer: layer.layer,
        toolIndex: layer.toolIndex,
        color: layer.color
      };
      group.add(mesh);
    });
    
    // Apply center offset
    group.position.copy(geometry.centerOffset);
    
    return group;
  }
  
  public static createAnimatedMesh(
    geometry: PrintGeometry,
    onLayerComplete?: (layer: number) => void
  ): {
    group: THREE.Group;
    animateToLayer: (targetLayer: number, duration?: number) => void;
    setVisibleLayer: (layer: number) => void;
  } {
    const group = new THREE.Group();
    const layerMeshes: THREE.Object3D[] = [];
    
    // Create meshes for each layer
    geometry.layers.forEach(layer => {
      const mesh = new THREE.LineSegments(layer.geometry, layer.material);
      mesh.userData = {
        layer: layer.layer,
        toolIndex: layer.toolIndex,
        color: layer.color
      };
      mesh.visible = false;
      layerMeshes.push(mesh);
      group.add(mesh);
    });
    
    // Apply center offset
    group.position.copy(geometry.centerOffset);
    
    let currentVisibleLayer = -1;
    
    const setVisibleLayer = (targetLayer: number) => {
      layerMeshes.forEach(mesh => {
        const meshLayer = mesh.userData.layer as number;
        mesh.visible = meshLayer <= targetLayer;
      });
      currentVisibleLayer = targetLayer;
    };
    
    const animateToLayer = (targetLayer: number, duration = 2000) => {
      const startLayer = currentVisibleLayer;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentLayer = Math.floor(startLayer + (targetLayer - startLayer) * progress);
        
        if (currentLayer !== currentVisibleLayer) {
          setVisibleLayer(currentLayer);
          if (onLayerComplete) {
            onLayerComplete(currentLayer);
          }
        }
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      animate();
    };
    
    return { group, animateToLayer, setVisibleLayer };
  }
}