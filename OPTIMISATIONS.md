# Performance Optimizations for AMS Color Swapper

This document outlines performance optimizations identified through algorithmic analysis of the codebase. Each optimization includes the rationale, implementation strategy, and expected impact.

## 1. String Operations & Regex Optimization

### Current Issues
- Multiple regex operations per line in `gcodeParser.ts`
- Repeated string splitting for command extraction
- Regex patterns compiled on every use
- String concatenation in loops

### Optimizations

#### 1.1 Single-Pass Line Parsing
```typescript
// Instead of multiple regex matches:
const parseLineOptimized = (line: string): ParsedCommand => {
  const len = line.length;
  let i = 0;
  let command = '';
  const params = new Map<string, number>();
  
  // Extract command (first non-whitespace sequence)
  while (i < len && line[i] === ' ') i++;
  const cmdStart = i;
  while (i < len && line[i] !== ' ' && line[i] !== ';') i++;
  command = line.substring(cmdStart, i).toUpperCase();
  
  // Parse parameters in single pass
  while (i < len && line[i] !== ';') {
    while (i < len && line[i] === ' ') i++;
    if (i >= len || line[i] === ';') break;
    
    const paramType = line[i];
    i++;
    const numStart = i;
    while (i < len && line[i] !== ' ' && line[i] !== ';') i++;
    const value = parseFloat(line.substring(numStart, i));
    
    if (!isNaN(value)) {
      params.set(paramType, value);
    }
  }
  
  return { command, params };
};
```

#### 1.2 Pre-compiled Regex Patterns
```typescript
// Create once, reuse many times
const PATTERNS = {
  layerNum: /layer num\/total_layer_count:\s*(\d+)/,
  layerHash: /; layer #(\d+)/,
  standardLayer: /(?:LAYER:|layer )\s*(\d+)/i,
  timeEstimate: /total estimated time:\s*(\d+)h\s*(\d+)m\s*(\d+)s/,
  filamentCost: /filament cost = (.+)/,
  filamentWeight: /filament used \[g\] = (.+)/,
} as const;

// Use pre-compiled patterns
const layerMatch = line.match(PATTERNS.layerNum);
```

### Expected Impact
- 30-40% reduction in parsing time for large files
- Lower memory allocation from reduced temporary strings
- Better CPU cache utilization

## 2. Memory Management Improvements

### Current Issues
- Raw G-code content stored in multiple places
- Full file loaded into memory for geometry generation
- Inefficient array allocations
- Memory leaks from undisposed Three.js geometries

### Optimizations

#### 2.1 Eliminate Duplicate Storage
```typescript
// Remove raw content storage after geometry generation
async parse(file: File): Promise<GcodeStats> {
  // Don't store raw content in stats
  const stats = await this.processLines(reader);
  
  // Generate geometry on-demand if needed
  if (needsGeometry) {
    const geometry = await this.generateGeometryStreaming(file);
    stats.geometry = geometry;
  }
  
  return stats;
}
```

#### 2.2 Streaming Geometry Generation
```typescript
async generateGeometryStreaming(file: File): Promise<PrintGeometry> {
  const reader = new BrowserFileReader(file);
  const converter = new StreamingGeometryConverter();
  
  for await (const line of reader.readLines()) {
    converter.processLine(line);
    
    // Process in chunks to avoid memory buildup
    if (converter.shouldFlush()) {
      await converter.flushToGeometry();
    }
  }
  
  return converter.finalize();
}
```

#### 2.3 TypedArray Usage
```typescript
// Use Float32Array for position data
class OptimizedGeometry {
  private positions: Float32Array;
  private positionIndex = 0;
  
  constructor(estimatedVertices: number) {
    // Pre-allocate based on estimate
    this.positions = new Float32Array(estimatedVertices * 3);
  }
  
  addVertex(x: number, y: number, z: number) {
    this.positions[this.positionIndex++] = x;
    this.positions[this.positionIndex++] = y;
    this.positions[this.positionIndex++] = z;
  }
}
```

### Expected Impact
- 50% reduction in memory usage for large files
- Ability to handle files 2x larger
- Reduced garbage collection pauses

## 3. Parsing Algorithm Enhancements

### Current Issues
- Full file parsing even when only metadata needed
- Linear search through color maps
- Redundant command parsing
- Inefficient switch statement

