import { Vector3, Color } from 'three';
import { GcodeStats, ColorInfo } from '../../../types';
import { VoxelData, VolumetricData } from './types';

export class VoxelDataStructure {
  private voxels: Map<string, VoxelData> = new Map();
  private dimensions: Vector3;
  private voxelSize: number;
  private resolution: Vector3;
  private colors: Color[] = [];
  
  constructor(
    private stats: GcodeStats,
    resolution: Vector3 = new Vector3(128, 128, 128),
    voxelSize: number = 1.0
  ) {
    this.resolution = resolution;
    this.voxelSize = voxelSize;
    
    // Use fallback values if stats are incomplete
    const height = stats.totalHeight || 100;
    const layers = stats.totalLayers || 50;
    
    this.dimensions = new Vector3(
      resolution.x * voxelSize,
      height,
      resolution.z * voxelSize
    );
    
    this.initializeColors();
    this.generateVoxels();
  }
  
  private initializeColors(): void {
    // Extract colors from stats
    const colorDefs = this.stats.slicerInfo?.colorDefinitions || [];
    const statsColors = this.stats.colors || [];
    
    statsColors.forEach((colorInfo: ColorInfo, index: number) => {
      const hexColor = colorInfo.hexColor || colorDefs[index] || '#888888';
      this.colors.push(new Color(hexColor));
    });
    
    // Ensure we have at least one color
    if (this.colors.length === 0) {
      this.colors.push(new Color('#00ffff')); // Cyan for holographic feel
      this.colors.push(new Color('#ff00ff')); // Magenta
      this.colors.push(new Color('#00ff00')); // Green
    }
  }
  
  private generateVoxels(): void {
    const height = this.stats.totalHeight || 100;
    const layers = this.stats.totalLayers || 50;
    const layerHeight = height / layers;
    const centerX = this.dimensions.x / 2;
    const centerZ = this.dimensions.z / 2;
    
    // Generate voxels based on layer-color map
    const layerColorMap = this.stats.layerColorMap || new Map();
    
    console.log('VoxelDataStructure debug:', {
      hasLayerColorMap: !!this.stats.layerColorMap,
      layerColorMapSize: layerColorMap.size,
      totalLayers: this.stats.totalLayers,
      colorsLength: this.stats.colors?.length,
      colorUsageRanges: this.stats.colorUsageRanges?.length,
      statsKeys: Object.keys(this.stats)
    });
    
    // Try colorUsageRanges first, then layerColorMap, then fallback to demo
    const colorRanges = this.stats.colorUsageRanges || [];
    
    if (colorRanges.length > 0) {
      console.log('Using colorUsageRanges for voxel generation');
      // Use color usage ranges to generate voxels
      colorRanges.forEach(range => {
        const colorIndex = this.getColorIndexForId(range.colorId);
        for (let layer = range.startLayer; layer <= range.endLayer; layer++) {
          const y = layer * layerHeight;
          this.generateLayerVoxels(layer, y, colorIndex, centerX, centerZ);
        }
      });
    } else if (layerColorMap.size > 0) {
      console.log('Using layerColorMap for voxel generation');
      layerColorMap.forEach((toolId, layer) => {
        const colorIndex = this.getColorIndexForTool(toolId);
        const y = layer * layerHeight;
        this.generateLayerVoxels(layer, y, colorIndex, centerX, centerZ);
      });
    } else {
      console.log('Using demo data for voxel generation');
      // Generate demo data if no real data available
      for (let layer = 0; layer < layers; layer++) {
        const colorIndex = layer % Math.max(1, this.colors.length);
        const y = layer * layerHeight;
        this.generateLayerVoxels(layer, y, colorIndex, centerX, centerZ);
      }
    }
  }
  
