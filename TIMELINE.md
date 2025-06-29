# Merge Timeline System Implementation Plan

## Overview

Implement a comprehensive timeline system that allows users to navigate through their merge history, explore different merge strategies, and find the optimal color configuration for their prints.

## Architecture

### 1. Core Components

#### 1.1 MergeHistoryManager (Already created)

- **Location**: `/src/services/MergeHistoryManager.ts`
- **Responsibilities**:
  - Store complete state snapshots at each merge point
  - Handle navigation (undo/redo/jump to snapshot)
  - Manage branches for exploring different merge paths
  - Persist/restore timeline data
  - Export/import timeline configurations

#### 1.2 MergeHistoryTimeline Component (New)

- **Location**: `/src/ui/components/MergeHistoryTimeline.ts`
- **Responsibilities**:
  - Visual timeline representation
  - Interactive navigation controls
  - Hover previews
  - Branch visualization
  - Timeline scrubber

#### 1.3 Enhanced AppState Integration

- **Updates to**: `/src/state/AppState.ts`
- **Add**:
  - `mergeHistoryManager` instance
  - Timeline navigation methods
  - Branch management state
  - Keyboard shortcut handlers

### 2. Implementation Steps

#### Step 1: Update AppState Integration

1. Import and instantiate `MergeHistoryManager` in `AppState`
2. Add methods:
   - `navigateToSnapshot(snapshotId: string)`
   - `undoMerge()`
   - `redoMerge()`
   - `createMergeBranch(name: string)`
   - `switchMergeBranch(name: string)`
3. Update `setAnalysisResults` to initialize timeline with initial state
4. Update `setMergedStats` to add snapshots to timeline
5. Add keyboard shortcut listeners for Ctrl+Z/Ctrl+Y

#### Step 2: Create MergeHistoryTimeline Component

1. Create visual timeline with:
   - Horizontal timeline bar
   - Nodes for each state (circles/diamonds)
   - Current position indicator
   - Branch visualization (if multiple branches)
   - Violation count badges on nodes
2. Add interactive elements:
   - Click nodes to jump to state
   - Hover for detailed preview
   - Drag scrubber for smooth navigation
   - Branch selection dropdown
3. Add control buttons:
   - Undo/Redo buttons
   - Reset to initial state
   - Create branch button
   - Timeline settings (show/hide details)

#### Step 3: Create Timeline Preview Component

1. Hover preview showing:
   - Merge summary (e.g., "Merged Pink → Light Pink")
   - Before/after color count
   - Violation count change
   - Available slots
   - Timestamp
2. Mini timeline view in preview
3. Quick action buttons (jump to this state)

#### Step 4: Update ResultsView Integration

1. Add timeline container to results template
2. Initialize `MergeHistoryTimeline` when results are shown
3. Connect timeline events to state updates
4. Update timeline when merges occur
5. Show/hide timeline based on merge history

#### Step 5: Update Core App Class

1. Add timeline navigation handlers
2. Connect keyboard shortcuts
3. Update merge flow to use history manager
4. Add timeline persistence on app destroy

#### Step 6: Add Branch Management UI

1. Branch selector dropdown
2. Create branch dialog
3. Branch comparison view
4. Merge branch functionality
5. Delete branch option

#### Step 7: Add Timeline Persistence

1. Auto-save timeline to localStorage
2. Export timeline as JSON
3. Import timeline from JSON
4. Share timeline via URL (encoded)
5. Clear timeline data option

