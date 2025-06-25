import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ColorOverlapAnalyzer } from '../ColorOverlapAnalyzer';
import { AmsConfiguration } from '../../models/AmsConfiguration';
import { AmsConfigurationMapper } from '../../mappers/AmsConfigurationMapper';
import { Color } from '../../models/Color';

describe('7-Color Bug Investigation', () => {
  let originalConsoleLog: any;
  let originalConsoleError: any;
  let logs: string[] = [];

  beforeEach(() => {
    // Capture console output for debugging
    logs = [];
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
      originalConsoleLog(...args);
    };
    console.error = (...args: any[]) => {
      logs.push('ERROR: ' + args.join(' '));
      originalConsoleError(...args);
    };
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  // Helper function to create test colors
  const createColor = (id: string, firstLayer: number, lastLayer: number, layerCount?: number, name?: string): Color => {
    return new Color(
      id,
      name || `Color ${id}`,
      '#000000',
      firstLayer,
      lastLayer
    );
  };

  it('should handle 7 colors without losing any in the optimization pipeline', () => {
    // Create 7 test colors that represent a realistic scenario
    const colors = [
      createColor('T0', 0, 50, 50, 'Base Color'),     // Layers 0-50
      createColor('T1', 10, 60, 50, 'Accent 1'),     // Layers 10-60 (overlaps with T0)
      createColor('T2', 51, 100, 50, 'Mid Color'),   // Layers 51-100 (no overlap with T0/T1)
      createColor('T3', 61, 110, 50, 'Accent 2'),    // Layers 61-110 (overlaps with T2)
      createColor('T4', 101, 150, 50, 'Top Color'),  // Layers 101-150 (no overlap with T2/T3)
      createColor('T5', 111, 160, 50, 'Detail 1'),   // Layers 111-160 (overlaps with T4)
      createColor('T6', 151, 200, 50, 'Final Color') // Layers 151-200 (no overlap with T4/T5)
    ];


    // Test ColorOverlapAnalyzer directly
    const analyzerResult = ColorOverlapAnalyzer.optimizeByIntervals(colors, 4);
    
    // Verify all colors are in the analyzer result
    const analyzerAssignedColors = new Set<string>();
    analyzerResult.assignments.forEach(slotColors => {
      slotColors.forEach(color => analyzerAssignedColors.add(color.id));
    });
    
    expect(analyzerAssignedColors.size).toBe(7);
    colors.forEach(color => {
      expect(analyzerAssignedColors.has(color.id)).toBe(true);
    });

    // Test full AmsConfiguration pipeline
    const amsConfig = new AmsConfiguration('intervals');
    amsConfig.assignColors(colors);

    // Verify all slots exist
    const allSlots = amsConfig.getAllSlots();
    expect(allSlots.length).toBe(4);

    // Count total assigned colors in AmsConfiguration
    let totalAssignedInConfig = 0;
    const configAssignedColors = new Set<string>();
    allSlots.forEach(slot => {
      totalAssignedInConfig += slot.colorIds.length;
      slot.colorIds.forEach(colorId => configAssignedColors.add(colorId));
    });

    expect(configAssignedColors.size).toBe(7);
    colors.forEach(color => {
      expect(configAssignedColors.has(color.id)).toBe(true);
    });

    // Test AmsConfigurationMapper
    const optimizationResult = AmsConfigurationMapper.toOptimizationResult(amsConfig, colors);
    
    // Verify all colors are in the final result
    const finalAssignedColors = new Set<string>();
    optimizationResult.slotAssignments.forEach(slot => {
      slot.colors.forEach(colorId => finalAssignedColors.add(colorId));
    });

    expect(finalAssignedColors.size).toBe(7);
    colors.forEach(color => {
      expect(finalAssignedColors.has(color.id)).toBe(true);
    });

    // Should have all 4 slots in the result (even if some are empty)
    expect(optimizationResult.slotAssignments.length).toBe(4);

    // Verify totalColors matches input
    expect(optimizationResult.totalColors).toBe(7);


    // Check for any error messages in logs
    const errorLogs = logs.filter(log => log.includes('ERROR') || log.includes('❌'));
    if (errorLogs.length > 0) {
      console.error('Error logs found:', errorLogs);
    }
    expect(errorLogs.length).toBe(0);
  });

  it('should handle the specific Venusaur-like scenario from the test suite', () => {
    // This is the exact scenario from the existing test that might be problematic
    const colors = [
      createColor('T0', 0, 200, 180, 'Teal'),       // Heavy usage
      createColor('T1', 10, 190, 150, 'Green'),     // Heavy overlap
      createColor('T2', 50, 180, 100, 'Pink'),      // Mid overlap
      createColor('T3', 60, 120, 50, 'Red'),        // Limited range
      createColor('T4', 5, 195, 140, 'White'),      // Heavy overlap
      createColor('T5', 70, 130, 40, 'Dark Green'), // Limited
      createColor('T6', 80, 140, 30, 'Yellow')      // Limited
    ];


    const intervalResult = ColorOverlapAnalyzer.optimizeByIntervals(colors, 4);
    
    // All colors should be assigned
    let totalAssigned = 0;
    intervalResult.assignments.forEach(slotColors => {
      totalAssigned += slotColors.length;
    });
    
    expect(totalAssigned).toBe(7);

    // Test through full pipeline
    const amsConfig = new AmsConfiguration('intervals');
    amsConfig.assignColors(colors);
    const result = AmsConfigurationMapper.toOptimizationResult(amsConfig, colors);

    // Final validation
    const finalColors = new Set<string>();
    result.slotAssignments.forEach(slot => {
      slot.colors.forEach(colorId => finalColors.add(colorId));
    });

    expect(finalColors.size).toBe(7);
    expect(result.totalColors).toBe(7);

  });
});