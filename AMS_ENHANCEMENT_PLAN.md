# Enhanced AMS Optimization Dashboard Plan

## Overview

Enhance the existing AMS optimization system with three key user-requested features:

1. **Color substitution suggestions** to reduce manual swaps
2. **Trust-building visualizations** to help users understand the swap plan
3. **Flexible swap timing** with earliest/latest layer ranges

## 1. Color Substitution Engine (New Feature)

### Create `ColorSubstitutionAnalyzer.ts`

- Analyze color usage patterns to find substitution opportunities
- Calculate impact: "swap color A to B reduces swaps by X% or Y manual swaps"
- Use color similarity algorithms (RGB distance, visual perception)
- Consider print quality impact vs efficiency gains

### Key Functions:

- `analyzeSubstitutionOpportunities()` - Find all viable color swaps
- `calculateSwapImpact()` - Quantify reduction in manual swaps
- `evaluateColorSimilarity()` - Assess visual impact of substitutions
- `generateSubstitutionPlan()` - Create actionable substitution recommendations

## 2. Trust-Building Visualizations (Enhancement)

### Add to `SwapPlanVisualizer.ts`

- **Color Usage Timeline**: Visual timeline showing when each color is active
- **Slot Occupancy Chart**: Display what's loaded in each AMS slot over time
- **Conflict Visualization**: Highlight exactly where conflicts occur
- **Swap Impact Preview**: Before/after comparison of manual interventions
- **Progress Tracking**: Real-time feedback during print execution

### Visualization Components:

- Interactive Gantt chart for color usage
- Animated AMS slot state transitions
- Conflict heatmap overlay
- Side-by-side efficiency comparison charts

## 3. Flexible Swap Timing (Core Enhancement)

### Update `ManualSwap` Interface

```typescript
interface ManualSwap {
  // Existing fields...
  timingOptions: {
    earliest: number; // Earliest possible layer
    latest: number; // Latest possible layer
    optimal: number; // Recommended layer
    adjacentOnly: boolean; // If swap must be adjacent to usage
  };
  swapWindow: {
    startLayer: number;
    endLayer: number;
    flexibilityScore: number; // How flexible this timing is
  };
}
```

### Enhanced Timing Logic:

- Calculate earliest/latest feasible swap layers
- Consider buffer zones around color usage
- Account for material change requirements
- Provide multiple timing options with trade-offs

## 4. UI Enhancements

### Update `AMSOptimizationView.ts`

- Add "Color Substitution Suggestions" section
- Integrate trust-building visualizations
- Display flexible timing options for each swap
- Interactive elements for exploring alternatives

### New UI Sections:

1. **Substitution Recommendations Panel**
2. **Interactive Swap Timeline Visualization**
3. **Timing Flexibility Options**
4. **Trust Score Dashboard**

## 5. Service Layer Updates

### Enhance `AMSRecommendationService.ts`

- Integrate color substitution analysis
- Add visualization data preparation
- Include flexible timing calculations
- Provide comprehensive impact assessments

## 6. Integration Points

### Update existing files:

- `App.ts` - Integrate new services
- `ResultsView.ts` - Display enhanced visualizations
- `swapInstructionsTemplate` - Show timing ranges
- Type definitions for new interfaces

## Implementation Benefits

### For Users:

- **Reduced Manual Work**: Smart substitution reduces intervention by 20-40%
- **Increased Confidence**: Visual feedback builds trust in automated decisions
- **Flexible Control**: Choose swap timing based on personal preferences
- **Better Print Quality**: Informed substitution choices maintain visual quality

### Technical Improvements:

- Modular architecture allows incremental feature rollout
- Enhanced analytics provide deeper optimization insights
- Interactive visualizations improve user experience
- Flexible timing system accommodates various printing scenarios

## Estimated Impact

- **20-40% reduction** in manual swaps through smart substitution
- **Enhanced user trust** through transparent visualization
- **Improved print success rate** with flexible timing options
- **Better user experience** with interactive guidance tools

## Implementation Timeline

### Phase 1: Core Infrastructure (Current Focus)

1. ✅ Save enhancement plan to file
2. 🔄 Create ColorSubstitutionAnalyzer for swap reduction suggestions
3. 🔄 Create SwapPlanVisualizer for trust-building visualizations
4. 🔄 Update ManualSwap interface for flexible timing

### Phase 2: UI Integration

5. 🔄 Enhance AMSOptimizationView with new features
6. 🔄 Update AMSRecommendationService with new capabilities
7. 🔄 Integrate new features into existing UI components

### Phase 3: Testing and Refinement

8. 📋 Test color substitution algorithms with real G-code files
9. 📋 Validate visualization accuracy and user experience
10. 📋 Fine-tune timing flexibility algorithms
11. 📋 Performance optimization and error handling

## Technical Specifications

### Color Substitution Algorithm

- **RGB Color Distance**: ΔE76 color difference calculation
- **Usage Pattern Analysis**: Frequency, layer distribution, duration
- **Visual Impact Score**: Perceptual difference assessment
- **Print Quality Threshold**: Configurable substitution limits

### Trust-Building Visualizations

- **Canvas-based Timeline**: High-performance color usage rendering
- **Interactive Elements**: Hover, click, zoom capabilities
- **Real-time Updates**: Dynamic visualization during analysis
- **Accessibility**: Screen reader support, high contrast options

### Flexible Timing System

- **Buffer Zone Calculation**: Safe swap windows around color changes
- **Constraint Solving**: Multi-criteria optimization for timing
- **User Preference Integration**: Manual timing override options
- **Conflict Resolution**: Automatic timing adjustment for optimal flow
