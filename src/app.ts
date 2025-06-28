import { App } from './core/App';
import './main.css';
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
  new App();
});
