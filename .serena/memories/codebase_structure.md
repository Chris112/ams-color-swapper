# Codebase Structure

## Root Structure

```
src/
├── app.ts                 # Main application entry point
├── main.css              # Global styles with Tailwind imports
├── core/                 # Core application framework
│   ├── App.ts           # Main app controller
│   ├── Component.ts     # Base component class
│   └── EventEmitter.ts  # Event system
├── parser/              # G-code parsing logic
│   ├── gcodeParser.ts   # Core parser
│   ├── gcodeParserOptimized.ts
│   ├── colorExtractor.ts # Color extraction utilities
│   ├── statistics.ts    # Statistics calculations
│   └── variants/        # Different parser implementations
├── domain/              # Business logic
│   ├── models/          # Domain models (Color, Print, etc.)
│   ├── services/        # Business services (optimization)
│   └── mappers/         # Data transformation
├── services/            # Application services
│   ├── FileProcessingService.ts
│   ├── OptimizationService.ts
│   └── ExportService.ts
├── ui/                  # UI components
│   ├── components/      # UI component implementations
│   └── templates/       # HTML templates
├── state/               # State management
├── repositories/        # Data layer
├── types/               # TypeScript type definitions
│   └── index.ts        # All interfaces and types
├── utils/              # Utility functions
└── workers/            # Web workers
```

## Key Architecture Patterns

- Component-based UI with base Component class
- Event-driven communication via EventEmitter
- Repository pattern for data access
- Service layer for business logic
- Domain models separate from UI
- Worker threads for heavy processing
