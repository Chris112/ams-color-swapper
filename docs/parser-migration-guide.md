# G-code Parser Migration Guide

This guide helps you migrate from the original `GcodeParser` to the new `EnhancedGcodeParser` which incorporates best practices and patterns from the `gcode-parser` npm library.

## Key Improvements

### 1. **Stream-Based Processing**
The enhanced parser uses Node.js Transform streams for memory-efficient processing of large files.

```typescript
// Old approach - loads entire file into memory
const parser = new GcodeParser(logger);
const stats = await parser.parse(filePath, fileName);

// New approach - streams file data
const parser = new EnhancedGcodeParser(logger);
const stats = await parser.parseFile(filePath, fileName);
```

### 2. **Event-Driven Architecture**
Real-time notifications during parsing process.

```typescript
const parser = new EnhancedGcodeParser(logger, { enableEvents: true });

parser.on('toolChange', (change) => {
  console.log(`Tool changed from ${change.fromTool} to ${change.toTool}`);
});

parser.on('layer', ({ layer, tool, z }) => {
  console.log(`Processing layer ${layer}`);
});

parser.on('filamentChange', ({ layer, lineNumber }) => {
  console.log(`M600 detected at layer ${layer}`);
});
```

### 3. **Flexible Line Parsing**
Multiple output formats for different use cases.

```typescript
// Keep original line with comments and whitespace
parseLine('G0 X10 Y20 ; comment', { lineMode: LineMode.ORIGINAL });

// Remove comments but keep whitespace
parseLine('G0 X10 Y20 ; comment', { lineMode: LineMode.STRIPPED });

// Remove all comments and whitespace
parseLine('G0 X10 Y20 ; comment', { lineMode: LineMode.COMPACT });
```

### 4. **Advanced Comment Handling**
Properly handles nested parentheses and mixed comment styles.

```typescript
// Handles nested parentheses
parseLine('G0 X10 (outer (inner) comment) Y20');
// Comments: ['outer (inner) comment']

// Handles semicolon after parentheses
parseLine('G0 (move) X10 ; end comment');
// Comments: ['move', 'end comment']
```

### 5. **Performance Optimizations**
- Batch processing with configurable batch size
- Non-blocking processing using `setImmediate`
- Efficient regex-based word parsing

```typescript
const parser = new EnhancedGcodeParser(logger, {
  batchSize: 2000  // Process 2000 lines per batch
});
```

### 6. **Comprehensive Word Parsing**
Uses regex to parse all G-code elements efficiently.

```typescript
const result = parseLine('N123 G0 X10.5 Y-20 Z+5.25 F3000 *45');
// result.ln = 123 (line number)
// result.words = [['G', 0], ['X', 10.5], ['Y', -20], ['Z', 5.25], ['F', 3000]]
// result.cs = 45 (checksum)
```

### 7. **Special Command Support**
Handles Grbl ($), bCNC (%), and TinyG ({}) commands.

```typescript
parseLine('$H');        // Grbl homing
parseLine('%wait');     // bCNC wait command
parseLine('{"sr":null}'); // TinyG JSON command
```

## Migration Steps

### Step 1: Update Imports

```typescript
// Old
import { GcodeParser } from './parser/gcodeParser';

// New
import { EnhancedGcodeParser, LineMode } from './parser/enhancedGcodeParser';
```

### Step 2: Update Parser Instantiation

```typescript
// Old
const parser = new GcodeParser(logger);

// New - with options
const parser = new EnhancedGcodeParser(logger, {
  enableEvents: true,
  lineMode: LineMode.STRIPPED,
  batchSize: 1000,
  flatten: false
});
```

### Step 3: Add Event Listeners (Optional)

```typescript
parser.on('start', ({ fileName }) => {
  updateUI('Parsing started', fileName);
});

parser.on('toolChange', (change) => {
  updateProgress(`Tool change: ${change.toTool}`);
});

parser.on('end', (stats) => {
  updateUI('Parsing complete', stats);
});
```

### Step 4: Update Parse Method Call

```typescript
// Old
const stats = await parser.parse(filePath, fileName);

// New - same interface, enhanced internals
const stats = await parser.parseFile(filePath, fileName);

// Or use the backward-compatible method
const stats = await parser.parse(filePath, fileName);
```

## New Features to Leverage

### 1. Synchronous String Parsing
For small G-code snippets or testing:

```typescript
const parser = new EnhancedGcodeParser();
const results = parser.parseStringSync('G0 X10\nG1 Y20');
```

### 2. Stream Processing
For custom stream sources:

```typescript
import { GCodeLineStream } from './parser/enhancedGcodeParser';

const lineStream = new GCodeLineStream({ flatten: true });
customStream.pipe(lineStream);

lineStream.on('data', (parsed) => {
  console.log('Parsed line:', parsed);
});
```

### 3. Checksum Validation
Automatically validates checksums when present:

```typescript
const result = parseLine('N123 G0 X10 *45');
if (result.err) {
  console.error('Checksum mismatch!');
}
```

## Performance Considerations

1. **Large Files**: The enhanced parser uses streams, making it suitable for files of any size
2. **Memory Usage**: Constant memory usage regardless of file size
3. **Processing Speed**: Batch processing improves throughput for large files
4. **Real-time Updates**: Event emitters allow for progress tracking without impacting performance

## Backward Compatibility

The enhanced parser maintains the same output format (`GcodeStats`) as the original parser, ensuring drop-in compatibility for existing code that consumes the parsing results.

## Testing

The enhanced parser includes comprehensive test coverage. Run tests with:

```bash
npm test -- enhancedGcodeParser.test.ts
```

## Example: Complete Migration

```typescript
// Before
class MyGcodeProcessor {
  async processFile(filePath: string) {
    const parser = new GcodeParser();
    const stats = await parser.parse(filePath, 'myfile.gcode');
    console.log(`Parsed ${stats.totalLayers} layers`);
    return stats;
  }
}

// After
class MyGcodeProcessor {
  async processFile(filePath: string) {
    const parser = new EnhancedGcodeParser(undefined, {
      enableEvents: true,
      lineMode: LineMode.STRIPPED
    });
    
    // Optional: Add progress tracking
    parser.on('layer', ({ layer }) => {
      this.updateProgress(layer);
    });
    
    const stats = await parser.parseFile(filePath, 'myfile.gcode');
    console.log(`Parsed ${stats.totalLayers} layers`);
    return stats;
  }
  
  updateProgress(layer: number) {
    console.log(`Processing layer ${layer}...`);
  }
}
```

## Troubleshooting

1. **Different parsing results**: Check the `lineMode` option - use `LineMode.ORIGINAL` for exact compatibility
2. **Memory issues with old parser**: Switch to the enhanced parser's streaming mode
3. **Need line-by-line processing**: Use the event emitters to process lines as they're parsed
4. **Performance concerns**: Adjust `batchSize` option (larger = faster but more memory)