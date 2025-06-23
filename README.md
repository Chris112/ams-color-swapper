# AMS Color Swapper

A sophisticated G-code analyzer and optimizer for multi-color 3D prints using Automatic Material Systems (AMS). This tool helps optimize filament assignments for prints with more than 4 colors, minimizing manual swaps and maximizing print efficiency.

\![G-code Color Mapper](https://img.shields.io/badge/G--code-Color%20Optimizer-blue)
\![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
\![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)

## 🎯 Features

- **G-code Analysis**: Parse multi-color G-code files from OrcaSlicer and other slicers
- **Color Mapping**: Automatically detect which colors are used on which layers
- **AMS Optimization**: Smart slot assignment for >4 color prints
- **Swap Instructions**: Clear visual instructions for manual filament changes
- **Visual Timeline**: See color usage across all print layers
- **Multiple Printer Support**: Bambu Lab, Prusa MMU, and generic multi-material printers
- **Real-time Analysis**: Fast parsing with progress tracking
- **Export Options**: Download optimization reports and instructions

## 🚀 Quick Start

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ams-color-swapper.git
cd ams-color-swapper

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`

## 📖 Usage

1. **Select Printer Type**: Choose your printer from the dropdown (defaults to Bambu Lab)
2. **Upload G-code**: Drag and drop or click to upload your multi-color G-code file
3. **View Analysis**: See color usage statistics and layer information
4. **Review Optimization**: Check the recommended AMS slot assignments
5. **Follow Swap Instructions**: Get clear visual instructions for any manual swaps needed
6. **Export Report**: Download a detailed report with all optimization information

## 🛠️ Technical Details

### Architecture
- **Frontend**: Vanilla JavaScript with modern ES6+ features
- **Backend**: Express.js server with TypeScript
- **Parser**: Custom G-code parser optimized for multi-color prints
- **Optimizer**: Graph-based algorithm for slot assignment

### Key Components
- `src/parser/gcodeParser.ts` - Core G-code parsing logic
- `src/optimizer/colorOptimizer.ts` - Slot assignment algorithm
- `src/parser/enhancedGcodeParser.ts` - Stream-based parser with advanced features
- `public/js/app.js` - Frontend application logic

### Supported G-code Features
- Layer detection (multiple formats)
- Tool change commands (T0-T15)
- Bambu Lab AMS commands (M620/M621)
- Color definitions from comments
- Z-height tracking

## 🎨 How It Works

The optimizer uses a sophisticated algorithm to:
1. Analyze color usage patterns across layers
2. Build a conflict graph of overlapping colors
3. Find optimal slot assignments using graph coloring
4. Calculate minimal swap points for shared slots
5. Generate clear instructions with visual indicators

## 🔧 Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 📝 Documentation

See [APP_PLAN.md](APP_PLAN.md) for detailed project architecture and implementation details.

## 🤝 Contributing

Contributions are welcome\! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the ISC License.

## 🙏 Acknowledgments

- Built for the 3D printing community
- Optimized for OrcaSlicer multi-color prints
- Special support for Bambu Lab AMS systems