### 3. UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Results View                                                │
├─────────────────────────────────────────────────────────────┤
│ [Timeline Controls]                                         │
│ [←] [→] [Reset] [Branch: main ▼] [+ New Branch] [Export]  │
├─────────────────────────────────────────────────────────────┤
│ Timeline:                                                   │
│                                                             │
│  ●───●───●───◆───●───●                                     │
│  7   6   5   2   1   0  <- Violation count                 │
│  │   │   │   │   │   │                                      │
│  │   │   │   │   │   └─ Initial (7 violations)             │
│  │   │   │   │   └───── Merged Green→Lime (1 violation)    │
│  │   │   │   └───────── Current: Blue→Navy (2 violations)  │
│  │   │   └───────────── Merged Pink→Rose (5 violations)    │
│  │   └───────────────── Branch: "experiment-1"             │
│  └───────────────────── Merged Yellow→Gold (6 violations)  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [Main Visualization Area]                                   │
└─────────────────────────────────────────────────────────────┘
```

### 4. Data Structures

#### StateSnapshot (Enhanced)

```typescript
interface StateSnapshot {
  id: string;
  timestamp: number;
  stats: GcodeStats;
  optimization: OptimizationResult;
  constraintValidation?: ConstraintValidationResult;
  mergeInfo?: {
    targetColorId: string;
    sourceColorIds: string[];
    freedSlots: string[];
    description: string;
  };
  parentId?: string;
  branchName?: string;
  // New fields
  violationCount: number;
  colorCount: number;
  thumbnail?: string; // Base64 mini visualization
}
```

### 5. User Interactions

1. **Keyboard Shortcuts**:
   - `Ctrl+Z`: Undo last merge
   - `Ctrl+Y`: Redo merge
   - `Ctrl+Shift+Z`: Open timeline view
   - `←/→`: Navigate timeline when focused
   - `Ctrl+B`: Create new branch

2. **Mouse Interactions**:
   - Click node: Jump to state
   - Hover node: Show preview
   - Drag timeline: Scrub through history
   - Right-click node: Context menu (branch from here, export state, etc.)

3. **Timeline Actions**:
   - Compare states side-by-side
   - Play animation through timeline
   - Export optimal path as merge plan
   - Share timeline configuration

### 6. Performance Optimizations

1. **State Storage**:
   - Store diffs instead of full snapshots after initial
   - Compress state data using LZ compression
   - Limit timeline to 50 states (configurable)
   - Lazy load state details on demand

2. **UI Rendering**:
   - Virtual scrolling for long timelines
   - Debounce hover previews
   - Cache rendered timeline nodes
   - Progressive timeline detail loading

### 7. Visual Design

1. **Timeline Nodes**:
   - Circle: Normal state
   - Diamond: Branch point
   - Star: Optimal state (0 violations)
   - Color coding: Green (good), Yellow (okay), Red (violations)

2. **Animations**:
   - Smooth transitions between states
   - Pulse effect on current node
   - Fade in/out for hover previews
   - Slide animation for timeline navigation

### 8. Error Handling

1. Handle corrupted timeline data
2. Recover from failed state restoration
3. Validate imported timeline data
4. Handle storage quota exceeded
5. Graceful degradation without timeline

### 9. Testing Strategy

1. Unit tests for MergeHistoryManager
2. Component tests for timeline UI
3. Integration tests for state navigation
4. Performance tests for large timelines
5. E2E tests for complete merge workflows

### 10. Future Enhancements

1. **AI-Powered Suggestions**:
   - Suggest optimal merge paths
   - Predict violation reduction
   - Learn from user preferences

2. **Collaborative Features**:
   - Share timelines with team
   - Merge timelines from multiple users
   - Comments on timeline nodes

3. **Advanced Visualization**:
   - 3D timeline view
   - Parallel timeline comparison
   - Heatmap of violation density

## Implementation Priority

1. **Phase 1** (Core Functionality):
   - MergeHistoryManager integration
   - Basic timeline UI
   - Undo/Redo functionality
   - State persistence

2. **Phase 2** (Enhanced Navigation):
   - Timeline scrubber
   - Hover previews
   - Keyboard shortcuts
   - Jump to snapshot

3. **Phase 3** (Branch Management):
   - Create/switch branches
   - Branch visualization
   - Branch comparison
   - Merge branches

4. **Phase 4** (Sharing & Export):
   - Export/Import timeline
   - Share via URL
   - Timeline templates
   - Collaboration features

## Success Metrics

1. Users can navigate history without fear
2. Average time to find optimal configuration reduced by 50%
3. User satisfaction with merge workflow increased
4. Support tickets related to "wrong merge" reduced by 80%
5. Timeline feature adoption rate > 70%

## Risk Mitigation

1. **Performance**: Implement progressive loading and state compression
2. **Complexity**: Start with simple linear timeline, add branches later
3. **Storage**: Implement cleanup strategies and user warnings
4. **User Confusion**: Provide interactive tutorial on first use
5. **Data Loss**: Auto-save and multiple backup strategies
