# Knip Configuration Guide

This document explains the knip configuration for the AMS Color Swapper project and how to interpret its results.

## Configuration Overview

The project uses `knip.ts` (TypeScript configuration) which provides:

- Better IDE support with type checking
- Inline documentation with comments
- More flexible configuration options

## Understanding the Results

### False Positives

The following patterns commonly appear as unused but are actually used:

1. **Worker Files** - Files like `compression.ts` that are used by workers may appear unused because knip can't trace through Worker constructors
2. **Event-Driven Code** - Components that use EventEmitter patterns may have methods that appear unused
3. **Type-Only Exports** - Types used only for type checking (not runtime) may appear unused
4. **Dynamic Imports** - Code loaded with `import()` may not be traced correctly

### Currently Flagged Items

#### Potentially Unused Files (7)

- `src/domain/services/index.ts` - Barrel export file, check if needed
- `src/services/AMSRecommendationService.ts` - May be unused feature
- `src/ui/components/AMSOptimizationView.ts` - May be unused UI component
- `src/ui/components/ConfigurationSelector.ts` - May be replaced by ConfigurationModal
- `src/ui/components/volumetric/HologramEffects.ts` - May be unused 3D effect
- `src/utils/compression.ts` - **FALSE POSITIVE** - Used by TimelineRepository
- `src/utils/domHelpers.ts` - Utility functions that may be unused

#### Unused Dependencies

- `@types/lz-string` - Type definitions for lz-string (keep if lz-string is used)

#### Unused Exports

Most of these are utility functions that might be used in the future or are false positives:

- Animation utilities (`smoothScrollTo`, `typewriterEffect`, etc.)
- Type guards (`assertNotNull`, `isNotNull`, etc.)
- Template functions

## How to Address Issues

### Before Removing Anything

1. **Search for dynamic usage**: Check if the code is used via:
   - String references
   - Dynamic imports
   - Event handlers
   - Worker messages

2. **Check for type-only usage**: Some exports are used only for TypeScript type checking

3. **Consider future use**: Some utilities might be kept for future features

### Safe to Remove

Generally safe to remove if confirmed unused:

- Barrel export files with no imports
- Old UI components replaced by newer ones
- Utilities with no references anywhere

### Keep With Caution

Be careful about removing:

- Type definitions (may be used for type checking only)
- Event handler methods
- Worker-related code
- Base classes and interfaces

## Updating the Configuration

To add new patterns to ignore:

```typescript
// In knip.ts
ignore: [
  // ... existing patterns
  'src/new-pattern/**', // Add explanation here
];
```

To ignore specific dependencies:

```typescript
ignoreDependencies: [
  // ... existing
  'new-dependency', // Explain why
];
```

## Running Knip

```bash
# Run full analysis
npx knip

# Run with specific reporter
npx knip --reporter json

# Run for specific file types
npx knip --include files,exports

# Fix auto-fixable issues
npx knip --fix
```

## CI/CD Integration

Consider adding to your CI pipeline:

```yaml
- name: Check for dead code
  run: npx knip --no-exit-code --reporter markdown >> $GITHUB_STEP_SUMMARY
```

This will add dead code report to GitHub Actions summary without failing the build.
