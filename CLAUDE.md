# CLAUDE.md - G-code Color Mapper Development Guide

## Project Overview
G-code Color Mapper is a TypeScript/Node.js web application that analyzes multi-color G-code files from OrcaSlicer and optimizes AMS (Automatic Material System) slot assignments to minimize manual filament swaps during 3D printing.

## Key Commands

### Development
```bash
npm install        # Install dependencies
npm run dev       # Start development server with hot reload (tsx watch)
npm run build     # Build TypeScript to JavaScript
npm start         # Run production server
npm test          # Run tests (not yet implemented)
```

### Server Details
- Development: Uses `tsx watch src/server.ts` for hot reload
- Production: Compiles to `dist/` and runs `node dist/server.js`
- Default port: 3000 (http://localhost:3000)

## Technical Architecture

### Technology Stack
- **Backend**: Node.js with Express 5.1.0, TypeScript
- **Parser**: Uses gcode-parser library for base parsing
- **File Upload**: Multer for handling file uploads
- **Development**: tsx for TypeScript execution, nodemon available

### TypeScript Configuration
- Target: ES2020
- Module: CommonJS
- Strict mode enabled
- Source maps and declarations enabled
- Root: `./src`, Output: `./dist`

### Project Structure
```
src/
├── server.ts           # Express server setup
├── routes/
│   ├── upload.ts       # File upload handling
│   └── analyze.ts      # Analysis API endpoints
├── parser/
│   ├── gcodeParser.ts  # Main G-code parsing logic
│   ├── enhancedGcodeParser.ts  # Enhanced parser implementation
│   ├── statistics.ts   # Statistics calculation
│   └── colorExtractor.ts # Color/tool change detection
├── optimizer/
│   └── colorOptimizer.ts # Slot optimization algorithm
├── debug/
│   └── logger.ts       # Debug logging system
└── types/
    └── index.ts        # TypeScript type definitions
```

## API Endpoints
- `POST /api/upload` - Upload G-code file (max 200MB)
- `POST /api/analyze/:fileId` - Analyze uploaded file
- `GET /api/health` - Health check

## Important Technical Constraints

### File Handling
- Maximum upload size: 200MB
- Supported formats: .gcode, .gco, .g
- Files stored temporarily in `uploads/` directory

### Performance Requirements
- Parse 100MB G-code file in <5 seconds
- Export instructions in <1 second
- Real-time parsing progress indicators

### Color Optimization Logic
- **≤4 colors**: Direct 1:1 mapping to AMS slots
- **>4 colors**: Smart slot sharing based on:
  - Non-overlapping layer ranges
  - Optimal pause points for manual swaps
  - Minimum user intervention

## Key Features to Implement

### G-code Analysis Output
- Total layers and height
- Color count with names/identifiers
- Layer ranges per color (start/end)
- Tool change locations
- Filament usage estimates
- Color overlap analysis

### Debug Features
- Raw G-code preview with syntax highlighting
- Tool change visualization timeline
- Parser decision logs
- Export analysis as JSON/CSV

### Optimization Features
- Interactive slot assignment
- Step-by-step swap instructions
- Exact layer numbers for pauses
- Time savings calculations

## Development Practices

### Parser Implementation
- Line-by-line parsing for large files
- Tool change detection (T0, T1, etc.)
- Layer tracking (Z-height changes)
- OrcaSlicer metadata extraction

### Error Handling
- Comprehensive logging with debug levels
- Parser warnings for problematic G-code
- Graceful handling of malformed files

### Testing Approach
- Use sample.gcode for development testing
- Test with files up to 200MB
- Verify multi-color scenarios (>4 colors)
- Performance benchmarking

## Browser Compatibility
- Modern browsers with ES6+ support
- Chrome, Firefox, Safari, Edge

## Future Considerations
- Support for other slicers (PrusaSlicer, Cura)
- Cloud storage integration
- Mobile app version
- OctoPrint/Klipper integration