### Optimizations

#### 3.1 Early Termination
```typescript
interface ParseOptions {
  metadataOnly?: boolean;
  stopAfterHeaders?: boolean;
}

async parseWithOptions(file: File, options: ParseOptions): Promise<GcodeStats> {
  const metadataComplete = false;
  
  for await (const line of reader.readLines()) {
    this.parseLine(line);
    
    if (options.metadataOnly && this.hasAllMetadata()) {
      break; // Stop parsing once we have all metadata
    }
    
    if (options.stopAfterHeaders && !line.startsWith(';')) {
      break; // Stop after comment headers
    }
  }
}
```

#### 3.2 Command Lookup Table
```typescript
// Replace switch with function lookup
const COMMAND_HANDLERS = new Map<string, (line: string) => void>([
  ['G0', this.parseMove.bind(this)],
  ['G1', this.parseMove.bind(this)],
  ['M600', this.parseFilamentChange.bind(this)],
  ['T0', () => this.parseToolChange('T0')],
  // ... etc
]);

parseLine(line: string) {
  const cmd = line.substring(0, line.indexOf(' ') || line.length);
  const handler = COMMAND_HANDLERS.get(cmd);
  if (handler) {
    handler(line);
  }
}
```

#### 3.3 Binary Search for Layers
```typescript
class LayerIndex {
  private layers: Array<{ layer: number, startLine: number }> = [];
  
  addLayer(layer: number, lineNumber: number) {
    this.layers.push({ layer, startLine: lineNumber });
  }
  
  findLayer(targetLayer: number): number {
    let left = 0;
    let right = this.layers.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (this.layers[mid].layer === targetLayer) {
        return this.layers[mid].startLine;
      }
      if (this.layers[mid].layer < targetLayer) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    return -1;
  }
}
```

### Expected Impact
- 60% faster metadata extraction
- O(log n) layer lookups instead of O(n)
- 20% overall parsing speed improvement

## 4. Geometry Generation Optimization

### Current Issues
- Dynamic segment calculation creates too many vertices
- No level-of-detail system
- Redundant geometry for similar paths
- Inefficient merging of geometries

### Optimizations

#### 4.1 Fixed Segment Count
```typescript
// Reduce complexity while maintaining visual quality
const TUBE_SEGMENTS = {
  CURVE: 6,      // Reduced from dynamic calculation
  RADIAL: 4,     // Reduced from 6
  LOD_FAR: 2,    // For distant layers
} as const;

createTubeGeometry(path: GcodePath, lod: 'near' | 'far' = 'near'): THREE.BufferGeometry {
  const segments = lod === 'near' ? TUBE_SEGMENTS.CURVE : TUBE_SEGMENTS.LOD_FAR;
  const radialSegments = lod === 'near' ? TUBE_SEGMENTS.RADIAL : 2;
  
  return new THREE.TubeGeometry(
    curve,
    segments,
    this.scaledLineWidth / 2,
    radialSegments,
    false
  );
}
```

#### 4.2 Instanced Rendering
```typescript
class InstancedExtrusionRenderer {
  private baseGeometry: THREE.BufferGeometry;
  private instancedMesh: THREE.InstancedMesh;
  
  constructor() {
    // Create single tube segment as base
    this.baseGeometry = this.createBaseSegment();
  }
  
  renderPaths(paths: GcodePath[]) {
    const matrices: THREE.Matrix4[] = [];
    
    for (const path of paths) {
      // Calculate transform matrices for each segment
      for (let i = 0; i < path.points.length - 1; i++) {
        const matrix = this.calculateSegmentMatrix(
          path.points[i], 
          path.points[i + 1]
        );
        matrices.push(matrix);
      }
    }
    
    // Single draw call for all segments
    this.instancedMesh = new THREE.InstancedMesh(
      this.baseGeometry,
      material,
      matrices.length
    );
  }
}
```

