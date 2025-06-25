# 3D Volumetric Hologram Visualization System

## Overview

The AMS Color Swapper includes a sophisticated 3D volumetric hologram visualization system that renders G-code files as interactive 3D models. This system provides real-time visualization of multi-color 3D prints with proper filament color separation and travel move filtering.

## Architecture

### Core Components

#### 1. VolumetricHologram Component (`src/ui/components/VolumetricHologram.ts`)

The main visualization component that orchestrates the entire 3D rendering pipeline.

**Key Features:**

- Three.js-based 3D rendering
- Real-time G-code geometry parsing
- Multi-color filament visualization
- Interactive camera controls
- Travel move filtering
- Layer-by-layer animation support

**Dependencies:**

- Three.js for 3D rendering
- Custom G-code geometry converter
- Interaction controllers for user input
- Material system for realistic filament rendering

#### 2. G-code to Geometry Converter (`src/parser/gcodeToGeometry.ts`)

Converts raw G-code commands into Three.js geometry objects.

**Key Features:**

- Parses G-code movement commands (G0/G1)
- Separates extrusion moves from travel moves
- Tool change detection (T0, T1, T2, etc.)
- Layer detection and organization
- Coordinate system mapping (G-code → Three.js)
- Scaling and positioning optimization

**Output:**

- `PrintGeometry` object containing:
  - Geometry layers organized by tool/color
  - Bounding box information
  - Center offset for positioning
  - Color mapping for each tool
  - Total layer count

#### 3. Supporting Systems

**VoxelDataStructure** (`src/ui/components/volumetric/VoxelDataStructure.ts`)

- Converts G-code data into volumetric voxel representation
- Handles density calculations and color mapping
- Provides data for UI controls and layer information

**InteractionController** (`src/ui/components/volumetric/InteractionController.ts`)

- Orbit controls for camera manipulation
- Layer scrubbing functionality
- View mode switching (X-ray, exploded views)
- Play/pause animation controls

## Technical Implementation

### G-code Processing Pipeline

1. **Raw G-code Input**
   - File content read as string
   - Stored in `GcodeStats.rawContent`

2. **Line-by-Line Parsing**

   ```typescript
   // Example G-code commands processed:
   G1 X10.5 Y20.3 Z0.2 E1.5  // Extrusion move
   G0 X50 Y50                 // Travel move (no E parameter)
   T1                         // Tool change to tool 1
   ```

3. **Movement Classification**
   - **Extrusion Moves**: G1 commands with positive E values
   - **Travel Moves**: G0 commands or G1 without E parameter
   - **Tool Changes**: T commands (T0, T1, T2, T3)

4. **Coordinate System Mapping**

   ```typescript
   // G-code → Three.js coordinate mapping:
   // G-code X (left/right) → Three.js X
   // G-code Y (front/back) → Three.js Z
   // G-code Z (up/down) → Three.js Y
   ```

5. **Geometry Generation**
   - Creates `TubeGeometry` for realistic filament representation
   - Groups geometry by tool/color
   - Applies appropriate materials with color and lighting

### Multi-Color Rendering

The system supports visualization of multi-color prints by:

1. **Tool Detection**: Identifies tool changes in G-code
2. **Color Mapping**: Maps tools to colors from slicer analysis
3. **Geometry Separation**: Creates separate geometry objects per tool
4. **Material Assignment**: Applies distinct colors and materials

**Color Sources:**

- Primary: Colors detected from slicer comments
- Fallback: Default color palette for tools
- User: Custom color overrides (future enhancement)

### Travel Move Filtering

The system implements sophisticated filtering to remove non-printing movements:

**Object-Level Filtering:**

- Analyzes entire geometry objects for travel move characteristics
- Considers average segment length, maximum distances, Z variation
- Removes objects that are primarily travel moves

**Segment-Level Filtering:**

- Filters individual line segments within mixed-content objects
- Removes segments with excessive length or Z jumps
- Preserves actual printing paths

**Filter Criteria:**

```typescript
// Examples of filtered movements:
- Segments longer than 50mm (rapid travel)
- Z jumps greater than 2mm (layer changes)
- Movements to build plate edges
- Diagonal movements across large distances
```

### Performance Optimizations

