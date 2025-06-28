# Development Commands

## Essential Commands

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

# Type checking
npm run check:types

# Run benchmarks
npm run benchmark

# Generate favicons
npm run generate:favicons
```

## Task Completion Commands

When completing a task, always run:

1. `npm run check:types` - Ensure TypeScript types are correct
2. `npm run format:check` - Verify code formatting
3. `npm run test:run` - Run all tests to ensure nothing is broken

## Git Commands (Linux)

- `git status` - Check current changes
- `git diff` - View unstaged changes
- `git add .` - Stage all changes
- `git commit -m "message"` - Commit changes
- `git log --oneline -10` - View recent commits

## Testing Specific Files

```bash
# Run a specific test file
npm test src/parser/__tests__/gcodeParser.test.ts
```
