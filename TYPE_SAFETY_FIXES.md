# Type Safety Fixes - Implementation Plan

## Overview

After enabling stricter TypeScript settings, we've identified 295 type errors across 48 files. This document outlines a phased approach to fix these issues.

## Error Categories

### 1. Array Index Access (noUncheckedIndexedAccess)

- **Count**: ~150 errors
- **Pattern**: `array[0]` returning `T | undefined`
- **Solution**: Add proper bounds checking or use optional chaining

### 2. Exact Optional Properties (exactOptionalPropertyTypes)

- **Count**: ~20 errors
- **Pattern**: Assigning `undefined` to optional properties
- **Solution**: Use proper type unions or omit undefined values

### 3. Object Possibly Undefined

- **Count**: ~80 errors
- **Pattern**: Accessing properties on potentially undefined objects
- **Solution**: Add null checks or use optional chaining

### 4. Implicit Returns (noImplicitReturns)

- **Count**: ~15 errors
- **Pattern**: Functions missing return statements in some code paths
- **Solution**: Add explicit returns or throw errors

### 5. Type Assertions

- **Count**: ~30 errors
- **Pattern**: Using `as any` or incorrect type assertions
- **Solution**: Use proper types or type guards

## Phase 1: Critical Path Fixes (High Priority)

These files are in the critical execution path and should be fixed first:

### 1. MergeHistoryManager.ts

```typescript
// Current issue: Array access without bounds checking
const removedSnapshot = this.snapshots.shift()!;

// Fix:
const removedSnapshot = this.snapshots.shift();
if (!removedSnapshot) {
  throw new Error('No snapshot to remove');
}
```

### 2. ColorMergeService.ts

```typescript
// Current issue: Map.get() returns undefined
const branchIds = this.branches.get(this.currentBranch)!;

// Fix:
const branchIds = this.branches.get(this.currentBranch);
if (!branchIds) {
  throw new Error(`Branch not found: ${this.currentBranch}`);
}
```

### 3. TimelineRepository.ts

```typescript
// Current issue: Optional property assignment
{
  signal: controller?.signal;
}

// Fix:
{
  signal: controller?.signal ?? null;
}
```

## Phase 2: Core Services (Medium Priority)

### 1. GcodeParser and variants

- Fix array access patterns
- Add proper error handling for edge cases
- Remove `as any` casts

### 2. OptimizationService

- Add bounds checking for color arrays
- Fix optional property assignments
- Add proper return types

### 3. Analytics algorithms

- Fix extensive array access issues
- Add null checks for color lookups
- Improve type safety in optimization loops

## Phase 3: UI Components (Low Priority)

### 1. Component base classes

- Fix event handler types
- Remove `as any` from DOM manipulation
- Add proper null checks

### 2. UI templates

- Fix missing exports (formatColorDisplay)
- Add bounds checking for array access
- Improve type safety in event handlers

## Phase 4: Tests and Workers

### 1. Test files

- Update mocks to match stricter types
- Fix `as any` usage in tests
- Add proper type assertions

### 2. Worker files

- Fix fetch signal types
- Update message passing types
- Add proper error handling

## Implementation Strategy

### Step 1: Create Type Guards

```typescript
// utils/typeGuards.ts
export function assertDefined<T>(value: T | undefined, message: string): asserts value is T {
  if (value === undefined) {
    throw new Error(message);
  }
}

export function safeArrayAccess<T>(array: readonly T[], index: number, defaultValue: T): T {
  return array[index] ?? defaultValue;
}
```

### Step 2: Fix Critical Paths

1. Start with MergeHistoryManager and ColorMergeService
2. Fix one file at a time
3. Run tests after each fix
4. Commit working changes frequently

### Step 3: Gradual Migration

1. Fix errors by category across the codebase
2. Update tests as needed
3. Document any breaking changes

### Step 4: Prevention

1. Add pre-commit hooks for type checking
2. Update CI/CD to fail on type errors
3. Add type coverage metrics

## Temporary Workaround

If needed to unblock development, temporarily relax settings:

```json
{
  "compilerOptions": {
    "noUncheckedIndexedAccess": false,
    "exactOptionalPropertyTypes": false
  }
}
```

Then fix issues incrementally and re-enable.

## Success Metrics

- 0 TypeScript errors with all strict options enabled
- 100% type coverage (no `any` types)
- All tests passing
- No runtime type errors

## Timeline

- Phase 1: 1-2 days
- Phase 2: 2-3 days
- Phase 3: 2-3 days
- Phase 4: 1-2 days

Total: ~1.5 weeks for complete type safety migration
