# Factory Floor 3D Visualization - User Guide

## Overview

The Factory Floor is a 3D visualization feature that transforms your G-code files into interactive 3D models. Watch your prints build layer-by-layer in a virtual factory environment with realistic scaling and smooth animations.

## Getting Started

### Accessing the Factory Floor

1. **Upload a G-code file** to the main analyzer
2. **Click the "Factory Floor" tab** to switch to 3D view
3. **Your model automatically loads** and positions in the factory
4. **Click the play button** to start the layer-by-layer building animation

### Basic Navigation

**Camera Controls:**

- **Left Click + Drag**: Rotate camera around the model
- **Scroll Wheel**: Zoom in and out
- **Model stays centered** - camera won't jump to random positions

**View Controls:**

- **"Analysis" tab**: Return to the 2D analysis view
- **Reset Camera**: Button to return to default viewing angle
- **Auto-Focus**: Camera automatically centers on your first print

## What You'll See

### The 3D Model

- **Realistic 3D Filament**: Your print appears as actual 3D tube geometry, not just lines
- **Correct Orientation**: Models appear right-side up (G-code Z-axis becomes vertical)
- **Proper Scale**: 220mm print bed scales to realistic proportions
- **Color Accurate**: Multi-color prints show correct filament colors

### Only Actual Printing

- **Extrusion Only**: Only shows actual printed material
- **No Travel Lines**: Clutter-free view without travel moves
- **Clean Visualization**: Easy to see the actual model shape

### Factory Environment

- **Grid Floor**: Scaled factory floor grid
- **Professional Lighting**: Directional and ambient lighting for clear visibility
- **Atmospheric Effects**: Subtle fog effects for depth perception

## Animation Features

### Layer-by-Layer Building

- **Real-time Progress**: Watch layers appear in real-time
- **Smooth Animation**: Configurable speed (0.1 to 20 layers per second)
- **Progress Tracking**: See current layer and total progress percentage

### Animation Controls

- **Play/Pause**: Start and stop the building animation
- **Speed Control**: Adjust animation speed
- **Layer Jumping**: Skip to specific layers (when implemented)
- **Reset**: Return to empty build plate

## Multi-Print Factory

### Adding Multiple Models

- Upload different G-code files to add multiple prints to the factory floor
- Models automatically position on available floor space
- Each print can build independently

### Print Management

- **Click prints** to select and focus camera
- **Individual controls** for each print's animation
- **Queue system** for automatic sequential building

## Technical Features

### Coordinate System

- **Proper 3D Mapping**: G-code coordinates correctly mapped to 3D space
- **Scale Conversion**: Millimeter coordinates scaled for optimal viewing
- **Bounding Box Calculation**: Automatic model sizing and camera positioning

### Performance Optimizations

- **Efficient Rendering**: Optimized Three.js geometry for smooth performance
- **Memory Management**: Automatic cleanup of unused resources
- **Progressive Loading**: Large files load without blocking the interface

### Data Persistence

- **Session Storage**: Factory floor state saved using IndexedDB
- **No Storage Limits**: Handles large G-code files without quota issues
- **Automatic Recovery**: Restore factory state on page reload

## Troubleshooting

### Common Issues

**Model Appears Too Small/Large:**

- This is automatically handled by the scaling system
- Camera auto-positions based on model size
- Use scroll wheel to zoom if needed

**Model Not Building:**

- Check that the G-code file contains extrusion moves (E+ values)
- Some test files may only contain travel moves
- Try with a real slicer-generated G-code file

**Camera Jumping Around:**

- Updated controls prevent this issue
- Use left-click + drag for rotation
- Avoid quick clicks unless selecting prints

**Model Appears Sideways:**

- Fixed in current version with proper coordinate mapping
- G-code Z-axis correctly becomes vertical in 3D view

**Animation Not Starting:**

- Ensure layer detection succeeded (check console for layer count)
- Some G-code files may have non-standard layer comments
- Try files from popular slicers (PrusaSlicer, Cura, OrcaSlicer)

### Performance Tips

**For Large Files:**

- Visualization may take a moment to process large G-code files
- Complex models with many layers will animate more slowly
- Consider reducing animation speed for very detailed prints

**For Better Performance:**

- Close other browser tabs using GPU resources
- Use hardware-accelerated browsers (Chrome, Firefox, Edge)
- Ensure WebGL is enabled in browser settings

## Browser Compatibility

### Supported Browsers

- **Chrome 60+** (Recommended)
- **Firefox 55+**
- **Safari 12+** (macOS/iOS)
- **Edge 79+**

### Required Features

- **WebGL 2.0**: For 3D rendering
- **IndexedDB**: For data persistence
- **ES6 Modules**: For code loading

### Mobile Support

- Factory Floor works on tablets and phones
- Touch controls for camera rotation
- May have reduced performance on older devices

## Tips for Best Experience

### G-code File Preparation

- **Use Modern Slicers**: PrusaSlicer, Cura, OrcaSlicer generate compatible files
- **Include Layer Comments**: Helps with layer detection
- **Multi-color Prints**: Show best results with distinct colors

### Viewing Tips

- **Start with Simple Models**: Test with basic shapes first
- **Use Default Speed**: 2 layers per second provides good balance
- **Let Models Load**: Wait for initial processing before starting animation

### Performance Optimization

- **Close Unused Tabs**: Free up GPU resources
- **Update Browser**: Latest versions have better WebGL support
- **Check Hardware Acceleration**: Ensure GPU acceleration is enabled

## Keyboard Shortcuts (Planned)

- **Space**: Play/Pause animation
- **R**: Reset camera view
- **1-9**: Set animation speed
- **Left/Right Arrows**: Step through layers manually
- **Escape**: Return to analysis view

## API Integration (For Developers)

### Basic Usage

```typescript
// Create factory floor
const scene = new FactoryFloorScene(containerElement);
const factory = new FactoryFloorService(scene);

// Add print
await factory.addPrint(filename, gcodeContent, stats);

// Control animation
factory.startBuilding(printId);
factory.pauseBuilding(printId);
```

### Event Handling

```typescript
factory.on('printAdded', (printId) => {
  console.log('Print added:', printId);
});

factory.on('buildingCompleted', (printId) => {
  console.log('Build complete:', printId);
});
```

## Future Features

### Planned Enhancements

- **Print Queue Visualization**: See upcoming prints as ghost models
- **Temperature Mapping**: Visualize heat distribution
- **Tool Change Animation**: Animate multi-material transitions
- **Export Capabilities**: Save factory floor as images or videos
- **VR Support**: View factory floor in virtual reality

### User Requests

- **Manual Layer Control**: Scrub through layers manually
- **Print Statistics Overlay**: Real-time print statistics
- **Collision Detection**: Prevent overlapping prints
- **Custom Floor Layouts**: Arrange multiple print beds

## Getting Help

### Documentation

- **Architecture Guide**: `/docs/factory-floor-architecture.md`
- **API Reference**: Generated TypeScript documentation
- **Code Examples**: Sample implementations in repository

### Reporting Issues

- **Browser Console**: Check for error messages
- **Screenshot Issues**: Visual problems with specific models
- **Performance Problems**: Note file size and browser details
- **Feature Requests**: Suggest improvements and new features

### Community Support

- **GitHub Issues**: Report bugs and request features
- **Discussions**: Share tips and showcase results
- **Contributing**: Help improve the factory floor system