#### 4.3 Geometry Batching
```typescript
class BatchedGeometryBuilder {
  private vertexBuffers = new Map<string, Float32Array>();
  private indexBuffers = new Map<string, Uint32Array>();
  
  addPath(toolIndex: number, path: GcodePath) {
    const key = `tool_${toolIndex}`;
    
    if (!this.vertexBuffers.has(key)) {
      // Pre-allocate buffers per tool
      this.vertexBuffers.set(key, new Float32Array(100000));
      this.indexBuffers.set(key, new Uint32Array(50000));
    }
    
    // Append to existing buffer
    this.appendToBuffer(key, path);
  }
  
  finalize(): Map<number, THREE.BufferGeometry> {
    const geometries = new Map<number, THREE.BufferGeometry>();
    
    this.vertexBuffers.forEach((vertices, key) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      // ... set other attributes
      geometries.set(parseInt(key.split('_')[1]), geometry);
    });
    
    return geometries;
  }
}
```

### Expected Impact
- 70% reduction in vertex count
- 50% faster geometry generation
- 80% less memory for geometry storage
- Better GPU performance

## 5. Web Worker Strategy

### Current Issues
- High threshold (5MB) before using workers
- No progress reporting from worker
- Message passing overhead
- Cold start penalty

### Optimizations

#### 5.1 Lower Worker Threshold
```typescript
const WORKER_THRESHOLD = 1024 * 1024; // 1MB instead of 5MB

// Pre-warm worker on page load
const workerPool = new WorkerPool({
  workerScript: '/parser-worker.js',
  maxWorkers: 1, // Single worker, pre-initialized
  keepAlive: true
});
```

#### 5.2 SharedArrayBuffer Support
```typescript
// Zero-copy data transfer when available
class SharedBufferParser {
  async parse(file: File): Promise<GcodeStats> {
    if (typeof SharedArrayBuffer !== 'undefined') {
      // Use shared memory for large files
      const buffer = new SharedArrayBuffer(file.size);
      const view = new Uint8Array(buffer);
      
      // Read file into shared buffer
      const arrayBuffer = await file.arrayBuffer();
      view.set(new Uint8Array(arrayBuffer));
      
      // Pass shared buffer to worker (zero-copy)
      return await worker.parseSharedBuffer(buffer);
    } else {
      // Fallback to regular transfer
      return await worker.parseTransferable(file);
    }
  }
}
```

#### 5.3 Streaming Progress Updates
```typescript
// In worker
self.onmessage = async (e) => {
  const { file, id } = e.data;
  const PROGRESS_INTERVAL = 1000; // lines
  let lineCount = 0;
  
  for await (const line of readLines(file)) {
    parseLine(line);
    lineCount++;
    
    if (lineCount % PROGRESS_INTERVAL === 0) {
      self.postMessage({
        type: 'progress',
        id,
        progress: calculateProgress(lineCount, file.size)
      });
    }
  }
  
  self.postMessage({
    type: 'complete',
    id,
    result: stats
  });
};
```

### Expected Impact
- Worker utilized for more files (>1MB)
- Real-time progress updates
- 90% reduction in data transfer overhead with SharedArrayBuffer
- Instant worker availability

## 6. Color Assignment Algorithm

### Current Issues
- Potentially exponential complexity for many colors
- Redundant overlap calculations
- Inefficient grouping algorithm
- No memoization of results

### Optimizations

#### 6.1 Greedy Algorithm with Heuristics
```typescript
class OptimizedColorAssigner {
  assignColors(colors: Color[]): AmsConfiguration {
    // Sort by multiple criteria for better assignment
    const sorted = colors.sort((a, b) => {
      // Primary: layer count (usage)
      const usageDiff = b.layerCount - a.layerCount;
      if (usageDiff !== 0) return usageDiff;
      
      // Secondary: start layer (earlier is better)
      const startDiff = a.firstLayer - b.firstLayer;
      if (startDiff !== 0) return startDiff;
      
      // Tertiary: continuous usage (less gaps)
      return b.continuityScore - a.continuityScore;
    });
    
    // Greedy assignment with look-ahead
    return this.greedyAssign(sorted);
  }
  
  private greedyAssign(colors: Color[]): AmsConfiguration {
    const config = new AmsConfiguration();
    const slots = new Array(4).fill(null).map(() => new SlotSchedule());
    
    for (const color of colors) {
      // Find best slot using heuristics
      const bestSlot = this.findBestSlot(color, slots);
      slots[bestSlot].addColor(color);
    }
    
    return this.buildConfig(slots);
  }
}
```