1. **Geometry Scaling**: Coordinates scaled by factor (0.1) for optimal Three.js performance
2. **Level of Detail**: Tube geometry with optimized segment counts
3. **Memory Management**: Proper disposal of geometries and materials
4. **Caching**: Parsed geometry can be cached for repeated visualization

## User Interface

### Interactive Controls

1. **Camera Controls**
   - Orbit: Click and drag to rotate view
   - Zoom: Mouse wheel to zoom in/out
   - Pan: Right-click and drag to pan

2. **Layer Controls**
   - Layer slider: Scrub through print layers
   - Play/Pause: Animate layer-by-layer printing
   - Speed control: Adjust animation speed

3. **View Modes**
   - Normal: Standard view with all colors
   - X-Ray: Transparent materials for internal inspection
   - Exploded: Separated layers for detailed analysis

### Visual Feedback

1. **Loading States**: Progress indicators during G-code processing
2. **Error Handling**: Clear error messages for parsing failures
3. **Statistics Display**: Print dimensions, layer count, color information

## Integration Points

### With Parser System

- Receives `GcodeStats` object with parsed print information
- Accesses `rawContent` for detailed geometry generation
- Uses color analysis and tool change data

### With Caching System

- Geometry can be cached alongside parsed statistics
- Improves load times for repeated visualization
- Handles cache invalidation on file changes

### With Export System

- Rendered views can be exported as images
- 3D models can potentially be exported (future enhancement)
- Print statistics integrated with visualization

## Configuration Options

### Rendering Settings

```typescript
interface HologramConfig {
  resolution: THREE.Vector3; // Voxel resolution for effects
  voxelSize: number; // Size of individual voxels
  particleCount: number; // Ambient particle count
  enableEffects: boolean; // Holographic visual effects
  showScanlines: boolean; // Retro scanline effects
  showParticles: boolean; // Ambient particles
}
```

### Material Properties

- Line width and opacity for filament paths
- Emissive colors for realistic glow effects
- Transparency for X-ray and exploded views

## Future Enhancements

### Planned Features

1. **Print Time Visualization**: Show time-based progression
2. **Temperature Mapping**: Color-code by printing temperature
3. **Support Material**: Distinguish support from model material
4. **Print Speed Visualization**: Vary rendering based on print speeds
5. **Quality Analysis**: Highlight potential print quality issues

### Technical Improvements

1. **WebWorker Integration**: Move geometry processing to background
2. **Streaming Processing**: Handle very large files incrementally
3. **LOD System**: Adaptive level of detail based on view distance
4. **VR/AR Support**: Immersive 3D print inspection

## Troubleshooting

### Common Issues

1. **Empty Visualization**
   - Check if G-code contains extrusion moves (E parameters)
   - Verify tool change detection is working
   - Review filter criteria (may be too aggressive)

2. **Performance Issues**
   - Large files may require geometry optimization
   - Consider reducing tube geometry complexity
   - Enable caching for repeated loads

3. **Color Problems**
   - Verify slicer includes color definitions in comments
   - Check tool change commands are present
   - Review color mapping logic

### Debug Information

The system provides extensive console logging for troubleshooting:

- G-code parsing progress
- Geometry generation statistics
- Filter operation results
- Rendering performance metrics

## API Reference

### Main Classes

**VolumetricHologram**

```typescript
constructor(
  selector: string,
  stats: GcodeStats,
  config?: Partial<HologramConfig>,
  events?: Partial<HologramEvents>
)
```

**GcodeToGeometryConverter**

```typescript
convertGcodeToGeometry(
  gcodeContent: string,
  stats: GcodeStats
): PrintGeometry

static createPreviewMesh(geometry: PrintGeometry): THREE.Group
```

### Key Interfaces

**PrintGeometry**

```typescript
interface PrintGeometry {
  layers: GeometryLayer[];
  boundingBox: THREE.Box3;
  centerOffset: THREE.Vector3;
  totalLayers: number;
  colors: Map<number, string>;
}
```

**GeometryLayer**

```typescript
interface GeometryLayer {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  layer: number;
  toolIndex: number;
  color: string;
}
```

This visualization system represents a significant advancement in G-code analysis tools, providing unprecedented insight into multi-color 3D printing processes through interactive 3D visualization.
