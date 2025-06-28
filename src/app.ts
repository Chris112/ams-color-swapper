import { App } from './core/App';
import './main.css';
import { disableConsoleInProduction } from './utils/consoleOverride';

// Disable all console output in production
disableConsoleInProduction();

// Extend window interface for debugging
declare global {
  interface Window {
    __app?: App;
    fillament?: {
      clearSyncState: () => void;
      forceSync: () => void;
      getStatus: () => Promise<void>;
      color: (hexColor: string) => Promise<void>;
    };
  }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();

  // Expose debug methods to global scope (development only)
  if (import.meta.env.DEV) {
    window.__app = app;
    window.fillament = {
      clearSyncState: () => app.debugClearFilamentSyncState(),
      forceSync: () => app.debugForceFilamentSync(),
      getStatus: () => app.debugGetFilamentStatus(),
      color: async (hexColor: string) => {
        const { FilamentDatabase } = await import('./services/FilamentDatabase');
        const db = FilamentDatabase.getInstance();
        if (!hexColor.startsWith('#')) {
          hexColor = '#' + hexColor;
        }
        await db.debugColorLookup(hexColor);
      },
    };

    console.log('%c🔧 Debug tools available:', 'color: #00ff00; font-weight: bold');
    console.log('• window.fillament.clearSyncState() - Clear stuck sync state');
    console.log('• window.fillament.forceSync() - Force start sync');
    console.log('• window.fillament.getStatus() - Get current status');
    console.log(
      '• window.fillament.color("#FF80C0") - Debug specific color lookup'
    );

    // ASCII art color debug message - programmatically generated for alignment
    const boxWidth = 70;
    const boxChar = '═';
    const vertChar = '║';
    const topLeft = '╔';
    const topRight = '╗';
    const bottomLeft = '╚';
    const bottomRight = '╝';
    const midLeft = '╠';
    const midRight = '╣';
    
    function padLine(text: string, width: number): string {
      // Account for emojis and special characters
      const visibleLength = text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu, '  ').length;
      const padding = Math.max(0, width - visibleLength - 4); // -4 for borders and spaces
      return `${vertChar}  ${text}${' '.repeat(padding)}  ${vertChar}`;
    }
    
    function makeLine(char: string, width: number): string {
      return char.repeat(width);
    }
    
    const lines = [
      topLeft + makeLine(boxChar, boxWidth) + topRight,
      padLine('🎨 COLOR DETECTIVE MODE 🔍', boxWidth),
      midLeft + makeLine(boxChar, boxWidth) + midRight,
      padLine('', boxWidth),
      padLine('Missing a color match? Let\'s investigate! 🕵️', boxWidth),
      padLine('', boxWidth),
      padLine('┌─────────────────────────────────────────────────────────┐', boxWidth),
      padLine('│  await window.fillament.color(\'#FF80C0\')                 │', boxWidth),
      padLine('└─────────────────────────────────────────────────────────┘', boxWidth),
      padLine('', boxWidth),
      padLine('This will reveal:', boxWidth),
      padLine('• Is the database ready? ✓', boxWidth),
      padLine('• How many colors are loaded? 📊', boxWidth),
      padLine('• Does your color exist? 🎯', boxWidth),
      padLine('• What\'s the closest match? 🔄', boxWidth),
      padLine('', boxWidth),
      padLine('Try it with any hex color!', boxWidth),
      padLine('', boxWidth),
      bottomLeft + makeLine(boxChar, boxWidth) + bottomRight
    ];
    
    console.log('\n%c' + lines.join('\n'), 'color: #FF80C0; font-family: monospace; line-height: 1.2');

    console.log('\n%cExample usage:', 'color: #00BFFF; font-weight: bold');
    console.log(
      "%c  await window.fillament.color('#FF0000')  // Check red",
      'color: #FF6B6B; font-family: monospace'
    );
    console.log(
      "%c  await window.fillament.color('#00FF00')  // Check green",
      'color: #51CF66; font-family: monospace'
    );
    console.log(
      "%c  await window.fillament.color('#0000FF')  // Check blue",
      'color: #5C7CFA; font-family: monospace'
    );
    console.log(
      "%c  await window.fillament.color('#FF80C0')  // Check pink",
      'color: #FF80C0; font-family: monospace'
    );
  }
});
