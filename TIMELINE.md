# Timeline Visualization Enhancement Plan

## Overview

This document outlines the implementation plan for fixing the layer timeline visualization component using **Option A: Vertical Stacking** approach to handle overlapping colors.

## Problem Statement

1. **Overlapping colors are not visible** - When multiple colors occupy the same layer range, only the last drawn color is visible
2. **Confusing interactions** - Users don't have clear feedback about what they can do with the timeline

## Solution: Vertical Stacking Approach

### Visual Design

```
Before (Current):
|==== Color 1 ====|
        |==== Color 2 ====| (Color 1 is hidden where they overlap)

After (Vertical Stacking):
|==== Color 1 ====|
        |==== Color 2 ====|
```

### Implementation Details

#### 1. Timeline Layout Algorithm

- Calculate maximum overlap depth (how many colors share the same layer range)
- Divide timeline height by max overlap depth to get row height
- Assign each color to a row based on overlap analysis
- Colors that don't overlap can share the same row

#### 2. Color Band Rendering

```typescript
interface ColorBand {
  colorId: string;
  startLayer: number;
  endLayer: number;
  row: number; // 0-based row index
  hexValue: string;
}
```

#### 3. Enhanced Interactions

- **Hover**: Show tooltip with color details
- **Click**: Focus and highlight color across all visualizations
- **Double-click**: Zoom to color range
- **Keyboard**: Arrow keys to navigate between bands

## Implementation Steps

### Phase 1: Refactor Timeline Drawing

1. Add overlap detection algorithm in `ResultsView.ts`
2. Implement row assignment logic
3. Update canvas drawing to support multiple rows
4. Add visual separators between rows

### Phase 2: Improve Overlay System

1. Ensure overlay segments match canvas positions exactly
2. Add rich hover states with smooth transitions
3. Implement tooltip system with color info
4. Add click handlers for color selection

### Phase 3: Visual Enhancements

1. Add subtle gradients to color bands
2. Implement glow effects for active/hovered colors
3. Add transparency for better overlap visualization
4. Include layer number markers

### Phase 4: Interaction Features

1. Add zoom controls (+/- buttons)
2. Implement timeline panning for long prints
3. Add mini-map for navigation
4. Support touch gestures on mobile

### Phase 5: Accessibility & Polish

1. Add ARIA labels for screen readers
2. Ensure keyboard navigation works smoothly
3. Add focus indicators
4. Test with various color combinations

## Key Files to Modify

### src/ui/components/ResultsView.ts

- `drawColorTimeline()` - Main timeline drawing logic
- `createTimelineOverlay()` - Interactive overlay creation
- Add new methods:
  - `detectOverlaps()` - Find overlapping color ranges
  - `assignColorRows()` - Assign colors to rows
  - `drawColorBand()` - Draw individual color band
  - `showTooltip()` - Display color information

### src/main.css

```css
/* New styles needed */
.timeline-tooltip {
  /* Tooltip styling */
}

.timeline-band {
  /* Individual color band styling */
}

.timeline-zoom-controls {
  /* Zoom button styling */
}
```

### src/ui/templates/index.ts

- Add zoom control buttons to timeline template
- Include tooltip container
- Add accessibility attributes

## Technical Considerations

1. **Performance**: Use `requestAnimationFrame` for smooth animations
2. **Memory**: Reuse canvas context and minimize redraws
3. **Compatibility**: Test on various screen sizes and devices
4. **Edge Cases**: Handle files with 20+ colors gracefully

## Success Criteria

- [ ] All overlapping colors are clearly visible
- [ ] Users can easily identify and interact with each color
- [ ] Smooth hover and click interactions
- [ ] Clear visual feedback for all actions
- [ ] Works well on desktop and mobile
- [ ] Accessible via keyboard navigation

## Testing Plan

1. Test with files containing 2-10 overlapping colors
2. Verify interactions on touch devices
3. Check accessibility with screen readers
4. Performance test with large files (1000+ layers)
5. Cross-browser compatibility testing

## Future Enhancements

- Color grouping by material type
- Timeline annotations for important layers
- Export timeline as image
- Customizable color schemes for accessibility
