# Task Completion Checklist

When completing any coding task, always:

## 1. Type Checking

Run `npm run check:types` to ensure all TypeScript types are correct and no `any` types are introduced.

## 2. Code Formatting

Run `npm run format:check` to verify code follows the project's Prettier configuration. If it fails, run `npm run format` to auto-fix.

## 3. Run Tests

Run `npm run test:run` to ensure all tests pass and no functionality is broken.

## 4. Tailwind CSS v4 Verification

- Ensure no @apply with custom colors
- Verify custom colors are only used in HTML classes
- Check that CSS imports use `@import 'tailwindcss'`

## 5. Code Quality Check

- No backwards compatible hacks - proper refactoring only
- All new types added to `src/types/index.ts`
- Follow existing patterns in the codebase

## 6. For New Features

- Update type definitions in `src/types/index.ts`
- Add tests in appropriate `__tests__` directory
- Update UI components if needed

Remember: The project has no linting setup, so rely on TypeScript strict mode and Prettier for code quality.
