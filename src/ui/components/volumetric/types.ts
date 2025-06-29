import { Vector3, Color } from 'three';
import { GcodeStats } from '../../../types/gcode';

export interface VoxelData {
  position: Vector3;
  colorIndex: number;
  layer: number;
  density: number;
}

export interface VolumetricData {
  voxels: VoxelData[];
  dimensions: Vector3;
  layerHeight: number;
  colors: Color[];
  totalLayers: number;
}

export enum ViewMode {
  NORMAL = 'normal',
  XRAY = 'xray',
  EXPLODED = 'exploded',
  WIREFRAME = 'wireframe',
}

export interface HologramConfig {
  resolution: Vector3;
  voxelSize: number;
  particleCount: number;
  enableEffects: boolean;
  showScanlines: boolean;
  showParticles: boolean;
}

export interface InteractionState {
  currentLayer: number;
  selectedVoxel: VoxelData | null;
  viewMode: ViewMode;
  isPlaying: boolean;
  playbackSpeed: number;
}

export interface HologramEvents {
  onLayerChange: (layer: number) => void;
  onVoxelClick: (voxel: VoxelData) => void;
  onModeChange: (mode: ViewMode) => void;
  onPlaybackToggle: (playing: boolean) => void;
}

export interface HologramProps {
  stats: GcodeStats;
  config?: Partial<HologramConfig>;
  events?: Partial<HologramEvents>;
}
