# Refactoring Plan: Multiple AMS Units and Toolheads Support

## Overview

This document outlines the plan to refactor the AMS Color Swapper application from supporting a single AMS unit with 4 slots to supporting multiple AMS units (up to 4 units = 16 slots) or individual toolheads (up to 16).

## Current State Analysis

### Hardcoded Limitations

- **Single AMS unit** with exactly 4 slots
- `AmsConfiguration.ts`: `MAX_SLOTS = 4` (line 11)
- `AmsSlot.ts`: Validation restricts slot numbers to 1-4 (line 106-108)
- UI templates display "AMS Slot 1-4" without consideration for multiple units
- Optimization algorithms (`ColorOverlapAnalyzer`) assume maximum 4 slots

### Key Files Affected

- `/src/domain/models/AmsConfiguration.ts`
- `/src/domain/models/AmsSlot.ts`
- `/src/services/OptimizationService.ts`
- `/src/domain/services/ColorOverlapAnalyzer.ts`
- `/src/ui/templates/index.ts`
- `/src/ui/components/ResultsView.ts`
- `/src/types/index.ts`

## Proposed Solution

### 1. Configuration Types

Support two hardware configurations:

- **AMS Units Mode**: 1-4 AMS units, each with 4 slots (4-16 total slots)
- **Toolhead Mode**: 1-16 individual toolheads

### 2. Domain Model Updates

#### AmsConfiguration.ts

```typescript
export class AmsConfiguration {
  private slots: Map<string, AmsSlot> = new Map();
  private configType: 'ams' | 'toolhead';
  private unitCount: number;
  private slotsPerUnit: number;

  constructor(
    configType: 'ams' | 'toolhead' = 'ams',
    unitCount: number = 1,
    strategy: 'legacy' | 'groups' | 'intervals' = 'intervals'
  ) {
    this.configType = configType;
    this.unitCount = unitCount;
    this.slotsPerUnit = configType === 'ams' ? 4 : 1;
    this.initializeSlots();
  }

  private initializeSlots(): void {
    for (let unit = 1; unit <= this.unitCount; unit++) {
      for (let slot = 1; slot <= this.slotsPerUnit; slot++) {
        const slotId = this.getSlotId(unit, slot);
        this.slots.set(slotId, new AmsSlot(unit, slot, true));
      }
    }
  }

  private getSlotId(unit: number, slot: number): string {
    return `${unit}-${slot}`;
  }
}
```

#### AmsSlot.ts

```typescript
export class AmsSlot {
  constructor(
    public readonly unitNumber: number,
    public readonly slotNumber: number,
    public readonly isPermanent: boolean = true
  ) {
    this.validate();
  }

  private validate(): void {
    // Dynamic validation based on parent configuration
    if (this.unitNumber < 1 || this.unitNumber > 16) {
      throw new Error('Unit number must be between 1 and 16');
    }
    if (this.slotNumber < 1 || this.slotNumber > 4) {
      throw new Error('Slot number must be between 1 and 4');
    }
  }

  get displayName(): string {
    return `Unit ${this.unitNumber} Slot ${this.slotNumber}`;
  }
}
```

### 3. Type System Updates

#### types/index.ts

```typescript
export interface SystemConfiguration {
  type: 'ams' | 'toolhead';
  unitCount: number;
  totalSlots: number;
}

export interface SlotAssignment {
  unit: number;
  slot: number;
  slotId: string;
  colors: string[];
  isPermanent: boolean;
}

export interface ManualSwap {
  unit: number;
  slot: number;
  fromColor: string;
  toColor: string;
  // ... existing properties
}
```

### 4. New Configuration UI Component

Create `/src/ui/components/ConfigurationSelector.ts`:

```typescript
export class ConfigurationSelector extends Component {
  // Renders:
  // - Radio buttons: "AMS Units" or "Individual Toolheads"
  // - Number input: quantity (with appropriate limits)
  // - Visual preview of slot layout
  // - Confirm button to apply configuration
}
```

### 5. UI Template Updates

Update slot display in `templates/index.ts`:

```typescript
// Group slots by unit for AMS mode
const slotsHtml =
  configType === 'ams'
    ? renderAmsUnits(slotAssignments, unitCount)
    : renderToolheads(slotAssignments);

function renderAmsUnits(slots: SlotAssignment[], units: number): string {
  // Group slots by unit and render each unit as a card
  // Show "AMS Unit 1", "AMS Unit 2", etc.
}

function renderToolheads(slots: SlotAssignment[]): string {
  // Render individual toolheads in a grid
  // Show "Toolhead 1", "Toolhead 2", etc.
}
```

### 6. Service Updates

#### OptimizationService.ts

```typescript
generateOptimization(stats: GcodeStats, config: SystemConfiguration): OptimizationResult {
  const print = PrintMapper.toDomain(stats);

  // Create AMS configuration with user's hardware setup
  const amsConfig = new AmsConfiguration(
    config.type,
    config.unitCount
  );

  amsConfig.assignColors(print.colors);
  // ... rest of optimization logic
}
```

### 7. Persistence

Store configuration in localStorage:

```typescript
interface StoredConfig {
  version: number;
  hardware: SystemConfiguration;
  lastUpdated: string;
}

// Save on configuration change
localStorage.setItem('ams-hardware-config', JSON.stringify(config));

// Load on app startup
const saved = localStorage.getItem('ams-hardware-config');
```

## Implementation Steps

### Phase 1: Foundation (Domain Models)

1. Update `AmsSlot` to support unit numbers
2. Update `AmsConfiguration` to support dynamic slot counts
3. Update type definitions

### Phase 2: Configuration UI

1. Create `ConfigurationSelector` component
2. Add configuration state to `AppState`
3. Integrate selector into main app flow

### Phase 3: Service Updates

1. Update `OptimizationService` to use configuration
2. Update `ColorOverlapAnalyzer` algorithms
3. Update mappers to handle new slot structure

### Phase 4: UI Updates

1. Update templates for dynamic slot display
2. Update `ResultsView` for multiple units
3. Update swap instructions with unit information

### Phase 5: Polish

1. Add configuration persistence
2. Add configuration reset option
3. Update documentation
4. Add migration for existing users

## Benefits

1. **Flexibility**: Support various hardware configurations without code changes
2. **Scalability**: Handle up to 16 slots for complex multi-color prints
3. **User Choice**: Let users match software to their actual hardware
4. **Future-Proof**: Easy to extend for new hardware types
5. **Backward Compatible**: Default to single AMS unit for existing users

## Testing Considerations

1. Test optimization algorithms with various slot counts
2. Ensure UI layout works well with 1-16 slots
3. Test configuration persistence and migration
4. Validate performance with maximum slot count
5. Test edge cases (1 slot, 16 slots, mixed configurations)

## Migration Strategy

For existing users:

1. Default to single AMS unit (current behavior)
2. Show one-time prompt about new configuration options
3. Allow easy switching between configurations
4. Preserve any saved optimization results
