# Code Style and Conventions

## TypeScript Requirements

- **Strict Mode**: Always enabled
- **No `any` types**: All data structures must have comprehensive type definitions
- **Type Files**: All interfaces are in `src/types/index.ts`
- **Clean Code**: NEVER implement backwards compatible solutions - always refactor properly

## Tailwind CSS v4 Critical Rules

- **NO @apply with custom colors** - Use direct CSS properties instead
- **Custom colors ARE available in HTML** - Use them directly in class names
- **@apply is ONLY for built-in Tailwind utilities**
- **Import syntax**: Use `@import 'tailwindcss'` not old directives

## Prettier Configuration

- Semicolons: true
- Trailing comma: ES5
- Single quotes: true
- Print width: 100
- Tab width: 2 spaces
- No tabs
- Bracket spacing: true
- Arrow parens: always
- End of line: LF

## Code Organization

- Test files in `__tests__` directories within each module
- All types in `src/types/index.ts`
- Event-driven architecture for parsers
- Component-based UI structure
