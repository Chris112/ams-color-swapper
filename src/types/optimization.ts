import type { ColorPair } from './color';
import type { SystemConfiguration } from './configuration';

export interface OptimizationResult {
  totalColors: number;
  requiredSlots: number;
  totalSlots?: number; // Total slots available in the configuration
  slotAssignments: SlotAssignment[];
  manualSwaps: ManualSwap[];
  estimatedTimeSaved: number;
  canShareSlots: ColorPair[];
  configuration?: SystemConfiguration;
}

export interface SlotAssignment {
  unit: number;
  slot: number;
  slotId: string;
  colors: string[];
  isPermanent: boolean;
}

export interface ManualSwap {
  unit: number;
  slot: number;
  fromColor: string;
  toColor: string;
  atLayer: number;
  pauseStartLayer: number;
  pauseEndLayer: number;
  zHeight?: number; // Make optional as it might not always be available
  reason: string;
  // Enhanced timing flexibility
  timingOptions: {
    earliest: number; // Earliest possible layer for this swap
    latest: number; // Latest possible layer for this swap
    optimal: number; // Recommended layer (same as atLayer)
    adjacentOnly: boolean; // If swap must be adjacent to color usage
    bufferLayers: number; // Buffer layers around color usage
  };
  swapWindow: {
    startLayer: number; // Start of valid swap window
    endLayer: number; // End of valid swap window
    flexibilityScore: number; // 0-100, how flexible this timing is
    constraints: string[]; // Reasons for timing constraints
  };
  confidence: {
    timing: number; // 0-100, confidence in timing recommendation
    necessity: number; // 0-100, how necessary this swap is
    userControl: number; // 0-100, how much user can adjust this
  };
}
