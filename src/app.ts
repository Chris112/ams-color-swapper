import { App } from './core/App';
import './main.css';
import { disableConsoleInProduction } from './utils/consoleOverride';

// Disable all console output in production
disableConsoleInProduction();

// Extend window interface for debugging
declare global {
  interface Window {
    __app?: App;
    debugFilamentDB?: {
      clearSyncState: () => void;
      forceSync: () => void;
      getStatus: () => Promise<void>;
    };
  }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();

  // Expose debug methods to global scope (development only)
  if (import.meta.env.DEV) {
    window.__app = app;
    window.debugFilamentDB = {
      clearSyncState: () => app.debugClearFilamentSyncState(),
      forceSync: () => app.debugForceFilamentSync(),
      getStatus: () => app.debugGetFilamentStatus(),
    };

    console.log('%c🔧 Debug tools available:', 'color: #00ff00; font-weight: bold');
    console.log('• window.debugFilamentDB.clearSyncState() - Clear stuck sync state');
    console.log('• window.debugFilamentDB.forceSync() - Force start sync');
    console.log('• window.debugFilamentDB.getStatus() - Get current status');
  }
});
