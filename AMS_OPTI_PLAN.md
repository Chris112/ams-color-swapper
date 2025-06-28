# AMS Color Assignment Algorithm Optimization Plan

## Executive Summary

This document outlines a comprehensive plan to enhance the AMS (Automatic Material System) color assignment algorithms in the G-code analyzer application. The current implementation uses basic RGB Euclidean distance and simple optimization strategies, which limits accuracy and performance for complex multi-color prints.

The proposed improvements focus on:

- **Perceptual Color Accuracy**: Implementing LAB color space and Delta E algorithms
- **Advanced Optimization**: Multiple algorithm approaches for different scenarios
- **Performance Enhancement**: Spatial indexing and parallel processing
- **Material Intelligence**: Context-aware assignments considering filament properties
- **User Configuration**: Flexible algorithm selection and trade-off controls

## Current Algorithm Analysis

### Existing Implementation Assessment

#### Color Distance Calculation (`src/utils/colorNames.ts`)

```typescript
// Current: Simple RGB Euclidean distance
function colorDistance(color1: { r; g; b }, color2: { r; g; b }): number {
  const dr = color1.r - color2.r;
  const dg = color1.g - color2.g;
  const db = color1.b - color2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
```

**Issues:**

- RGB space is not perceptually uniform
- Equal numeric distances don't represent equal perceived differences
- No consideration for material properties or context

#### Optimization Strategies (`src/domain/services/`)

1. **ColorOverlapAnalyzer**: Layer-based overlap detection with greedy grouping
2. **SimulatedAnnealingOptimizer**: Probabilistic search with cooling schedule
3. **AmsConfiguration**: Basic slot assignment with sharing logic

**Current Algorithm Types:**

- `OptimizationAlgorithm.Greedy` - Fast but potentially suboptimal
- `OptimizationAlgorithm.SimulatedAnnealing` - Better quality but slower

#### Data Structures

- **Color Model**: Layer usage tracking, RGB hex values, basic metadata
- **Assignment Logic**: Slot-based with manual swap calculation
- **Performance**: O(n²) overlap checking, linear color searches

### Identified Weaknesses

1. **Perceptual Inaccuracy**: RGB Euclidean distance doesn't match human vision
2. **Limited Algorithm Variety**: Only 2 optimization approaches
3. **No Material Context**: Ignores filament compatibility and properties
4. **Performance Bottlenecks**: No spatial indexing for color searches
5. **Edge Case Handling**: Poor support for similar colors, transparent materials
6. **Configuration Rigidity**: Limited user control over optimization trade-offs

## Technical Requirements

### Enhanced Color Science Foundation

#### Color Space Support

- **LAB Color Space**: Perceptually uniform color differences
- **LUV Color Space**: Alternative perceptually uniform space
- **HSV/HSL**: For hue-based color harmony analysis
- **Color Conversion Utilities**: Accurate RGB ↔ LAB ↔ LUV transformations

#### Advanced Distance Metrics

- **Delta E CIE76**: Basic perceptual color difference
- **Delta E CIE94**: Improved formula with weighted components
- **Delta E CIE2000**: Most accurate perceptual difference calculation
- **Material-Weighted Distance**: Factor in temperature, compatibility, material type
- **Context-Aware Distance**: Consider surrounding colors and print sequence

### New Optimization Algorithms

#### 1. Hungarian Algorithm Optimizer

- **Use Case**: Optimal assignment for smaller color sets (≤ 15 colors)
- **Complexity**: O(n³) - perfect solutions but computationally intensive
- **Implementation**: Assignment problem formulation with swap cost matrix

#### 2. Genetic Algorithm Optimizer

- **Use Case**: Large color sets with complex constraints
- **Features**: Population-based search, crossover, mutation operators
- **Advantages**: Handles multi-objective optimization naturally

#### 3. Machine Learning Clustering

- **K-Means Clustering**: Group similar colors automatically
- **DBSCAN**: Density-based clustering for irregular color distributions
- **Hierarchical Clustering**: Multi-level color organization

#### 4. Multi-Criteria Decision Making (MCDM)

- **TOPSIS Algorithm**: Rank assignments by multiple criteria
- **Criteria**: Color similarity, material compatibility, swap minimization
- **Weights**: User-configurable importance factors

#### 5. Hierarchical Color Matching

