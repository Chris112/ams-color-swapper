import { StateSnapshot } from './MergeHistoryManager';

export enum TimelineState {
  EMPTY = 'EMPTY',
  INITIAL = 'INITIAL',
  NAVIGATING = 'NAVIGATING',
  AT_SNAPSHOT = 'AT_SNAPSHOT',
  BRANCHING = 'BRANCHING',
  MERGING = 'MERGING',
  EXPORTING = 'EXPORTING',
  IMPORTING = 'IMPORTING',
}

export enum TimelineAction {
  INITIALIZE = 'INITIALIZE',
  ADD_MERGE = 'ADD_MERGE',
  UNDO = 'UNDO',
  REDO = 'REDO',
  JUMP_TO = 'JUMP_TO',
  RESET = 'RESET',
  CREATE_BRANCH = 'CREATE_BRANCH',
  SWITCH_BRANCH = 'SWITCH_BRANCH',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
  CLEAR = 'CLEAR',
}

export interface TimelineContext {
  currentState: TimelineState;
  currentSnapshot?: StateSnapshot;
  currentBranch: string;
  canUndo: boolean;
  canRedo: boolean;
  isModified: boolean;
  error?: string;
}

export interface TimelineTransition {
  from: TimelineState[];
  action: TimelineAction;
  to: TimelineState;
  guard?: (context: TimelineContext) => boolean;
  effect?: (context: TimelineContext) => void;
}

export class TimelineStateMachine {
  private currentState: TimelineState = TimelineState.EMPTY;
  private transitions: Map<string, TimelineTransition> = new Map();
  private context: TimelineContext = {
    currentState: TimelineState.EMPTY,
    currentBranch: 'main',
    canUndo: false,
    canRedo: false,
    isModified: false,
  };

  constructor() {
    this.defineTransitions();
  }

  private defineTransitions(): void {
    // Define all valid state transitions
    const transitions: TimelineTransition[] = [
      // Initialization
      {
        from: [TimelineState.EMPTY],
        action: TimelineAction.INITIALIZE,
        to: TimelineState.INITIAL,
      },

      // Adding merges
      {
        from: [TimelineState.INITIAL, TimelineState.AT_SNAPSHOT],
        action: TimelineAction.ADD_MERGE,
        to: TimelineState.MERGING,
      },
      {
        from: [TimelineState.MERGING],
        action: TimelineAction.ADD_MERGE,
        to: TimelineState.AT_SNAPSHOT,
        effect: (ctx) => {
          ctx.isModified = true;
          ctx.canUndo = true;
        },
      },

      // Navigation
      {
        from: [TimelineState.AT_SNAPSHOT, TimelineState.INITIAL],
        action: TimelineAction.UNDO,
        to: TimelineState.NAVIGATING,
        guard: (ctx) => ctx.canUndo,
      },
      {
        from: [TimelineState.NAVIGATING],
        action: TimelineAction.UNDO,
        to: TimelineState.AT_SNAPSHOT,
        effect: (ctx) => {
          ctx.canRedo = true;
        },
      },

      {
        from: [TimelineState.AT_SNAPSHOT],
        action: TimelineAction.REDO,
        to: TimelineState.NAVIGATING,
        guard: (ctx) => ctx.canRedo,
      },
      {
        from: [TimelineState.NAVIGATING],
        action: TimelineAction.REDO,
        to: TimelineState.AT_SNAPSHOT,
      },

      {
        from: [TimelineState.AT_SNAPSHOT, TimelineState.INITIAL],
        action: TimelineAction.JUMP_TO,
        to: TimelineState.NAVIGATING,
      },
      {
        from: [TimelineState.NAVIGATING],
        action: TimelineAction.JUMP_TO,
        to: TimelineState.AT_SNAPSHOT,
      },

      {
        from: [TimelineState.AT_SNAPSHOT, TimelineState.INITIAL],
        action: TimelineAction.RESET,
        to: TimelineState.INITIAL,
        effect: (ctx) => {
          ctx.canUndo = false;
          ctx.canRedo = false;
        },
      },

      // Branching
      {
        from: [TimelineState.AT_SNAPSHOT, TimelineState.INITIAL],
        action: TimelineAction.CREATE_BRANCH,
        to: TimelineState.BRANCHING,
      },
      {
        from: [TimelineState.BRANCHING],
        action: TimelineAction.CREATE_BRANCH,
        to: TimelineState.AT_SNAPSHOT,
        effect: (ctx) => {
          ctx.isModified = true;
        },
      },

      {
        from: [TimelineState.AT_SNAPSHOT, TimelineState.INITIAL],
        action: TimelineAction.SWITCH_BRANCH,
        to: TimelineState.NAVIGATING,
      },
      {
        from: [TimelineState.NAVIGATING],
        action: TimelineAction.SWITCH_BRANCH,
        to: TimelineState.AT_SNAPSHOT,
      },

      // Import/Export
      {
        from: [TimelineState.AT_SNAPSHOT, TimelineState.INITIAL, TimelineState.EMPTY],
        action: TimelineAction.EXPORT,
        to: TimelineState.EXPORTING,
      },
      {
        from: [TimelineState.EXPORTING],
        action: TimelineAction.EXPORT,
        to: TimelineState.AT_SNAPSHOT,
      },

      {
        from: [TimelineState.EMPTY, TimelineState.AT_SNAPSHOT, TimelineState.INITIAL],
        action: TimelineAction.IMPORT,
        to: TimelineState.IMPORTING,
      },
      {
        from: [TimelineState.IMPORTING],
        action: TimelineAction.IMPORT,
        to: TimelineState.AT_SNAPSHOT,
        effect: (ctx) => {
          ctx.isModified = false;
        },
      },

      // Clear
      {
        from: [TimelineState.AT_SNAPSHOT, TimelineState.INITIAL],
        action: TimelineAction.CLEAR,
        to: TimelineState.EMPTY,
        effect: (ctx) => {
          ctx.canUndo = false;
          ctx.canRedo = false;
          ctx.isModified = false;
          ctx.currentSnapshot = undefined;
        },
      },
    ];

    // Store transitions in map for quick lookup
    transitions.forEach((transition) => {
      transition.from.forEach((fromState) => {
        const key = this.getTransitionKey(fromState, transition.action);
        this.transitions.set(key, transition);
      });
    });
  }

