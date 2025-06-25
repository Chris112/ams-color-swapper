# Factory Floor 3D Visualization Architecture

## Overview

The Factory Floor is a comprehensive 3D visualization system that transforms G-code files into interactive 3D models that build layer-by-layer in a virtual factory environment. This system provides real-time visualization of 3D printing processes with proper scaling, coordinate systems, and user controls.

## Core Components

### 1. FactoryFloorScene (`src/ui/components/factory/FactoryFloorScene.ts`)

The main Three.js scene manager that handles 3D rendering and visualization.

**Key Features:**
- **Proper Coordinate System**: Converts G-code coordinates (X/Y/Z) to Three.js coordinates (X/Z/Y) where Y is vertical
- **Auto-Camera Positioning**: Automatically positions camera based on model bounding box
- **Interactive Controls**: OrbitControls with safety limits to prevent camera jumping
- **Factory Environment**: Scaled floor grid, lighting, and atmospheric effects

**Camera Controls:**
```typescript
// Restricted movement to keep model visible
minDistance: 2, maxDistance: 50
maxPolarAngle: π/2.2 (don't go below ground)
minPolarAngle: π/6 (don't go too high)
minAzimuthAngle: -π/2, maxAzimuthAngle: π/2 (±90° rotation)

// Reduced sensitivity for smooth movement
rotateSpeed: 0.5, zoomSpeed: 0.8, panSpeed: 0.3
enablePan: false // Prevents camera target jumping
```

**Smart Click Detection:**
- Distinguishes between camera rotation (drag) and print selection (click)
- Only treats mouse actions as clicks if: `time < 200ms && movement < 5px`

### 2. GcodeToGeometryConverter (`src/parser/gcodeToGeometry.ts`)

Converts G-code files into Three.js 3D geometry with proper scaling and filtering.

**Coordinate System Mapping:**
```typescript
// G-code to Three.js coordinate conversion
G-code X (left/right) → Three.js X (left/right)
G-code Y (front/back) → Three.js Z (front/back)  
G-code Z (up/down)    → Three.js Y (up/down)

// Scale factor converts mm to appropriate Three.js units
SCALE_FACTOR = 0.1 // 220mm print bed → 22 Three.js units
```

**Key Features:**
- **Travel Line Filtering**: Only renders actual extrusion moves, not travel moves
- **Enhanced Layer Detection**: Multiple G-code comment patterns + Z-height fallback
- **3D Filament Representation**: Uses TubeGeometry instead of LineSegments for realistic 3D appearance
- **Layer Redistribution**: Handles cases where layer detection fails

**Extrusion Detection:**
```typescript
// Only G1 moves with positive E values are considered extrusion
extruding = gCode === 1 && eValue > 0;

// Travel moves (G0 or G1 without E+) are filtered out
if (!path.extruding) return; // Skip travel paths
```

### 3. PrintBuilder (`src/ui/components/factory/PrintBuilder.ts`)

Manages layer-by-layer animation and print building simulation.

**Animation System:**
- **Real-time Progress**: Calculates progress as `(currentLayer + 1) / totalLayers`
- **Configurable Speed**: Layers per second (0.1 to 20 range)
- **State Management**: IDLE → BUILDING → PAUSED/COMPLETE states

**Layer Indicator (Disabled by Default):**
- Calculates actual layer height from geometry bounding box
- Positions indicator at real geometry positions, not estimated heights
- Made subtle and non-intrusive when enabled

### 4. FactoryFloorService (`src/services/FactoryFloorService.ts`)

High-level service managing multiple prints and factory operations.

**Features:**
- **Multi-Print Management**: Handle multiple concurrent 3D prints
- **Persistent Storage**: IndexedDB integration (replaces localStorage to avoid quota issues)
- **Auto-Building**: Configurable auto-start with concurrency limits
- **Event-Driven Architecture**: Real-time updates and progress tracking

**Configuration:**
```typescript
interface FactoryFloorConfig {
  autoStartBuilding: boolean;      // Auto-start new prints
  maxConcurrentBuilds: number;     // Limit concurrent animations
  buildSpeed: number;              // Animation speed (layers/sec)
  persistData: boolean;            // IndexedDB persistence
  enableAnimations: boolean;       // Animation toggle
}
```

### 5. FactoryFloorRepository (`src/repositories/FactoryFloorRepository.ts`)

IndexedDB-based persistence layer for factory floor data.

**Why IndexedDB over localStorage:**
- **No Quota Limits**: Handles large G-code files without "quota exceeded" errors
- **Asynchronous**: Non-blocking operations
- **Structured Storage**: Better for complex print metadata

## Architecture Decisions

### Coordinate System Choice

**Problem**: G-code uses Z as vertical axis, Three.js uses Y as vertical axis.

**Solution**: Explicit coordinate mapping during geometry conversion:
```typescript
newPosition.x = gcode_X * SCALE_FACTOR;  // X stays X
newPosition.z = gcode_Y * SCALE_FACTOR;  // Y becomes Z (depth)
newPosition.y = gcode_Z * SCALE_FACTOR;  // Z becomes Y (height)
```

### Scaling Strategy

**Problem**: G-code coordinates are in millimeters (0-220mm), which creates tiny geometry in Three.js.