#### 6.2 Overlap Memoization
```typescript
class OverlapCache {
  private cache = new Map<string, boolean>();
  
  checkOverlap(color1: Color, color2: Color): boolean {
    const key = `${color1.id}_${color2.id}`;
    const reverseKey = `${color2.id}_${color1.id}`;
    
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    
    const overlaps = color1.overlapsWith(color2);
    this.cache.set(key, overlaps);
    this.cache.set(reverseKey, overlaps);
    
    return overlaps;
  }
}
```

#### 6.3 Bit Manipulation for Slots
```typescript
class SlotAvailability {
  private availability: Uint32Array;
  
  constructor(maxLayers: number) {
    // Each bit represents a layer
    this.availability = new Uint32Array(Math.ceil(maxLayers / 32));
  }
  
  markUsed(startLayer: number, endLayer: number) {
    for (let layer = startLayer; layer <= endLayer; layer++) {
      const index = Math.floor(layer / 32);
      const bit = layer % 32;
      this.availability[index] |= (1 << bit);
    }
  }
  
  canFit(startLayer: number, endLayer: number): boolean {
    for (let layer = startLayer; layer <= endLayer; layer++) {
      const index = Math.floor(layer / 32);
      const bit = layer % 32;
      if (this.availability[index] & (1 << bit)) {
        return false;
      }
    }
    return true;
  }
}
```

### Expected Impact
- O(n log n) complexity instead of potential O(n!)
- 90% faster color assignment for 10+ colors
- Deterministic results
- Memory-efficient slot tracking

## 7. Caching Enhancements

### Current Issues
- No cache size limits
- Uncompressed storage
- Full file caching only
- No cache warming

### Optimizations

#### 7.1 LRU Cache with Size Limits
```typescript
class LRUCache<T> {
  private maxSize: number;
  private currentSize = 0;
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder: string[] = [];
  
  constructor(maxSizeMB: number) {
    this.maxSize = maxSizeMB * 1024 * 1024;
  }
  
  async set(key: string, value: T) {
    const size = this.estimateSize(value);
    
    // Evict until we have space
    while (this.currentSize + size > this.maxSize && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift()!;
      const oldEntry = this.cache.get(oldestKey);
      if (oldEntry) {
        this.currentSize -= oldEntry.size;
        this.cache.delete(oldestKey);
      }
    }
    
    // Add new entry
    this.cache.set(key, { value, size, lastAccess: Date.now() });
    this.accessOrder.push(key);
    this.currentSize += size;
  }
}
```

#### 7.2 Compression Support
```typescript
class CompressedCache {
  async set(key: string, data: GcodeStats) {
    if ('CompressionStream' in window) {
      // Use native compression
      const json = JSON.stringify(data);
      const blob = new Blob([json]);
      const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
      const compressed = await new Response(stream).arrayBuffer();
      
      await this.storage.set(key, compressed);
    } else {
      // Fallback to uncompressed
      await this.storage.set(key, data);
    }
  }
  
  async get(key: string): Promise<GcodeStats | null> {
    const data = await this.storage.get(key);
    if (!data) return null;
    
    if (data instanceof ArrayBuffer) {
      // Decompress
      const stream = new Response(data).body!
        .pipeThrough(new DecompressionStream('gzip'));
      const decompressed = await new Response(stream).text();
      return JSON.parse(decompressed);
    }
    
    return data;
  }
}
```

#### 7.3 Partial Caching
```typescript
interface PartialCache {
  metadata: GcodeMetadata;
  colorInfo: ColorInfo[];
  optimization: OptimizationResult;
  // Geometry generated on-demand
}

class SmartCache {
  async cachePartial(key: string, stats: GcodeStats) {
    // Cache only essential data
    const partial: PartialCache = {
      metadata: this.extractMetadata(stats),
      colorInfo: stats.colors,
      optimization: stats.optimization
    };
    
    await this.cache.set(key, partial);
  }
  
  async getWithGeometry(key: string, file: File): Promise<GcodeStats | null> {
    const partial = await this.cache.get(key);
    if (!partial) return null;
    
    // Regenerate geometry if needed
    const stats = this.reconstructStats(partial);
    if (needsGeometry) {
      stats.geometry = await this.generateGeometry(file);
    }
    
    return stats;
  }
}
```

### Expected Impact
- Bounded memory usage (configurable limit)
- 60-80% storage reduction with compression
- Faster cache operations
- Ability to cache more files

