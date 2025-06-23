import { GcodeParser } from './src/parser/gcodeParser';
import { Logger } from './src/debug/logger';

async function testParser() {
  const logger = new Logger();
  const parser = new GcodeParser(logger);
  
  const filePath = 'uploads/gcode-1750679628277-907897551.gcode';
  const fileName = 'test.gcode';
  
  console.log('Starting parse...');
  const stats = await parser.parse(filePath, fileName);
  
  console.log('\n=== PARSE RESULTS ===');
  console.log('Total layers:', stats.totalLayers);
  console.log('Tool changes:', stats.toolChanges.length);
  console.log('\nColors found:');
  stats.colors.forEach(color => {
    console.log(`  ${color.id}: Layers ${color.firstLayer}-${color.lastLayer} (${color.layerCount} layers)`);
  });
  
  console.log('\nFirst 10 layer mappings:');
  const layers = Array.from(stats.layerColorMap.entries()).slice(0, 10);
  layers.forEach(([layer, tool]) => {
    console.log(`  Layer ${layer}: ${tool}`);
  });
  
  console.log('\nFirst 10 tool changes:');
  stats.toolChanges.slice(0, 10).forEach(tc => {
    console.log(`  ${tc.fromTool} → ${tc.toTool} at layer ${tc.layer}`);
  });
}

testParser().catch(console.error);