- **Phase 1**: Group by material type (PLA, PETG, TPU, etc.)
- **Phase 2**: Color matching within material groups
- **Phase 3**: Cross-group optimization if needed

### Performance Optimization Strategies

#### Spatial Indexing

- **KD-Tree Implementation**: O(log n) color neighbor searches
- **Color Space Partitioning**: Efficient nearest neighbor queries
- **Adaptive Indexing**: Switch methods based on color set size

#### Preprocessing & Caching

- **Color Distance Cache**: Precompute common color pairs
- **Assignment Pattern Cache**: Store successful assignments for reuse
- **Incremental Updates**: Avoid full recalculation for minor changes

#### Parallel Processing

- **Web Worker Integration**: Offload optimization to background threads
- **Batch Processing**: Parallel evaluation of multiple assignment candidates
- **Progressive Results**: Return intermediate results while optimizing

## Implementation Phases

### Phase 1: Enhanced Color Science Foundation (Week 1-2)

#### Files to Create:

```
src/domain/services/ColorDistanceService.ts
src/domain/models/ColorSpace.ts
src/utils/colorConversions.ts
```

#### Key Features:

- LAB/LUV color space conversion utilities
- Delta E distance calculation implementations
- Material property integration
- Configurable distance metric selection

#### Deliverables:

- Complete color space conversion library
- Multiple distance calculation methods
- Unit tests with known color difference examples
- Performance benchmarks vs current RGB method

### Phase 2: Advanced Assignment Algorithms (Week 3-5)

#### Files to Create:

```
src/domain/services/HungarianOptimizer.ts
src/domain/services/GeneticOptimizer.ts
src/domain/services/MLClusteringOptimizer.ts
src/domain/services/MultiCriteriaOptimizer.ts
src/domain/services/HierarchicalOptimizer.ts
```

#### Key Features:

- Hungarian algorithm for optimal assignment
- Genetic algorithm with customizable operators
- K-means and DBSCAN clustering
- TOPSIS multi-criteria decision making
- Material-first hierarchical matching

#### Deliverables:

- 5 new optimization algorithms
- Performance characteristics documentation
- Algorithm selection recommendations
- Configurable parameters for fine-tuning

### Phase 3: Performance & Scalability Improvements (Week 6-7)

#### Files to Modify:

```
src/domain/services/ColorOverlapAnalyzer.ts
src/services/OptimizationService.ts
src/domain/services/SpatialIndexService.ts (new)
```

#### Key Features:

- KD-tree spatial indexing for color searches
- Preprocessing cache for common operations
- Web Worker integration for parallel processing
- Memory usage optimization

#### Deliverables:

- 2-3x performance improvement for color matching
- Scalable algorithms supporting 20+ colors
- Reduced memory footprint
- Progressive optimization with early results

### Phase 4: Testing & Validation Framework (Week 8-9)

#### Files to Create:

```
src/domain/services/__tests__/ColorDistanceService.test.ts
src/domain/services/__tests__/AlgorithmComparison.test.ts
src/domain/services/__tests__/AccuracyValidation.test.ts
src/domain/services/__tests__/PerformanceBenchmarks.test.ts
src/domain/services/__tests__/EdgeCaseValidation.test.ts
```

#### Test Scenarios:

- **Miniature Prints**: High color count, small features
- **Artistic Prints**: Color harmony and aesthetic considerations
- **Functional Parts**: Material compatibility priority
- **Large Prints**: Performance with complex geometries
- **Edge Cases**: Similar colors, transparent materials, metallic filaments

#### Validation Metrics:

- **Color Accuracy**: Delta E difference vs manual expert assignments
- **Performance**: Processing time and memory usage
- **Swap Minimization**: Total manual swaps required
- **User Satisfaction**: Subjective quality ratings

### Phase 5: Configuration & Integration (Week 10-11)

#### Files to Modify:

```
src/services/OptimizationService.ts
src/domain/models/AmsConfiguration.ts
src/types/index.ts
src/ui/components/ConfigurationModal.ts
```

#### Key Features:

- Algorithm recommendation system
- User-configurable performance vs accuracy trade-offs
- Fallback strategies for edge cases
- Migration system for seamless upgrades

#### Deliverables:

- Intelligent algorithm selection
- Configuration UI for algorithm parameters
- Backward compatibility with existing configurations
- Documentation for algorithm selection

