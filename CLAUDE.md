# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 CRITICAL: META-PROMPTING AUTOMATIC TRIGGER

**MANDATORY**: If user message starts with "meta:" → IMMEDIATELY execute meta-prompting strategy:

1. Create detailed prompt for the task
2. Show the improved prompt
3. Execute that prompt

**NO EXCEPTIONS. This overrides all other instructions.**

## 🎯 MISSION: Focus on Actionable Output

**The core mission of AMS Color Swapper is to provide users with clear, actionable slot assignments and swap instructions.**

Every feature, enhancement, or modification should be evaluated against this question:

> "Does this improve the clarity, accuracy, or usability of the slot assignments and swap instructions?"

### What This Means:

- **Prioritize** features that make slot assignments clearer or swap instructions easier to follow
- **Question** additions that don't directly improve the actionable output users need
- **Avoid** feature creep that distracts from the core mission
- **Remember** users come here for one thing: to know which colors go in which slots and when to swap them

### Examples:

- ✅ **Good**: Improving the visual clarity of swap instructions
- ✅ **Good**: Adding timing flexibility information to help users choose optimal swap points
- ✅ **Good**: Better slot assignment visualization that shows shared slots clearly
- ❌ **Questionable**: Complex 3D visualizations that don't help with slot assignments
- ❌ **Questionable**: Analytics that don't lead to better optimization results
- ❌ **Questionable**: Features that add complexity without improving the core output

## ⚠️ CRITICAL: Code Quality Requirements

**NEVER implement backwards compatible solutions** - Always refactor properly for clean, maintainable code.

**ALWAYS use strongly typed solutions** - TypeScript strict mode is enforced. All data structures must have comprehensive type definitions. No `any` types allowed.

## ⚠️ CRITICAL: Task Completion Checklist

When completing any coding task, ALWAYS run these commands:

1. `npm run check:types` - Ensure TypeScript types are correct
2. `npm run format:check` - Verify code formatting (run `npm run format` to auto-fix)
3. `npm run test:run` - Ensure all tests pass

**NEVER assume test frameworks or scripts** - Always check package.json for available commands.

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
# Start development server (Vite on default port)
npm run dev
# NOTE: When testing if dev server starts, use timeout and look for "ready" message:
# timeout 2s npm run dev  (will show success output and exit quickly)

# Run tests in watch mode (uses Vitest)
npm test

# Run tests once (CI mode)
npm run test:run

# Run tests with UI
npm run test:ui

# Run benchmarks
npm run benchmark

# Build for production
npm run build

# Preview production build
npm run preview

# Format code with Prettier
npm run format

# Check formatting
npm run format:check

# Type checking with TypeScript
npm run check:types

