# AMS Slot Assignment Algorithm Improvements

## Current Algorithm Analysis

### How it Currently Works

The current implementation in `AmsConfiguration.ts` uses a simplistic approach:

1. **For ≤4 colors**: Each color gets its own permanent slot (1:1 mapping)
2. **For >4 colors**:
   - Top 3 colors by usage get permanent slots 1-3
   - Slot 4 becomes non-permanent (shared)
   - Remaining colors are grouped by non-overlap
   - Only the largest non-overlapping group is assigned to slot 4
   - **BUG**: Other colors are left unassigned!

### Problems with Current Approach

1. **Arbitrary 3-permanent rule**: Always keeping 3 slots permanent is inefficient
2. **Single swap slot**: Only using slot 4 for swapping creates bottlenecks
3. **Unassigned colors**: Colors that don't fit in the largest non-overlapping group are ignored
4. **No layer analysis**: Doesn't consider when colors are actually used
5. **Suboptimal swaps**: Can result in many more swaps than necessary

### Example: 7-Color Model Problem

```
Current Algorithm:
- Slots 1-3: Most used colors (permanent)
- Slot 4: 2-3 colors that don't overlap
- Unassigned: 2-3 colors that overlap with slot 4 colors
Result: Only 5-6 colors shown, missing 1-2 colors!
```

## Improved Algorithm Design

### Core Principles

1. **All colors must be assigned** - Never leave colors unassigned
2. **Dynamic slot usage** - Any slot can be permanent or shared
3. **Minimize total swaps** - Optimize across all 4 slots
4. **Layer-aware grouping** - Group colors by when they're used

### Algorithm Steps

#### Phase 1: Color Analysis

```typescript
interface ColorUsage {
  colorId: string;
  layers: Set<number>;
  firstLayer: number;
  lastLayer: number;
  layerCount: number;
}

// Build overlap graph
function analyzeColorOverlaps(colors: ColorUsage[]): OverlapGraph {
  // Create adjacency matrix where edge = overlap
  const overlaps = new Map<string, Set<string>>();

  for (const c1 of colors) {
    for (const c2 of colors) {
      if (c1.id !== c2.id && hasOverlap(c1.layers, c2.layers)) {
        overlaps.get(c1.id)?.add(c2.id);
      }
    }
  }
  return overlaps;
}
```

#### Phase 2: Optimal Grouping

```typescript
// Find optimal color groups that can share slots
function findOptimalGroups(colors: ColorUsage[], maxSlots: number): ColorGroup[] {
  // Use graph coloring algorithm
  // Goal: Minimize number of groups AND minimize swaps within groups
  // Strategy 1: Interval scheduling
  // - Sort colors by start layer
  // - Greedily assign to slots based on non-overlap
  // Strategy 2: Weighted graph coloring
  // - Weight = number of layers between colors
  // - Minimize total weight of edges within groups
}
```

#### Phase 3: Slot Assignment

```typescript
function assignToSlots(groups: ColorGroup[]): SlotAssignment[] {
  // Distribute groups across 4 slots to minimize swaps

  if (groups.length <= 4) {
    // Each group gets its own slot
    return groups.map((g, i) => ({
      slot: i + 1,
      colors: g.colors,
      swaps: calculateSwapsForGroup(g),
    }));
  }

  // Merge smallest groups or split largest groups
  return optimizeSlotDistribution(groups, 4);
}
```

### Optimization Strategies

#### Strategy 1: Layer-Based Intervals

Colors used in non-overlapping layer ranges can share slots freely:

```
Color A: Layers 1-100
Color B: Layers 101-200
Color C: Layers 201-300
→ Can all share one slot with 2 swaps
```

#### Strategy 2: Frequency-Based Grouping

Group infrequently used colors together:

```
Permanent slots: Colors used >30% of layers
Shared slots: Colors used <10% of layers
```

#### Strategy 3: Swap Minimization

Calculate swap cost for different configurations:

```
Configuration A: 10 swaps in slot 4
Configuration B: 3 swaps each in slots 2,3,4 = 9 total
→ Choose Configuration B
```

## Implementation Plan

### Phase 1: Quick Fix (Immediate)

Fix the bug where colors are left unassigned:

```typescript
private assignColorsWithSharing(colors: Color[]): void {
  // ... existing code for slots 1-3 ...

  // Assign ALL remaining colors to slot 4
  const remainingColors = sortedColors.slice(3);
  remainingColors.forEach(color => slot4.assignColor(color));
}
```

### Phase 2: Better Grouping (Short-term)

Improve grouping logic while keeping current structure:

```typescript
private assignColorsWithSharing(colors: Color[]): void {
  // Analyze which slots should be permanent vs shared
  const { permanentColors, sharedColors } = analyzeColorUsage(colors);

  // Assign permanent colors first
  // Then distribute shared colors to minimize swaps
}
```

### Phase 3: Full Optimization (Long-term)

Implement complete graph-based optimization:

- Color overlap analysis
- Dynamic programming for optimal grouping
- Configurable optimization goals (min swaps vs min time)

## Examples

### Example 1: 7-Color Venusaur

```
Current: 3 permanent + 2 in slot 4 = 5 colors shown
Fixed: 3 permanent + 4 in slot 4 = 7 colors shown

Optimized:
Slot 1: Teal (permanent - used 40%)
Slot 2: Green → Pink (1 swap at layer 150)
Slot 3: Red → White (1 swap at layer 200)
Slot 4: Dark Green → Yellow (1 swap at layer 180)
Total: 3 swaps instead of 4+
```

### Example 2: 8-Color Complex Model

```
Colors with layer ranges:
A: 1-50, B: 1-100, C: 51-150, D: 101-200
E: 151-250, F: 201-300, G: 251-350, H: 1-350

Optimal assignment:
Slot 1: H (permanent - used throughout)
Slot 2: A → C → E → G (3 swaps)
Slot 3: B → D → F (2 swaps)
Slot 4: Empty or additional optimizations
Total: 5 swaps for 8 colors
```

## Testing Strategy

1. **Unit tests**: Test grouping algorithms with known inputs
2. **Integration tests**: Test with real G-code files
3. **Performance tests**: Ensure optimization completes quickly
4. **Validation**: Verify no colors are left unassigned

## Future Enhancements

1. **User preferences**: Let users prioritize certain colors as permanent
2. **Multi-objective optimization**: Balance swaps vs print time vs waste
3. **Machine learning**: Learn optimal patterns from user choices
4. **Preview mode**: Show different optimization options to user
