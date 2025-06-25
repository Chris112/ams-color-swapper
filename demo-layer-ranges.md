# Layer Range Feature Demo

## Overview

The AMS Color Swapper now shows layer ranges where users can pause their print for manual color swaps, instead of just showing a single layer number.

## Example Scenarios

### Scenario 1: Colors with Gaps

- **Red** (T0): Layers 0-30
- **Blue** (T1): Layers 60-100
- **Green** (T2): Layers 110-150

**Manual Swap Instructions:**

1. **Pause between layers 31-59** to swap from Red to Blue
   - This gives you a 29-layer window to pause the print
   - You can pause at any convenient layer in this range

2. **Pause between layers 101-109** to swap from Blue to Green
   - This gives you a 9-layer window to pause the print

### Scenario 2: Adjacent Colors (No Gap)

- **Red** (T0): Layers 0-30
- **Blue** (T1): Layers 31-60
- **Green** (T2): Layers 61-90

**Manual Swap Instructions:**

1. **Pause at layer 31** to swap from Red to Blue
   - Colors are adjacent, so you must pause exactly at this layer
2. **Pause at layer 61** to swap from Blue to Green
   - Colors are adjacent, so you must pause exactly at this layer

## Benefits

1. **Flexibility**: Users can pause at any layer within the range, allowing them to:
   - Finish the current layer if it's almost done
   - Pause at a convenient spot in the model
   - Time the pause when they're available to make the swap

2. **Clear Instructions**: The UI clearly shows:
   - "Pause between layers X-Y" when there's a gap
   - "Pause at layer Z" when colors are adjacent

3. **Better Planning**: Users can see exactly how much flexibility they have for each swap

## Technical Details

The system calculates:

- `pauseStartLayer` = Previous color's last layer + 1
- `pauseEndLayer` = Next color's first layer - 1

If `pauseEndLayer >= pauseStartLayer`, there's a valid range.
If not, the colors are adjacent and the swap must happen at the exact layer.
