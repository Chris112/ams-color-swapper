import { GcodeParser } from './gcodeParser';
import { EnhancedGcodeParser, LineMode } from './enhancedGcodeParser';
import { Logger } from '../debug/logger';
import fs from 'fs';
import { performance } from 'perf_hooks';

interface PerformanceResult {
  parserName: string;
  fileSize: number;
  parseTime: number;
  memoryUsed: number;
  linesProcessed: number;
}

/**
 * Compare performance between original and enhanced parsers
 */
export async function compareParserPerformance(filePath: string): Promise<void> {
  const logger = new Logger();
  logger.setLogLevel('error'); // Suppress debug logs
  
  console.log('G-code Parser Performance Comparison');
  console.log('=====================================\n');
  
  // Get file info
  const stats = await fs.promises.stat(filePath);
  const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`Test file: ${filePath}`);
  console.log(`File size: ${fileSizeMB} MB\n`);
  
  // Test original parser
  console.log('Testing Original Parser...');
  const originalResult = await testOriginalParser(filePath, logger);
  
  // Test enhanced parser (streaming mode)
  console.log('\nTesting Enhanced Parser (Stream Mode)...');
  const enhancedStreamResult = await testEnhancedParserStream(filePath, logger);
  
  // Test enhanced parser (readline mode for compatibility)
  console.log('\nTesting Enhanced Parser (Readline Mode)...');
  const enhancedReadlineResult = await testEnhancedParserReadline(filePath, logger);
  
  // Test enhanced parser with events
  console.log('\nTesting Enhanced Parser (With Events)...');
  const enhancedEventsResult = await testEnhancedParserWithEvents(filePath, logger);
  
  // Display results
  console.log('\n\nPerformance Results');
  console.log('===================');
  displayResults([
    originalResult,
    enhancedStreamResult,
    enhancedReadlineResult,
    enhancedEventsResult
  ]);
  
  // Calculate improvements
  console.log('\n\nPerformance Improvements');
  console.log('========================');
  const improvement = ((originalResult.parseTime - enhancedStreamResult.parseTime) / originalResult.parseTime * 100).toFixed(1);
  console.log(`Stream mode is ${improvement}% faster than original parser`);
  
  const memImprovement = ((originalResult.memoryUsed - enhancedStreamResult.memoryUsed) / originalResult.memoryUsed * 100).toFixed(1);
  console.log(`Stream mode uses ${memImprovement}% less memory`);
}

async function testOriginalParser(filePath: string, logger: Logger): Promise<PerformanceResult> {
  const parser = new GcodeParser(logger);
  const memBefore = process.memoryUsage().heapUsed;
  const startTime = performance.now();
  
  const stats = await parser.parse(filePath, 'test.gcode');
  
  const endTime = performance.now();
  const memAfter = process.memoryUsage().heapUsed;
  
  return {
    parserName: 'Original Parser',
    fileSize: stats.fileSize || 0,
    parseTime: endTime - startTime,
    memoryUsed: memAfter - memBefore,
    linesProcessed: stats.totalLayers || 0
  };
}

async function testEnhancedParserStream(filePath: string, logger: Logger): Promise<PerformanceResult> {
  const parser = new EnhancedGcodeParser(logger, {
    enableEvents: false,
    lineMode: LineMode.STRIPPED,
    batchSize: 1000
  });
  
  const memBefore = process.memoryUsage().heapUsed;
  const startTime = performance.now();
  
  const stats = await parser.parseFile(filePath, 'test.gcode');
  
  const endTime = performance.now();
  const memAfter = process.memoryUsage().heapUsed;
  
  return {
    parserName: 'Enhanced Parser (Stream)',
    fileSize: stats.fileSize || 0,
    parseTime: endTime - startTime,
    memoryUsed: memAfter - memBefore,
    linesProcessed: stats.totalLayers || 0
  };
}

async function testEnhancedParserReadline(filePath: string, logger: Logger): Promise<PerformanceResult> {
  const parser = new EnhancedGcodeParser(logger, {
    enableEvents: false,
    lineMode: LineMode.STRIPPED
  });
  
  const memBefore = process.memoryUsage().heapUsed;
  const startTime = performance.now();
  
  const stats = await parser.parse(filePath, 'test.gcode');
  
  const endTime = performance.now();
  const memAfter = process.memoryUsage().heapUsed;
  
  return {
    parserName: 'Enhanced Parser (Readline)',
    fileSize: stats.fileSize || 0,
    parseTime: endTime - startTime,
    memoryUsed: memAfter - memBefore,
    linesProcessed: stats.totalLayers || 0
  };
}

