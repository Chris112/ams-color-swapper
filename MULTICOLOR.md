# Comprehensive Multicolor Refactoring Plan

## Overview

Complete refactoring to support multiple colors per layer throughout the entire codebase, replacing ColorInfo interface with Color domain class, and removing all backwards compatibility code.

## Phase 1: Domain Model Enhancement

### 1.1 Enhance Color Class

- Add `layersUsed: Set<number>` to track all layers where color appears
- Add `partialLayers: Set<number>` for layers where color is not primary
- Add `usagePercentage: number` property
- Add methods: `isPartialInLayer()`, `isPrimaryInLayer()`, `getLayerUsage()`

### 1.2 Update Print Model

- Change `getColorAtLayer()` to return `Color[]` instead of single color
- Add `getPrimaryColorAtLayer()` for cases needing single color
- Add `getLayerDetails()` to access tool change information
- Update validation and business logic

## Phase 2: Parser Layer Refactoring

### 2.1 Remove ColorInfo Interface

- Delete ColorInfo from types/index.ts
- Update all imports to use Color class

### 2.2 Update Color Extractor

- Change `extractColorInfo()` to return `Color[]`
- Build Color objects with complete layer usage data
- Calculate usage percentages based on actual layer presence

### 2.3 Update Statistics

- Remove backwards compatibility code
- Work directly with Color objects
- Simplify color enhancement logic

### 2.4 Update All Parser Variants

- Ensure all variants properly track multiple colors per layer
- Remove single-color compatibility conversions
- Standardize multicolor handling

## Phase 3: Domain Layer Updates

### 3.1 Fix PrintMapper

- Update `toInfrastructure()` to preserve multicolor data
- Remove simplification that reduces to single color per layer
- Update `toDomain()` to handle Color objects directly

### 3.2 Update Optimization Services

- Modify ColorOverlapAnalyzer for multicolor layers
- Update optimization algorithms to consider partial layer usage
- Enhance slot assignment logic for shared layers

## Phase 4: UI Layer Updates

### 4.1 Results View Enhancement

- Update timeline to show overlapping colors in same layer
- Add visual indicators for multicolor layers
- Update tooltips to show all colors in a layer

### 4.2 Update Templates

- Change all ColorInfo references to Color
- Update property access (hexColor → hexValue)
- Handle arrays of colors per layer

## Phase 5: Data Persistence

### 5.1 Update Repositories

- Ensure cache serialization handles Color objects
- Update HMR state management
- Maintain multicolor data integrity

## Phase 6: Testing & Cleanup

### 6.1 Update All Tests

- Replace ColorInfo with Color in all tests
- Add comprehensive multicolor test cases
- Update benchmarks

### 6.2 Remove Legacy Code

- Delete all backwards compatibility code
- Remove single-color fallbacks
- Clean up unused imports

## Breaking Changes

1. GcodeStats.colors type changes from ColorInfo[] to Color[]
2. layerColorMap always returns string[] (never single string)
3. Print.getColorAtLayer() returns Color[] instead of Color | undefined
4. All ColorInfo properties renamed (hexColor → hexValue)
5. Parser variants must be updated simultaneously

## Benefits

- Accurate multicolor print analysis
- Better optimization for complex prints
- Cleaner, strongly-typed codebase
- Enhanced visualization capabilities
- Proper domain modeling

This refactoring will create a robust multicolor support system throughout the entire application.