  private getTransitionKey(state: TimelineState, action: TimelineAction): string {
    return `${state}:${action}`;
  }

  public canPerformAction(action: TimelineAction): boolean {
    const key = this.getTransitionKey(this.currentState, action);
    const transition = this.transitions.get(key);

    if (!transition) {
      return false;
    }

    if (transition.guard) {
      return transition.guard(this.context);
    }

    return true;
  }

  public performAction(action: TimelineAction): boolean {
    const key = this.getTransitionKey(this.currentState, action);
    const transition = this.transitions.get(key);

    if (!transition) {
      console.warn(`Invalid transition: ${this.currentState} -> ${action}`);
      return false;
    }

    if (transition.guard && !transition.guard(this.context)) {
      console.warn(`Guard prevented transition: ${this.currentState} -> ${action}`);
      return false;
    }

    // Update state
    const previousState = this.currentState;
    this.currentState = transition.to;
    this.context.currentState = transition.to;

    // Execute side effects
    if (transition.effect) {
      transition.effect(this.context);
    }

    console.log(`Timeline state transition: ${previousState} -> ${this.currentState} (${action})`);
    return true;
  }

  public getCurrentState(): TimelineState {
    return this.currentState;
  }

  public getContext(): Readonly<TimelineContext> {
    return { ...this.context };
  }

  public updateContext(updates: Partial<TimelineContext>): void {
    this.context = { ...this.context, ...updates };
  }

  public reset(): void {
    this.currentState = TimelineState.EMPTY;
    this.context = {
      currentState: TimelineState.EMPTY,
      currentBranch: 'main',
      canUndo: false,
      canRedo: false,
      isModified: false,
    };
  }

  public getAvailableActions(): TimelineAction[] {
    const actions: TimelineAction[] = [];

    Object.values(TimelineAction).forEach((action) => {
      if (this.canPerformAction(action)) {
        actions.push(action);
      }
    });

    return actions;
  }

  public isInState(...states: TimelineState[]): boolean {
    return states.includes(this.currentState);
  }

  public validateStateIntegrity(): boolean {
    // Check for any inconsistencies in the state
    const validations = [
      // Can't have redo without previous undo
      !(this.context.canRedo && !this.context.canUndo),
      // Must have a snapshot when not in EMPTY or INITIAL states
      !(
        !this.context.currentSnapshot &&
        !this.isInState(TimelineState.EMPTY, TimelineState.INITIAL, TimelineState.NAVIGATING)
      ),
      // Can't be modified without any operations
      !(this.context.isModified && this.isInState(TimelineState.EMPTY, TimelineState.INITIAL)),
    ];

    return validations.every((v) => v);
  }
}
