import './main.css';
import { App } from './core/App';

// Extend window interface for debugging
declare global {
  interface Window {
    __app?: App;
  }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  
  // Store app instance for debugging
  window.__app = app;
});