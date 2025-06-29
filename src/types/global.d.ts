// Global type extensions

declare global {
  interface Window {
    // Functions added by ResultsView for onclick handlers
    toggleConstraintDetails?: (button: HTMLElement) => void;
    copyToClipboard?: (button: HTMLElement, text: string) => Promise<void>;
  }
}

export {}; // Make this a module
