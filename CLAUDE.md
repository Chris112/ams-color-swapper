# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ CRITICAL: Code Quality Requirements

**NEVER implement backwards compatible solutions** - Always refactor properly for clean, maintainable code.

**ALWAYS use strongly typed solutions** - TypeScript strict mode is enforced. All data structures must have comprehensive type definitions. No `any` types allowed.

## ⚠️ CRITICAL: Tailwind CSS v4 Usage

**This project uses Tailwind CSS v4 - DO NOT use v3 syntax!**

### Key Differences:

1. **NO @apply with custom colors** - Use direct CSS properties instead

   ```css
   /* ❌ WRONG - This will cause errors */
   .my-class {
     @apply bg-brand-blue from-brand-purple;
   }

   /* ✅ CORRECT - Use CSS properties */
   .my-class {
     background-color: #0070f3;
     background: linear-gradient(to right, #0070f3, #8b5cf6);
   }
   ```

2. **Custom colors ARE available in HTML** - Use them directly in class names

   ```html
   <!-- ✅ CORRECT - These work in HTML -->
   <div class="bg-brand-blue text-brand-purple border-brand-teal"></div>
   ```

3. **@apply is ONLY for built-in Tailwind utilities**

   ```css
   /* ✅ CORRECT - Built-in utilities work */
   .my-class {
     @apply relative w-full rounded-md;
   }
   ```

4. **Import syntax** - Use `@import 'tailwindcss'` not old directives

## Development Commands

Run these commands from the project root:

```bash
# Start development server on port 4000
npm run dev

# Run tests in watch mode
npm test

# Run tests once (CI mode)
npm run test:run

# Run tests with UI
npm run test:ui

# Build for production
npm run build

# Preview production build
npm run preview

# Format code
npm run format

# Check formatting
npm run format:check
```

## Architecture Overview

This is a client-side G-code analyzer application built with TypeScript and Vite. All processing happens in the browser with no backend server required.

### Key Components

1. **GcodeAnalyzer** (`src/app.ts`): Main application controller that manages:
   - File upload handling
   - UI state management
   - Result display and export
   - DOM interactions

2. **GcodeParser** (`src/parser/gcodeParser.ts`): Core parsing engine that:
   - Extracts colors and filament changes from G-code
   - Identifies layers and tool changes
   - Calculates print statistics
   - Handles multiple slicer formats (OrcaSlicer, Bambu Lab, etc.)

3. **EnhancedGcodeParser** (`src/parser/enhancedParser.ts`): Advanced streaming parser with:
   - Event-driven architecture for real-time progress
   - Memory-efficient processing for large files
   - Based on best practices from gcode-parser library

### Project Structure

```
src/
├── app.ts                 # Main application entry point
├── parser/               # G-code parsing logic
│   ├── gcodeParser.ts    # Core parser
│   ├── enhancedParser.ts # Streaming parser
│   ├── colorExtractor.ts # Color extraction utilities
│   └── statistics.ts     # Statistics calculations
├── types/index.ts        # All TypeScript interfaces
└── utils/               # Utility functions
    ├── fileReader.ts    # File reading utilities
    └── logger.ts        # Debug logging system
```

## Testing Approach

- Tests use Vitest with JSDOM environment
- Test files are in `__tests__` directories within each module
- Test fixtures with real G-code files are in `src/parser/__tests__/fixtures/`
- Run a specific test file: `npm test src/parser/__tests__/gcodeParser.test.ts`

## Important Design Decisions

1. **Client-Side Only**: All processing happens in the browser. There's no server component.

2. **TypeScript Strict Mode**: The codebase uses strict TypeScript. All data structures have comprehensive type definitions in `src/types/index.ts`.

3. **Event-Driven Parsing**: The enhanced parser uses events for progress updates, allowing real-time UI feedback during large file processing.

4. **Styling**: Uses Tailwind CSS v4 (NOT v3!) with a custom dark theme. The app is dark mode by default (`class="dark"` on HTML element). See the critical Tailwind v4 notes at the top of this file.

5. **Build System**: Vite handles both development and production builds with automatic optimization.

## Common Tasks

### Adding a New Parser Feature

1. Update the type definitions in `src/types/index.ts`
2. Implement the feature in `src/parser/gcodeParser.ts`
3. Add corresponding tests in `src/parser/__tests__/`
4. Update the UI in `src/app.ts` to display the new data

### Modifying the UI

1. The main HTML structure is in `index.html`
2. Dynamic UI updates are handled in `src/app.ts`
3. Styles use Tailwind classes - check `tailwind.config.js` for custom theme

### Working with Test Fixtures

Test G-code files are stored in `src/parser/__tests__/fixtures/`. When adding new test cases, place sample G-code files here and reference them in your tests.