async function testEnhancedParserWithEvents(filePath: string, logger: Logger): Promise<PerformanceResult> {
  const parser = new EnhancedGcodeParser(logger, {
    enableEvents: true,
    lineMode: LineMode.STRIPPED,
    batchSize: 2000
  });
  
  let eventCount = 0;
  parser.on('toolChange', () => eventCount++);
  parser.on('layer', () => eventCount++);
  parser.on('filamentChange', () => eventCount++);
  
  const memBefore = process.memoryUsage().heapUsed;
  const startTime = performance.now();
  
  const stats = await parser.parseFile(filePath, 'test.gcode');
  
  const endTime = performance.now();
  const memAfter = process.memoryUsage().heapUsed;
  
  console.log(`  Events emitted: ${eventCount}`);
  
  return {
    parserName: 'Enhanced Parser (Events)',
    fileSize: stats.fileSize || 0,
    parseTime: endTime - startTime,
    memoryUsed: memAfter - memBefore,
    linesProcessed: stats.totalLayers || 0
  };
}

function displayResults(results: PerformanceResult[]): void {
  console.log('\n');
  console.log('Parser Name                 | Parse Time (ms) | Memory Used (MB) | Throughput (MB/s)');
  console.log('---------------------------|-----------------|------------------|------------------');
  
  results.forEach(result => {
    const parseTimeStr = result.parseTime.toFixed(2).padStart(15);
    const memoryStr = (result.memoryUsed / 1024 / 1024).toFixed(2).padStart(16);
    const throughput = ((result.fileSize / 1024 / 1024) / (result.parseTime / 1000)).toFixed(2).padStart(17);
    
    console.log(`${result.parserName.padEnd(26)} |${parseTimeStr} |${memoryStr} |${throughput}`);
  });
}

/**
 * Generate a large test G-code file for performance testing
 */
export async function generateTestGcodeFile(filePath: string, layers: number = 1000): Promise<void> {
  console.log(`Generating test G-code file with ${layers} layers...`);
  
  const stream = fs.createWriteStream(filePath);
  
  // Header
  stream.write('; generated by Test Generator 1.0\n');
  stream.write('; filament_colour = #FF0000;#00FF00;#0000FF;#FFFF00\n');
  stream.write('; estimated printing time = 5h 30m 15s\n\n');
  
  // Generate layers
  for (let layer = 0; layer < layers; layer++) {
    stream.write(`\n; layer ${layer}\n`);
    stream.write(`; Z = ${(layer * 0.2).toFixed(2)}\n`);
    
    // Tool change every 50 layers
    if (layer % 50 === 0 && layer > 0) {
      const tool = layer / 50 % 4;
      stream.write(`T${tool}\n`);
    }
    
    // Generate moves
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 200;
      const y = Math.random() * 200;
      const e = Math.random() * 5;
      
      if (i === 0) {
        stream.write(`G0 X${x.toFixed(3)} Y${y.toFixed(3)} Z${(layer * 0.2).toFixed(2)} F9000\n`);
      } else {
        stream.write(`G1 X${x.toFixed(3)} Y${y.toFixed(3)} E${e.toFixed(4)} F1800\n`);
      }
    }
    
    // Add M600 every 200 layers
    if (layer % 200 === 0 && layer > 0) {
      stream.write('M600 ; Filament change\n');
    }
  }
  
  // Footer
  stream.write('\n; End of print\n');
  stream.write('G28 ; Home all axes\n');
  stream.write('M84 ; Disable motors\n');
  
  await new Promise((resolve) => stream.end(resolve));
  
  const stats = await fs.promises.stat(filePath);
  console.log(`Test file generated: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
}

// Example usage
if (require.main === module) {
  (async () => {
    const testFile = '/tmp/test_performance.gcode';
    
    // Generate test file if it doesn't exist
    if (!fs.existsSync(testFile)) {
      await generateTestGcodeFile(testFile, 500);
    }
    
    // Run performance comparison
    await compareParserPerformance(testFile);
  })().catch(console.error);
}