## 8. UI Rendering Optimizations

### Current Issues
- Frequent progress bar updates cause reflows
- Layout thrashing during result display
- Large DOM updates block main thread
- No virtualization for long lists

### Optimizations

#### 8.1 Debounced Progress Updates
```typescript
class DebouncedProgress {
  private lastUpdate = 0;
  private pendingUpdate: number | null = null;
  private rafId: number | null = null;
  
  updateProgress(progress: number, message: string) {
    const now = Date.now();
    
    // Limit updates to 60fps
    if (now - this.lastUpdate < 16) {
      this.pendingUpdate = progress;
      
      if (!this.rafId) {
        this.rafId = requestAnimationFrame(() => {
          this.rafId = null;
          if (this.pendingUpdate !== null) {
            this.applyProgress(this.pendingUpdate, message);
            this.pendingUpdate = null;
          }
        });
      }
      return;
    }
    
    this.applyProgress(progress, message);
    this.lastUpdate = now;
  }
  
  private applyProgress(progress: number, message: string) {
    // Use transform for smooth animation
    this.progressBar.style.transform = `scaleX(${progress / 100})`;
    this.messageEl.textContent = message;
  }
}
```

#### 8.2 Batch DOM Updates
```typescript
class BatchedDOMUpdater {
  private updates: Array<() => void> = [];
  private scheduled = false;
  
  addUpdate(fn: () => void) {
    this.updates.push(fn);
    
    if (!this.scheduled) {
      this.scheduled = true;
      requestAnimationFrame(() => {
        this.flush();
      });
    }
  }
  
  private flush() {
    const fragment = document.createDocumentFragment();
    
    // Batch all updates
    this.updates.forEach(update => update());
    
    // Single DOM update
    document.getElementById('results')!.appendChild(fragment);
    
    this.updates = [];
    this.scheduled = false;
  }
}
```

#### 8.3 Virtual Scrolling
```typescript
class VirtualList {
  private itemHeight = 40;
  private visibleCount = 20;
  private items: any[] = [];
  private container: HTMLElement;
  private scrollTop = 0;
  
  render(items: any[]) {
    this.items = items;
    const totalHeight = items.length * this.itemHeight;
    
    // Set container height
    this.container.style.height = `${totalHeight}px`;
    
    // Calculate visible range
    const startIndex = Math.floor(this.scrollTop / this.itemHeight);
    const endIndex = Math.min(
      startIndex + this.visibleCount,
      items.length
    );
    
    // Render only visible items
    this.renderRange(startIndex, endIndex);
  }
  
  private renderRange(start: number, end: number) {
    const fragment = document.createDocumentFragment();
    
    for (let i = start; i < end; i++) {
      const item = this.createItemElement(this.items[i]);
      item.style.transform = `translateY(${i * this.itemHeight}px)`;
      fragment.appendChild(item);
    }
    
    this.container.innerHTML = '';
    this.container.appendChild(fragment);
  }
}
```

### Expected Impact
- 90% reduction in layout reflows
- Smooth 60fps progress updates
- Instant rendering of large result sets
- Reduced main thread blocking

## Implementation Priority

1. **High Priority** (Immediate impact, low risk)
   - String operations optimization
   - Web Worker threshold adjustment
   - Debounced UI updates
   - Pre-compiled regex patterns

2. **Medium Priority** (Significant impact, moderate effort)
   - Memory management improvements
   - Geometry optimization (fixed segments)
   - LRU cache implementation
   - Color assignment optimization

3. **Low Priority** (Nice to have, higher complexity)
   - SharedArrayBuffer support
   - Instanced rendering
   - Virtual scrolling
   - Compression support

## Measuring Success

- **Parsing Speed**: Target 50% improvement for files >10MB
- **Memory Usage**: Target 40% reduction in peak memory
- **UI Responsiveness**: Maintain 60fps during all operations
- **Cache Hit Rate**: Target 80% for repeated files
- **Worker Utilization**: Use worker for 90% of files >1MB

## Testing Strategy

1. Create benchmark suite with various file sizes
2. Profile before and after each optimization
3. Test on low-end devices (4GB RAM, older CPUs)
4. Verify no regression in functionality
5. Monitor real-world performance metrics