import './main.css';
import { App } from './core/App';
import { disableConsoleInProduction } from './utils/consoleOverride';

// Disable all console output in production
disableConsoleInProduction();

// Extend window interface for debugging
declare global {
  interface Window {
    __app?: App;
  }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();

  // Store app instance for debugging (only in development)
  if (import.meta.env.DEV) {
    window.__app = app;
  }
});