  private generateLayerVoxels(
    layer: number, 
    y: number, 
    colorIndex: number,
    centerX: number,
    centerZ: number
  ): void {
    // Create a more realistic 3D print shape that varies by layer
    // This simulates a Slowpoke-like figure that gets wider at the bottom
    
    const maxRadius = Math.min(centerX, centerZ) * 0.6;
    const layerProgress = layer / (this.stats.totalLayers || 50);
    
    // Create a shape that's narrow at top, wider at bottom (like Slowpoke)
    let currentRadius: number;
    if (layerProgress < 0.3) {
      // Top section - small and round (head)
      currentRadius = maxRadius * 0.3;
    } else if (layerProgress < 0.7) {
      // Middle section - gradually expanding (body)
      const t = (layerProgress - 0.3) / 0.4;
      currentRadius = maxRadius * (0.3 + t * 0.4);
    } else {
      // Bottom section - widest (base/feet)
      currentRadius = maxRadius * 0.8;
    }
    
    // Generate points in a more organic pattern
    const pointsPerLayer = Math.max(20, Math.floor(currentRadius * 8));
    
    for (let i = 0; i < pointsPerLayer; i++) {
      const angle = (i / pointsPerLayer) * Math.PI * 2;
      
      // Add some organic variation to the radius
      const radiusVariation = 1 + Math.sin(angle * 3) * 0.2 + Math.cos(angle * 5) * 0.1;
      const r = currentRadius * radiusVariation;
      
      const x = centerX + Math.cos(angle) * r;
      const z = centerZ + Math.sin(angle) * r;
      
      const voxel: VoxelData = {
        position: new Vector3(x, y, z),
        colorIndex,
        layer,
        density: 0.8 + Math.random() * 0.2
      };
      
      const key = this.getVoxelKey(voxel.position);
      this.voxels.set(key, voxel);
      
      // Add some internal structure
      if (i % 5 === 0 && r > maxRadius * 0.2) {
        const innerRadius = r * 0.6;
        const innerX = centerX + Math.cos(angle) * innerRadius;
        const innerZ = centerZ + Math.sin(angle) * innerRadius;
        
        const innerVoxel: VoxelData = {
          position: new Vector3(innerX, y, innerZ),
          colorIndex,
          layer,
          density: 0.6
        };
        
        const innerKey = this.getVoxelKey(innerVoxel.position);
        this.voxels.set(innerKey, innerVoxel);
      }
    }
  }
  
  
  private getColorIndexForTool(toolId: string): number {
    const statsColors = this.stats.colors || [];
    const colorInfo = statsColors.find(c => c.id === toolId);
    if (colorInfo) {
      return statsColors.indexOf(colorInfo);
    }
    return 0;
  }

  private getColorIndexForId(colorId: string): number {
    const statsColors = this.stats.colors || [];
    const colorInfo = statsColors.find(c => c.id === colorId);
    if (colorInfo) {
      return statsColors.indexOf(colorInfo);
    }
    return 0;
  }
  
  private getVoxelKey(position: Vector3): string {
    const x = Math.floor(position.x / this.voxelSize);
    const y = Math.floor(position.y / this.voxelSize);
    const z = Math.floor(position.z / this.voxelSize);
    return `${x},${y},${z}`;
  }
  
  public getVolumetricData(): VolumetricData {
    const height = this.stats.totalHeight || 100;
    const layers = this.stats.totalLayers || 50;
    
    return {
      voxels: Array.from(this.voxels.values()),
      dimensions: this.dimensions,
      layerHeight: height / layers,
      colors: this.colors,
      totalLayers: layers
    };
  }
  
  public getVoxelsInRadius(center: Vector3, radius: number): VoxelData[] {
    return Array.from(this.voxels.values()).filter(voxel => 
      voxel.position.distanceTo(center) <= radius
    );
  }
  
  public getVoxelAtPosition(position: Vector3): VoxelData | null {
    const key = this.getVoxelKey(position);
    return this.voxels.get(key) || null;
  }
  
  public getLayerVoxels(layer: number): VoxelData[] {
    return Array.from(this.voxels.values()).filter(voxel => voxel.layer === layer);
  }
}