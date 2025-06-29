## Meta-Prompting Strategy

When facing complex refactoring or debugging tasks, consider using the self-referential prompting pattern:

Instead of directly asking for a solution, ask Claude to:

1. First create a detailed prompt for the task
2. Show the improved prompt
3. Then execute that prompt

### Example Template:

I need help with: [problem description]

But first, create a detailed prompt for yourself about how to properly address this issue, including:

- Clear requirements breakdown
- Edge cases to consider
- Implementation approach
- Testing considerations
- Output format

Show me the prompt you created, then execute it.

### Why This Works:

- Forces systematic thinking before implementation
- Identifies edge cases upfront
- Creates better documented solutions
- Acts as self-review process

### Good Use Cases:

- Refactoring with many moving parts
- Debugging unclear issues
- Implementing features with unclear requirements
- Code cleanup and optimization tasks

### Project-Specific Patterns:

For UI fixes: Always have Claude check theme compatibility and responsive behavior
For refactoring: Have Claude validate tests still make sense
For cleanup: Have Claude identify actual usage before removing "unused" code
