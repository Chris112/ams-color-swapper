# G-code Color Mapping Tool - Implementation Plan

## Project Overview

Build a TypeScript/Node.js web application that analyzes multi-color G-code files from OrcaSlicer and optimizes AMS (Automatic Material System) slot assignments to minimize manual filament swaps during 3D printing.

## Key Features

### 1. G-code Analysis with Detailed Statistics

- Parse multi-color G-code with tool changes
- Extract color/filament information from OrcaSlicer metadata
- Map colors to layer ranges
- Output comprehensive statistics:
  - Total layers in the print
  - Color count and names/identifiers
  - Layer ranges per color (start/end layers)
  - Tool change count and locations
  - Estimated print time per color (if available in G-code)
  - Filament usage per color (length/weight if available)
  - Color overlap analysis (which colors never print simultaneously)

### 2. AMS Optimization Algorithm

- For ≤4 colors: Direct 1:1 mapping to AMS slots
- For >4 colors: Smart slot sharing recommendations
- Calculate optimal pause layers for manual swaps
- Minimize user intervention and print interruptions
- Consider print order and color frequency

### 3. Debug & Transparency Features

- Raw G-code preview with syntax highlighting
- Tool change visualization timeline
- Debug console showing parser decisions
- Export analysis report as JSON/CSV
- Visual layer-by-layer color map
- Parser warnings and error handling

## Technical Implementation

### G-code Parser Output Statistics

```typescript
interface GcodeStats {
  // File metadata
  fileName: string;
  fileSize: number;
  slicerInfo?: {
    software: string;
    version: string;
    profile?: string;
  };

  // Print statistics
  totalLayers: number;
  totalHeight: number;
  estimatedPrintTime?: number;

  // Color information
  colors: ColorInfo[];
  toolChanges: ToolChange[];
  layerColorMap: Map<number, string>;
  colorUsageRanges: ColorRange[];

  // Filament data
  filamentEstimates?: FilamentUsage[];

  // Debug info
  parserWarnings: string[];
  parseTime: number;
}

interface ColorInfo {
  id: string; // T0, T1, etc.
  name?: string; // User-defined color name
  hexColor?: string; // Color code if available
  firstLayer: number;
  lastLayer: number;
  layerCount: number;
  usagePercentage: number;
}

interface ColorRange {
  colorId: string;
  startLayer: number;
  endLayer: number;
  continuous: boolean; // If color is used continuously in this range
}

interface ToolChange {
  fromTool: string;
  toTool: string;
  layer: number;
  lineNumber: number;
}
```

### Color Analysis Report Features

- Interactive color usage timeline graph
- Overlap matrix showing which colors can share slots
- Optimization recommendations with detailed rationale
- Step-by-step manual swap instructions with exact layer numbers
- Estimated time savings vs. no optimization

### Debug Console Features

- Real-time parsing progress indicator
- Tool change detection logs with line numbers
- Color assignment decision explanations
- Performance metrics (parse time, lines processed per second)
- Warning/error highlighting for problematic G-code

## File Structure

```
gcoder/
├── APP_PLAN.md              # This planning document
├── package.json             # Node.js dependencies
├── tsconfig.json            # TypeScript configuration
├── .gitignore              # Git ignore file
├── src/
│   ├── server.ts           # Express server setup
│   ├── routes/
│   │   ├── upload.ts       # File upload handling
│   │   └── analyze.ts      # Analysis API endpoints
│   ├── parser/
│   │   ├── gcodeParser.ts  # Main G-code parsing logic
│   │   ├── statistics.ts   # Statistics calculation
│   │   └── colorExtractor.ts # Color/tool change detection
│   ├── optimizer/
│   │   ├── colorOptimizer.ts # Slot optimization algorithm
│   │   └── swapCalculator.ts # Manual swap point calculation
│   ├── debug/
│   │   ├── logger.ts       # Debug logging system
│   │   └── reporter.ts     # Report generation
│   └── types/
│       └── index.ts        # TypeScript type definitions
├── public/
│   ├── index.html          # Main web interface
│   ├── style.css           # Styling
│   ├── js/
│   │   ├── app.js          # Main frontend logic
│   │   ├── upload.js       # File upload handling
│   │   ├── visualizer.js   # Timeline visualization
│   │   └── debug.js        # Debug panel functionality
│   └── assets/
│       └── icons/          # UI icons
└── README.md               # User documentation
```

## User Interface Components

### 1. Main Dashboard

- **Upload Area**: Drag-and-drop zone for G-code files
- **Analysis Progress**: Real-time progress bar with status messages
- **Quick Stats**: Summary cards showing key metrics
- **Recent Files**: History of analyzed files (localStorage)

### 2. Statistics Panel

- **File Information**
  - Filename, size, upload time
  - Detected slicer and version
  - Print profile (if available)
- **Print Statistics**
  - Total layers and height
  - Estimated print time
  - Total tool changes
- **Color Usage Table**
  - Color ID/name
  - Layer range (start-end)
  - Usage percentage
  - Continuous/intermittent indicator
- **Visual Timeline**
  - Interactive layer-based color chart
  - Zoom and pan functionality
  - Tool change markers

### 3. Optimization Panel

- **AMS Slot Assignment**
  - Drag-and-drop color to slot interface
  - Auto-assign button with algorithm selection
  - Conflict warnings for overlapping colors
- **Swap Recommendations**
  - Card-based swap instructions
  - Layer number and estimated Z-height
  - Time until swap needed
  - Color preview
- **Export Options**
  - Download instructions as PDF/TXT
  - Export AMS configuration file
  - Share optimization via link

### 4. Debug Panel (Collapsible)

- **Parser Log Viewer**
  - Scrollable log with timestamps
  - Filter by log level (info/warn/error)
  - Search functionality
- **Raw G-code Viewer**
  - Syntax highlighting
  - Jump to tool change lines
  - Line numbers
- **Performance Metrics**
  - Parse time and speed
  - Memory usage
  - File complexity score
- **Export Debug Data**
  - Full analysis JSON
  - Parser log file
  - Bug report generator

## Implementation Steps

1. **Project Setup** (Day 1)
   - Initialize npm project with TypeScript
   - Configure Express server
   - Set up development environment
   - Create basic file structure

2. **G-code Parser** (Days 2-3)
   - Implement line-by-line parser
   - Add tool change detection
   - Extract layer information
   - Build statistics collector

3. **Debug System** (Day 4)
   - Create logging framework
   - Add performance monitoring
   - Implement error handling

4. **Optimization Algorithm** (Days 5-6)
   - Develop slot assignment logic
   - Calculate swap points
   - Generate recommendations

5. **Web Interface** (Days 7-8)
   - Build upload interface
   - Create statistics display
   - Add visualization components

6. **Integration & Testing** (Day 9)
   - Connect frontend to backend
   - Test with sample G-code files
   - Fix bugs and optimize

7. **Polish & Documentation** (Day 10)
   - Improve UI/UX
   - Write user documentation
   - Add example files

## Future Enhancements

- Support for other slicers (PrusaSlicer, Cura)
- Cloud storage for analysis history
- Community sharing of optimizations
- Mobile app version
- Integration with OctoPrint/Klipper
- Machine learning for optimization improvements

## Success Metrics

- Parse 100MB G-code file in <5 seconds
- Reduce manual swaps by >50% for 6+ color prints
- Clear visual representation of color usage
- Export instructions in <1 second
- 95% accuracy in swap recommendations
