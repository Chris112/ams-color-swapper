import { describe, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { GcodeParser } from '../gcodeParser';
import { Logger } from '../../utils/logger';

describe('Slowking T0 Disappearance Analysis', () => {
  const filePath = resolve(__dirname, '../../../examples/6_color_Slowking.gcode');

  it('should analyze when and why T0 disappears from layers', async () => {
    const fileContent = readFileSync(filePath);
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const file = new File([blob], '6_color_Slowking.gcode', { type: 'text/plain' });

    const logger = new Logger('slowking-t0-analysis');
    const parser = new GcodeParser(logger);
    const stats = await parser.parse(file);

    console.log('\n=== T0 DISAPPEARANCE ANALYSIS ===');

    // Find where T0 stops appearing
    let lastT0Layer = -1;
    let firstMissingT0Layer = -1;

    for (let layer = 0; layer < stats.totalLayers; layer++) {
      const colors = stats.layerColorMap.get(layer) || [];
      if (colors.includes('T0')) {
        lastT0Layer = layer;
      } else if (firstMissingT0Layer === -1) {
        firstMissingT0Layer = layer;
      }
    }

    console.log(`Last layer with T0: ${lastT0Layer}`);
    console.log(`First layer without T0: ${firstMissingT0Layer}`);

    // Analyze the transition area around where T0 disappears
    console.log('\n=== TRANSITION AREA ANALYSIS ===');
    const startAnalysis = Math.max(0, lastT0Layer - 10);
    const endAnalysis = Math.min(stats.totalLayers - 1, lastT0Layer + 20);

    for (let layer = startAnalysis; layer <= endAnalysis; layer++) {
      const colors = stats.layerColorMap.get(layer) || [];
      const hasT0 = colors.includes('T0');
      const status = hasT0 ? '✅' : '❌';
      console.log(`Layer ${layer}: ${status} [${colors.join(', ')}]`);
    }

    // Check tool changes around the disappearance point
    console.log('\n=== TOOL CHANGES AROUND T0 DISAPPEARANCE ===');
    const relevantChanges = stats.toolChanges.filter(
      (change) => change.layer >= lastT0Layer - 5 && change.layer <= lastT0Layer + 10
    );

    relevantChanges.forEach((change) => {
      console.log(`Layer ${change.layer}: ${change.fromTool} → ${change.toTool}`);
    });

    // Analyze final layers to see what's happening
    console.log('\n=== FINAL LAYERS ANALYSIS (Last 20) ===');
    for (let layer = stats.totalLayers - 20; layer < stats.totalLayers; layer++) {
      const colors = stats.layerColorMap.get(layer) || [];
      console.log(`Layer ${layer}: [${colors.join(', ')}]`);
    }

    // Check if there are any tool changes back to T0 after it disappears
    console.log('\n=== T0 REAPPEARANCE ATTEMPTS ===');
    const t0ReturnsAfterDisappearance = stats.toolChanges.filter(
      (change) => change.layer > lastT0Layer && change.toTool === 'T0'
    );

    console.log(`T0 tool changes after layer ${lastT0Layer}:`, t0ReturnsAfterDisappearance.length);
    t0ReturnsAfterDisappearance.forEach((change) => {
      console.log(`  Layer ${change.layer}: ${change.fromTool} → T0`);
    });

    // Key insight: If T0 never comes back, it's expected behavior
    // If T0 comes back but doesn't appear in layer map, it's a parser issue
    if (t0ReturnsAfterDisappearance.length === 0) {
      console.log(
        '\n🔍 INSIGHT: T0 never returns after layer 201 - this might be correct for this model'
      );
      console.log(
        '   If you expect T0 on all layers, the G-code itself might not activate T0 in later layers'
      );
    } else {
      console.log('\n🔍 INSIGHT: T0 does return but is not being tracked properly');
    }
  });

  it('should check if T0 is supposed to be the default base color', async () => {
    // Parse just the beginning to see initial state
    const fileContent = readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n').slice(0, 1000); // First 1000 lines

    console.log('\n=== INITIAL T0 STATE ANALYSIS ===');

    // Look for initial tool commands
    const initialTools: string[] = [];
    const initialComments: string[] = [];

    for (let i = 0; i < Math.min(100, lines.length); i++) {
      const line = lines[i].trim();

      // Tool commands
      if (line.match(/^T[0-9]/)) {
        initialTools.push(`Line ${i + 1}: ${line}`);
      }

      // Comments about tools or colors
      if (line.includes('extruder') || line.includes('tool') || line.includes('color')) {
        initialComments.push(`Line ${i + 1}: ${line}`);
      }
    }

    console.log('Initial tool commands:');
    initialTools.slice(0, 10).forEach((tool) => console.log(`  ${tool}`));

    console.log('\nRelevant comments:');
    initialComments.slice(0, 10).forEach((comment) => console.log(`  ${comment}`));

    // Check if the file explicitly starts with T0 or another tool
    const firstToolCommand = initialTools[0];
    if (firstToolCommand) {
      console.log(`\nFirst tool command: ${firstToolCommand}`);
      if (firstToolCommand.includes('T0')) {
        console.log('✅ T0 is the initial tool - should appear on early layers');
      } else {
        console.log('⚠️  T0 is NOT the initial tool - layer assignment may be different');
      }
    }
  });
});
