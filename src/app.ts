import './main.css';
import { App } from './core/App';

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  
  // Store app instance for debugging
  (window as any).__app = app;
});