## Algorithm Specifications

### 1. LAB Delta E Color Distance

#### Implementation:

```typescript
interface LABColor {
  L: number; // Lightness (0-100)
  a: number; // Green-Red axis (-128 to 127)
  b: number; // Blue-Yellow axis (-128 to 127)
}

class ColorDistanceService {
  // Convert RGB to LAB color space
  rgbToLab(rgb: { r: number; g: number; b: number }): LABColor;

  // Calculate Delta E CIE2000 (most accurate)
  deltaE2000(lab1: LABColor, lab2: LABColor): number;

  // Material-weighted distance considering compatibility
  materialWeightedDistance(
    color1: Color,
    color2: Color,
    materialFactors: MaterialCompatibility
  ): number;
}
```

#### Benefits:

- Perceptually uniform color differences
- Matches human color perception
- Industry standard for color accuracy
- Better handling of similar colors

### 2. Hungarian Algorithm Optimizer

#### Use Case:

Optimal assignment for color sets ≤ 15 colors where perfect solution is required.

#### Implementation Approach:

```typescript
class HungarianOptimizer {
  // Build cost matrix: [color][slot] = total_swap_cost
  private buildCostMatrix(colors: Color[], slots: number): number[][];

  // Solve assignment problem optimally
  optimize(): SlotOptimizationResult;
}
```

#### Cost Function:

```
Cost[color_i][slot_j] = swap_penalty * overlaps_in_slot_j +
                        color_distance_penalty * avg_distance_to_slot_colors +
                        material_compatibility_penalty
```

### 3. Genetic Algorithm Optimizer

#### Use Case:

Large color sets (15+ colors) with complex multi-objective optimization.

#### Implementation:

```typescript
interface GeneticConfig {
  populationSize: number; // 50-200
  generations: number; // 100-1000
  mutationRate: number; // 0.01-0.1
  crossoverRate: number; // 0.7-0.9
  elitismRatio: number; // 0.1-0.2
}

class GeneticOptimizer {
  // Individual = color-to-slot assignment
  private generateRandomIndividual(): Assignment;

  // Fitness = inverse of total cost (swaps + color distance + material penalties)
  private calculateFitness(individual: Assignment): number;

  // Crossover: combine two parent assignments
  private crossover(parent1: Assignment, parent2: Assignment): Assignment[];

  // Mutation: randomly reassign colors to different slots
  private mutate(individual: Assignment): Assignment;
}
```

### 4. Machine Learning Clustering

#### K-Means Color Clustering:

```typescript
class MLClusteringOptimizer {
  // Cluster colors by similarity in LAB space
  private clusterColors(colors: Color[], numClusters: number): ColorCluster[];

  // Assign clusters to slots optimally
  private assignClustersToSlots(clusters: ColorCluster[]): SlotOptimizationResult;
}
```

#### DBSCAN for Irregular Distributions:

- Automatically determine number of color groups
- Handle outlier colors (special materials)
- Density-based clustering in perceptual color space

### 5. Multi-Criteria Decision Making (TOPSIS)

#### Criteria Matrix:

```typescript
interface OptimizationCriteria {
  colorSimilarity: number; // Lower is better
  materialCompatibility: number; // Higher is better
  swapMinimization: number; // Lower is better
  printSequenceOptimality: number; // Higher is better
}

interface CriteriaWeights {
  colorAccuracy: number; // 0-1, sum to 1.0
  materialSafety: number;
  printEfficiency: number;
  userPreference: number;
}
```

## Performance Targets

### Speed Improvements

- **Color Matching**: 2-3x faster through spatial indexing
- **Small Sets (≤8 colors)**: Sub-100ms optimization
- **Medium Sets (9-15 colors)**: Sub-500ms optimization
- **Large Sets (16+ colors)**: Progressive results within 2 seconds

### Memory Optimization

- **50% reduction** in memory usage for large files
- **Streaming processing** for very large G-code files
- **Garbage collection optimization** for long-running sessions

### Scalability Targets

- **Support 25+ colors** efficiently
- **Multiple AMS units** (up to 4 units = 16 slots)
- **Real-time optimization** for interactive editing

## Testing Strategy

### Unit Tests

