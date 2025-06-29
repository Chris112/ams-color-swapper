import type { ParserAlgorithm } from '../domain/models/AmsConfiguration';

export interface SystemConfiguration {
  type: 'ams' | 'toolhead';
  unitCount: number;
  totalSlots: number;
  parserAlgorithm?: ParserAlgorithm;
}

export interface PrintConstraints {
  maxSimultaneousColors: number;
  printerType: 'ams' | 'toolhead';
  purgeRequirements?: {
    minimumPurgeVolume: number;
    wasteFactorPercentage: number;
  };
  timingConstraints?: {
    minimumSwapTime: number; // seconds
    pauseOverhead: number; // seconds per pause
  };
}
