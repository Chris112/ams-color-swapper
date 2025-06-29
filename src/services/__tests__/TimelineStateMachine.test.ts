import { describe, it, expect, beforeEach } from 'vitest';
import { TimelineStateMachine, TimelineState, TimelineAction } from '../TimelineStateMachine';

describe('TimelineStateMachine', () => {
  let stateMachine: TimelineStateMachine;

  beforeEach(() => {
    stateMachine = new TimelineStateMachine();
  });

  describe('Initial State', () => {
    it('should start in EMPTY state', () => {
      expect(stateMachine.getCurrentState()).toBe(TimelineState.EMPTY);
    });

    it('should have correct initial context', () => {
      const context = stateMachine.getContext();
      expect(context.currentState).toBe(TimelineState.EMPTY);
      expect(context.currentBranch).toBe('main');
      expect(context.canUndo).toBe(false);
      expect(context.canRedo).toBe(false);
      expect(context.isModified).toBe(false);
    });
  });

  describe('INITIALIZE transition', () => {
    it('should allow INITIALIZE from EMPTY state', () => {
      expect(stateMachine.canPerformAction(TimelineAction.INITIALIZE)).toBe(true);
    });

    it('should transition from EMPTY to INITIAL on INITIALIZE', () => {
      const result = stateMachine.performAction(TimelineAction.INITIALIZE);
      expect(result).toBe(true);
      expect(stateMachine.getCurrentState()).toBe(TimelineState.INITIAL);
    });

    it('should not allow INITIALIZE from non-EMPTY states', () => {
      stateMachine.performAction(TimelineAction.INITIALIZE); // EMPTY -> INITIAL
      expect(stateMachine.canPerformAction(TimelineAction.INITIALIZE)).toBe(false);
    });
  });

  describe('ADD_MERGE transitions', () => {
    beforeEach(() => {
      stateMachine.performAction(TimelineAction.INITIALIZE); // EMPTY -> INITIAL
    });

    it('should allow ADD_MERGE from INITIAL state', () => {
      expect(stateMachine.canPerformAction(TimelineAction.ADD_MERGE)).toBe(true);
    });

    it('should transition INITIAL -> MERGING -> AT_SNAPSHOT on double ADD_MERGE', () => {
      // First ADD_MERGE: INITIAL -> MERGING
      const result1 = stateMachine.performAction(TimelineAction.ADD_MERGE);
      expect(result1).toBe(true);
      expect(stateMachine.getCurrentState()).toBe(TimelineState.MERGING);

      // Second ADD_MERGE: MERGING -> AT_SNAPSHOT
      const result2 = stateMachine.performAction(TimelineAction.ADD_MERGE);
      expect(result2).toBe(true);
      expect(stateMachine.getCurrentState()).toBe(TimelineState.AT_SNAPSHOT);
    });

    it('should not allow ADD_MERGE from EMPTY state', () => {
      stateMachine.reset(); // Back to EMPTY
      expect(stateMachine.canPerformAction(TimelineAction.ADD_MERGE)).toBe(false);
    });

    it('should allow ADD_MERGE from AT_SNAPSHOT state', () => {
      // Get to AT_SNAPSHOT state
      stateMachine.performAction(TimelineAction.ADD_MERGE); // INITIAL -> MERGING
      stateMachine.performAction(TimelineAction.ADD_MERGE); // MERGING -> AT_SNAPSHOT

      expect(stateMachine.canPerformAction(TimelineAction.ADD_MERGE)).toBe(true);
    });
  });

  describe('Navigation transitions', () => {
    beforeEach(() => {
      // Set up a state with undo/redo capability
      stateMachine.performAction(TimelineAction.INITIALIZE);
      stateMachine.performAction(TimelineAction.ADD_MERGE);
      stateMachine.performAction(TimelineAction.ADD_MERGE);
      stateMachine.updateContext({ canUndo: true, canRedo: false });
    });

    it('should allow UNDO when canUndo is true', () => {
      expect(stateMachine.canPerformAction(TimelineAction.UNDO)).toBe(true);
    });

    it('should transition AT_SNAPSHOT -> NAVIGATING -> AT_SNAPSHOT on UNDO', () => {
      const result1 = stateMachine.performAction(TimelineAction.UNDO);
      expect(result1).toBe(true);
      expect(stateMachine.getCurrentState()).toBe(TimelineState.NAVIGATING);

      const result2 = stateMachine.performAction(TimelineAction.UNDO);
      expect(result2).toBe(true);
      expect(stateMachine.getCurrentState()).toBe(TimelineState.AT_SNAPSHOT);
    });

    it('should not allow UNDO when canUndo is false', () => {
      stateMachine.updateContext({ canUndo: false });
      expect(stateMachine.canPerformAction(TimelineAction.UNDO)).toBe(false);
    });
  });

  describe('RESET transitions', () => {
    it('should allow RESET from INITIAL state', () => {
      stateMachine.performAction(TimelineAction.INITIALIZE);
      expect(stateMachine.canPerformAction(TimelineAction.RESET)).toBe(true);
    });

    it('should allow RESET from AT_SNAPSHOT state', () => {
      stateMachine.performAction(TimelineAction.INITIALIZE);
      stateMachine.performAction(TimelineAction.ADD_MERGE);
      stateMachine.performAction(TimelineAction.ADD_MERGE);
      expect(stateMachine.canPerformAction(TimelineAction.RESET)).toBe(true);
    });

    it('should transition to INITIAL state on RESET', () => {
      stateMachine.performAction(TimelineAction.INITIALIZE);
      stateMachine.performAction(TimelineAction.ADD_MERGE);
      stateMachine.performAction(TimelineAction.ADD_MERGE);

      const result = stateMachine.performAction(TimelineAction.RESET);
      expect(result).toBe(true);
      expect(stateMachine.getCurrentState()).toBe(TimelineState.INITIAL);
    });

    it('should reset undo/redo capabilities on RESET', () => {
      stateMachine.performAction(TimelineAction.INITIALIZE);
      stateMachine.updateContext({ canUndo: true, canRedo: true });

      stateMachine.performAction(TimelineAction.RESET);

      const context = stateMachine.getContext();
      expect(context.canUndo).toBe(false);
      expect(context.canRedo).toBe(false);
    });
  });

  describe('CLEAR transitions', () => {
    it('should allow CLEAR from INITIAL state', () => {
      stateMachine.performAction(TimelineAction.INITIALIZE);
      expect(stateMachine.canPerformAction(TimelineAction.CLEAR)).toBe(true);
    });

    it('should allow CLEAR from AT_SNAPSHOT state', () => {
      stateMachine.performAction(TimelineAction.INITIALIZE);
      stateMachine.performAction(TimelineAction.ADD_MERGE);
      stateMachine.performAction(TimelineAction.ADD_MERGE);
      expect(stateMachine.canPerformAction(TimelineAction.CLEAR)).toBe(true);
    });

    it('should not allow CLEAR from EMPTY state', () => {
      expect(stateMachine.canPerformAction(TimelineAction.CLEAR)).toBe(false);
    });

    it('should not allow CLEAR from MERGING state', () => {
      stateMachine.performAction(TimelineAction.INITIALIZE);
      stateMachine.performAction(TimelineAction.ADD_MERGE); // Now in MERGING
      expect(stateMachine.canPerformAction(TimelineAction.CLEAR)).toBe(false);
    });

    it('should transition to EMPTY state on CLEAR', () => {
      stateMachine.performAction(TimelineAction.INITIALIZE);

      const result = stateMachine.performAction(TimelineAction.CLEAR);
      expect(result).toBe(true);
      expect(stateMachine.getCurrentState()).toBe(TimelineState.EMPTY);
    });
  });

  describe('Invalid transitions', () => {
    it('should not allow invalid transitions and return false', () => {
      // Try to add merge from EMPTY (should fail)
      const result = stateMachine.performAction(TimelineAction.ADD_MERGE);
      expect(result).toBe(false);
      expect(stateMachine.getCurrentState()).toBe(TimelineState.EMPTY);
    });

    it('should preserve state on failed transitions', () => {
      stateMachine.performAction(TimelineAction.INITIALIZE);
      const initialState = stateMachine.getCurrentState();

      // Try invalid action
      const result = stateMachine.performAction(TimelineAction.INITIALIZE);
      expect(result).toBe(false);
      expect(stateMachine.getCurrentState()).toBe(initialState);
    });
  });

  describe('Context updates', () => {
    it('should update context properties', () => {
      stateMachine.updateContext({
        canUndo: true,
        canRedo: true,
        isModified: true,
        currentBranch: 'test-branch',
      });

      const context = stateMachine.getContext();
      expect(context.canUndo).toBe(true);
      expect(context.canRedo).toBe(true);
      expect(context.isModified).toBe(true);
      expect(context.currentBranch).toBe('test-branch');
    });

    it('should preserve existing context when updating partial properties', () => {
      stateMachine.updateContext({ canUndo: true });
      stateMachine.updateContext({ canRedo: true });

      const context = stateMachine.getContext();
      expect(context.canUndo).toBe(true);
      expect(context.canRedo).toBe(true);
      expect(context.currentBranch).toBe('main'); // Should preserve original
    });
  });

  describe('Available actions', () => {
    it('should return correct available actions for each state', () => {
      // EMPTY state
      let actions = stateMachine.getAvailableActions();
      expect(actions).toContain(TimelineAction.INITIALIZE);
      expect(actions).not.toContain(TimelineAction.ADD_MERGE);

      // INITIAL state
      stateMachine.performAction(TimelineAction.INITIALIZE);
      actions = stateMachine.getAvailableActions();
      expect(actions).toContain(TimelineAction.ADD_MERGE);
      expect(actions).toContain(TimelineAction.RESET);
      expect(actions).toContain(TimelineAction.CLEAR);
      expect(actions).not.toContain(TimelineAction.INITIALIZE);
    });
  });

  describe('State validation', () => {
    it('should validate state integrity', () => {
      expect(stateMachine.validateStateIntegrity()).toBe(true);
    });

    it('should detect invalid state combinations', () => {
      // Set up invalid state (canRedo without canUndo)
      stateMachine.updateContext({ canRedo: true, canUndo: false });
      expect(stateMachine.validateStateIntegrity()).toBe(false);
    });
  });

  describe('Reset functionality', () => {
    it('should reset to initial state and context', () => {
      // Modify state and context
      stateMachine.performAction(TimelineAction.INITIALIZE);
      stateMachine.updateContext({
        canUndo: true,
        canRedo: true,
        isModified: true,
        currentBranch: 'test',
      });

      // Reset
      stateMachine.reset();

      // Verify reset
      expect(stateMachine.getCurrentState()).toBe(TimelineState.EMPTY);
      const context = stateMachine.getContext();
      expect(context.currentBranch).toBe('main');
      expect(context.canUndo).toBe(false);
      expect(context.canRedo).toBe(false);
      expect(context.isModified).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple consecutive same actions gracefully', () => {
      stateMachine.performAction(TimelineAction.INITIALIZE);

      // Try to initialize again (should fail)
      const result = stateMachine.performAction(TimelineAction.INITIALIZE);
      expect(result).toBe(false);
      expect(stateMachine.getCurrentState()).toBe(TimelineState.INITIAL);
    });

    it('should handle state checks during transitions', () => {
      expect(stateMachine.isInState(TimelineState.EMPTY)).toBe(true);
      expect(stateMachine.isInState(TimelineState.INITIAL)).toBe(false);

      stateMachine.performAction(TimelineAction.INITIALIZE);

      expect(stateMachine.isInState(TimelineState.EMPTY)).toBe(false);
      expect(stateMachine.isInState(TimelineState.INITIAL)).toBe(true);
      expect(stateMachine.isInState(TimelineState.EMPTY, TimelineState.INITIAL)).toBe(true);
    });
  });
});