**Solution**: Apply 0.1 scale factor consistently across all components:
- Geometry coordinates: `position * 0.1`
- Camera distances: scaled to match
- Floor grid: scaled to match print dimensions
- Lighting: scaled shadow maps and distances

### Travel Line Filtering

**Problem**: Raw G-code includes both extrusion moves and travel moves, making the model hard to see.

**Solution**: Strict extrusion detection:
- Only G1 commands with positive E values are rendered
- G0 (rapid positioning) and G1 without extrusion are filtered out
- Results in clean visualization showing only actual printed material

### Layer Detection Strategy

**Problem**: Different slicers use different layer comment formats.

**Solution**: Multi-strategy approach:
1. **Primary**: Parse layer comments with multiple regex patterns
2. **Fallback**: Z-height change detection (0.1mm+ scaled threshold)
3. **Redistribution**: If detection fails, distribute geometry across expected layer count

### Camera Control Philosophy

**Problem**: Users accidentally clicking and dragging should rotate camera, not jump to random positions.

**Solution**: 
- Disable panning to prevent target changes
- Smart click detection (time + distance thresholds)
- Constrained rotation ranges
- Reduced sensitivity for smooth movement
- Safety checks for extreme positions

## Performance Optimizations

### Geometry Processing
- **Async Processing**: Non-blocking G-code conversion using setTimeout
- **Geometry Merging**: Combine multiple paths into single BufferGeometry
- **Memory Management**: Dispose geometries and materials properly
- **Event Batching**: Batch progress updates to reduce UI thrashing

### Rendering
- **Shadow Maps**: Optimized shadow map sizes (2048x2048)
- **Material Optimization**: Use MeshLambertMaterial for good performance/quality balance
- **Culling**: Three.js handles frustum culling automatically
- **Level of Detail**: TubeGeometry with reduced radial segments for performance

## Integration Points

### With Main Application
```typescript
// App.ts integration
const factoryScene = new FactoryFloorScene(container);
const factoryService = new FactoryFloorService(factoryScene);

// Add current G-code file to factory
await factoryService.addPrint(filename, gcodeContent, stats);
```

### With Existing Parser
```typescript
// Reuses existing GcodeStats from main parser
interface GcodeStats {
  totalLayers: number;
  colors: ColorInfo[];
  printTime?: string;
  filamentUsage?: FilamentUsage;
  rawContent: string; // G-code content
}
```

### Event System
```typescript
// Factory floor events
factoryService.on('printAdded', (printId) => { /* ... */ });
factoryService.on('buildingStarted', (printId) => { /* ... */ });
factoryService.on('buildingCompleted', (printId) => { /* ... */ });
```

## Common Issues and Solutions

### Issue: Camera Jumping on Click
**Cause**: OrbitControls interpreting clicks as "look at" commands
**Solution**: Smart click detection + disabled panning

### Issue: Model Appears Sideways
**Cause**: G-code Z-axis vs Three.js Y-axis mismatch
**Solution**: Explicit coordinate system mapping

### Issue: Model Too Small/Large
**Cause**: Direct mm coordinates in Three.js
**Solution**: Consistent 0.1 scale factor across all systems

### Issue: Travel Lines Cluttering View
**Cause**: Rendering both extrusion and travel moves
**Solution**: Strict extrusion detection (G1 + positive E only)

### Issue: Layer Detection Fails
**Cause**: Inconsistent slicer comment formats
**Solution**: Multi-strategy detection with Z-height fallback

### Issue: localStorage Quota Exceeded
**Cause**: Large G-code files exceed localStorage limits
**Solution**: IndexedDB with unlimited storage

## Future Enhancements

### Planned Features
- **Print Queue Visualization**: Show queued prints as ghosted models
- **Multi-Color Animation**: Animate tool changes with color transitions
- **Print Collision Detection**: Prevent overlapping prints on factory floor
- **Temperature Visualization**: Heat map showing print bed temperatures
- **Print Statistics Overlay**: Real-time statistics display

### Performance Improvements
- **Web Workers**: Move G-code parsing to background thread
- **Instanced Rendering**: For multiple similar prints
- **Progressive Loading**: Stream large files instead of loading entirely
- **Viewport Culling**: Only animate visible prints

### User Experience
- **VR Support**: WebXR integration for immersive viewing
- **Print Profiles**: Save/load factory floor configurations
- **Export Capabilities**: Export factory floor as image/video
- **Accessibility**: Keyboard navigation and screen reader support

## Development Guidelines

### Adding New Features
1. Follow the event-driven architecture pattern
2. Use TypeScript interfaces for all data structures
3. Add comprehensive error handling and logging
4. Include disposal methods for memory management
5. Test with various G-code file formats

### Testing Strategy
- **Unit Tests**: Individual component functionality
- **Integration Tests**: Cross-component interactions  
- **Performance Tests**: Large file handling
- **Visual Regression Tests**: Screenshot comparisons
- **Browser Compatibility**: WebGL feature detection

### Code Organization
- Keep Three.js logic in scene components
- Business logic in service layer
- Data persistence in repository layer
- UI interactions in component event handlers
- Shared types in dedicated type files