# Generate favicons
npm run generate:favicons
```

## Architecture Overview

This is a client-side G-code analyzer application built with TypeScript and Vite. All processing happens in the browser with no backend server required.

### Key Components

1. **App** (`src/core/App.ts`): Core application framework that manages:
   - Component lifecycle
   - Event-driven architecture
   - State management
   - Service coordination

2. **GcodeParser** (`src/parser/gcodeParser.ts`): Core parsing engine that:
   - Extracts colors and filament changes from G-code
   - Identifies layers and tool changes
   - Calculates print statistics
   - Handles multiple slicer formats (OrcaSlicer, Bambu Lab, etc.)

3. **Parser Variants** (`src/parser/variants/`): Multiple parser implementations:
   - `GcodeParserStreams.ts` - Stream-based parser
   - `GcodeParserBuffer.ts` - Buffer-based parser
   - `GcodeParserFSM.ts` - Finite state machine parser
   - `GcodeParserRegex.ts` - Regex-based parser
   - `GcodeParserLazy.ts` - Lazy evaluation parser
   - `GcodeParserWorker.ts` - Web Worker-based parser

### Project Structure

```
src/
├── app.ts                    # Main application entry point
├── main.css                  # Global styles with Tailwind CSS v4
├── core/                     # Core application framework
│   ├── App.ts               # Application controller
│   ├── Component.ts         # Base component class
│   └── EventEmitter.ts      # Event system
├── parser/                   # G-code parsing logic
│   ├── gcodeParser.ts       # Core parser
│   ├── gcodeParserOptimized.ts
│   ├── colorExtractor.ts    # Color extraction utilities
│   ├── statistics.ts        # Statistics calculations
│   ├── parserFactory.ts     # Parser creation factory
│   └── variants/            # Parser implementations
├── domain/                   # Domain models and business logic
│   ├── models/              # Domain entities
│   │   ├── AmsConfiguration.ts
│   │   ├── Color.ts
│   │   ├── Print.ts
│   │   └── ToolChange.ts
│   ├── services/            # Business services
│   │   ├── ColorOverlapAnalyzer.ts
│   │   └── SimulatedAnnealingOptimizer.ts
│   └── mappers/             # Data transformation
├── services/                 # Application services
│   ├── FileProcessingService.ts
│   ├── OptimizationService.ts
│   ├── ExportService.ts
│   └── FactoryFloorService.ts
├── ui/                       # UI components
│   ├── components/          # UI component implementations
│   │   ├── ConfigurationModal.ts
│   │   ├── FileUploader.ts
│   │   ├── ResultsView.ts
│   │   └── volumetric/      # 3D visualization
│   └── templates/           # HTML templates
├── state/                    # State management
│   └── AppState.ts
├── repositories/             # Data access layer
├── types/                    # TypeScript type definitions
│   ├── index.ts            # Main type definitions
│   ├── errors.ts           # Error types
│   └── result.ts           # Result type utilities
├── utils/                    # Utility functions
└── workers/                  # Web workers
```

## Testing Approach

- Tests use Vitest with JSDOM environment
- Test files are in `__tests__` directories within each module
- Test fixtures with real G-code files are in `src/parser/__tests__/fixtures/`
- Run a specific test file: `npm test src/parser/__tests__/gcodeParser.test.ts`

## Important Design Decisions

1. **Client-Side Only**: All processing happens in the browser. There's no server component.

2. **TypeScript Strict Mode**: The codebase uses strict TypeScript. All data structures have comprehensive type definitions in `src/types/index.ts`.

3. **Component-Based Architecture**: Uses a custom Component base class for UI elements with lifecycle management.

4. **Event-Driven System**: Central EventEmitter for application-wide communication between components.

5. **Domain-Driven Design**: Clear separation between domain models, services, and UI layers.

6. **Multiple Parser Implementations**: Various parser strategies for different use cases and performance characteristics.

7. **Styling**: Uses Tailwind CSS v4 (NOT v3!) with a custom dark theme. The app is dark mode by default (`class="dark"` on HTML element). See the critical Tailwind v4 notes at the top of this file.

8. **Build System**: Vite handles both development and production builds with automatic optimization.

9. **State Management**: Centralized AppState with event-driven updates.

10. **Repository Pattern**: Data access abstracted through repository interfaces.

## Common Tasks

### Adding a New Parser Feature

1. Update the type definitions in `src/types/index.ts`
2. Implement the feature in `src/parser/gcodeParser.ts`
3. Add corresponding tests in `src/parser/__tests__/`
4. Update the UI in `src/app.ts` to display the new data

### Modifying the UI

1. The main HTML structure is in `index.html`
2. UI components extend the base `Component` class in `src/core/Component.ts`
3. Component templates are in `src/ui/templates/`
4. Use the EventEmitter for component communication
5. Styles use Tailwind CSS v4 classes - check `tailwind.config.js` for custom theme colors:
   - Vibrant colors: `vibrant-pink`, `vibrant-purple`, `vibrant-blue`, etc.
   - Dark mode colors: `dark-bg`, `dark-surface`, `dark-elevated`
   - Gradients: `gradient-neon`, `gradient-cyber`, `gradient-ocean`, etc.
   - Glow effects: `glow-pink`, `glow-blue`, `glow-purple`, etc.

### Working with Test Fixtures

Test G-code files are stored in `src/parser/__tests__/fixtures/`. When adding new test cases, place sample G-code files here and reference them in your tests.

### Adding a New Component

1. Create a new component class extending `src/core/Component.ts`
2. Add the component template in `src/ui/templates/`
3. Register event handlers using the EventEmitter
4. Import and instantiate in the main App class
5. Follow the existing pattern of components like `FileUploader`, `ResultsView`, etc.

## Key Architectural Patterns

### Domain Models

- All domain models are in `src/domain/models/`
- Models use classes with strong typing
- Models include validation and business logic
- Examples: `Color`, `Print`, `AmsConfiguration`, `ToolChange`

### Service Layer

- Application services in `src/services/` handle orchestration
- Domain services in `src/domain/services/` handle business logic
- Services are injected into components via constructor
- Services emit events for state changes

### Repository Pattern

- Repositories abstract data access
- All repositories implement interfaces from `src/repositories/interfaces.ts`
- Support for caching, file system, and in-memory storage
- Used for G-code files, configurations, and results

### Event-Driven Communication

- Central `eventBus` instance for app-wide events
- Components subscribe to events in `connectedCallback()`
- Components unsubscribe in `disconnectedCallback()`
- Typed events defined in `src/core/EventEmitter.ts`