- **Color Conversion Accuracy**: Verify RGB ↔ LAB transformations
- **Distance Metric Validation**: Test against known color difference datasets
- **Algorithm Correctness**: Verify optimization results for known cases
- **Edge Case Handling**: Test boundary conditions and error cases

### Integration Tests

- **End-to-End Optimization**: Full workflow from G-code to assignments
- **Algorithm Comparison**: Verify all algorithms produce valid results
- **Performance Regression**: Ensure optimizations don't break functionality
- **UI Integration**: Test configuration interface and user controls

### Performance Benchmarks

- **Speed Comparison**: All algorithms across different color set sizes
- **Memory Usage**: Peak and average memory consumption
- **Accuracy Metrics**: Quality of assignments vs manual expert results
- **Real-World Scenarios**: Actual G-code files from different slicers

### Validation Datasets

- **Color Difference Standards**: Munsell color system, Pantone samples
- **3D Printing Scenarios**: Miniatures, artistic prints, functional parts
- **Edge Cases**: Similar colors, transparent materials, metallic filaments
- **User Studies**: Subjective quality ratings from actual users

## Integration Plan

### Backward Compatibility

- **Existing API Preservation**: Current optimization interface unchanged
- **Gradual Migration**: Optional new algorithms alongside existing ones
- **Configuration Versioning**: Support old and new configuration formats
- **Fallback Mechanisms**: Revert to simple algorithms if advanced ones fail

### Configuration Migration

```typescript
// Enhanced OptimizationAlgorithm enum
enum OptimizationAlgorithm {
  Greedy = 'greedy', // Existing
  SimulatedAnnealing = 'simulatedAnnealing', // Existing
  Hungarian = 'hungarian', // New - optimal for small sets
  Genetic = 'genetic', // New - good for large sets
  MLClustering = 'mlClustering', // New - automatic grouping
  MultiCriteria = 'multiCriteria', // New - balanced optimization
  Hierarchical = 'hierarchical', // New - material-first
  Auto = 'auto', // New - intelligent selection
}
```

### User Interface Updates

- **Algorithm Selection Dropdown**: With recommendations
- **Performance vs Quality Slider**: Configure optimization trade-offs
- **Advanced Parameters Panel**: For expert users
- **Real-time Preview**: Show assignment updates as parameters change

### Deployment Strategy

1. **Feature Flag Rollout**: Enable new algorithms gradually
2. **A/B Testing**: Compare results between old and new algorithms
3. **User Feedback Collection**: Gather quality ratings and preferences
4. **Performance Monitoring**: Track optimization times and success rates
5. **Gradual Default Migration**: Switch default algorithm based on data

## Timeline & Resources

### Development Timeline (11 weeks)

- **Week 1-2**: Color science foundation
- **Week 3-5**: Advanced algorithms implementation
- **Week 6-7**: Performance optimizations
- **Week 8-9**: Testing and validation
- **Week 10-11**: Integration and configuration

### Resource Requirements

- **1 Senior Developer**: Algorithm implementation and optimization
- **Testing Support**: Validation scenarios and performance benchmarks
- **UI/UX Consultation**: Configuration interface design
- **3D Printing Expertise**: Material compatibility and real-world validation

### Risk Mitigation

- **Algorithm Complexity**: Start with simpler implementations, enhance iteratively
- **Performance Regression**: Comprehensive benchmarking at each phase
- **User Acceptance**: Early prototypes with user feedback loops
- **Integration Issues**: Maintain strict backward compatibility

### Success Metrics

- **Accuracy Improvement**: 25% better color matching using Delta E metrics
- **Performance Gain**: 2-3x faster optimization for typical use cases
- **User Satisfaction**: 80%+ preference for new algorithms in user studies
- **Edge Case Resolution**: 90% reduction in manual intervention requirements

## Conclusion

This comprehensive plan transforms the AMS color assignment system from a basic overlap-based approach to a sophisticated, multi-algorithm optimization platform. The proposed improvements address accuracy, performance, and usability while maintaining backward compatibility and providing clear migration paths.

The modular design allows for incremental implementation and testing, reducing risk while delivering measurable improvements at each phase. The end result will be a world-class color assignment system suitable for professional 3D printing workflows, from simple functional parts to complex artistic creations.

---

**Document Version**: 1.0  
**Last Updated**: 2025-06-27  
**Status**: Implementation Ready
