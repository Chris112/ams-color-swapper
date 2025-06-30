# IndexedDB Deletion Fix

## Problem
The Clear Cache button was not properly deleting IndexedDB databases on the first press. The console showed:
```
Delete of IndexedDB database 'ams-gcode-cache' was blocked
Delete of IndexedDB database 'ams-timeline-db' was blocked
```

This happens because IndexedDB deletion is blocked when there are active connections to the database.

## Solution
Added functionality to close database connections before attempting deletion:

1. **Added close() method to GcodeCache** (`src/services/GcodeCache.ts:259-265`):
   ```typescript
   close(): void {
     if (this.db) {
       this.db.close();
       this.db = null;
     }
   }
   ```

2. **Added close() method to TimelineRepository** (`src/repositories/TimelineRepository.ts:364-370`):
   ```typescript
   close(): void {
     if (this.db) {
       this.db.close();
       this.db = null;
     }
   }
   ```

3. **Updated ClearCacheCommand** to close connections before deletion:
   - Added imports for `gcodeCache` and `appState`
   - Added `closeDatabaseConnections()` method that:
     - Closes the gcodeCache connection
     - Accesses the timeline repository through the MergeHistoryManager and closes it
   - Calls `closeDatabaseConnections()` before attempting to delete databases

## Result
Now when the Clear Cache button is clicked:
1. Active database connections are closed
2. IndexedDB databases can be deleted successfully
3. The "blocked" messages no longer appear
4. All caches are cleared as expected

## Technical Notes
- The fix uses reflection to access the private `timelineRepository` from `MergeHistoryManager`
- This is safe since we're within the same codebase/module
- The deletion still gracefully handles the "blocked" case (resolves instead of rejects)
- Error handling ensures the operation continues even if closing connections fails