import { GcodeParser } from '../parser/gcodeParser';
import { Logger } from '../utils/logger';

// Web Worker for parsing G-code files in a background thread
let parser: GcodeParser;
let logger: Logger;

// Initialize parser and logger once
function initialize() {
  if (!parser) {
    logger = new Logger();
    parser = new GcodeParser(logger);
  }
}

// Handle messages from the main thread
self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'parse':
      try {
        initialize();

        const { fileContent, fileName } = payload;

        // Create a fake File object for the parser
        const blob = new Blob([fileContent], { type: 'text/plain' });
        const file = new File([blob], fileName, { type: 'text/plain' });

        // Send progress updates
        let lastProgress = 0;
        const progressInterval = setInterval(() => {
          lastProgress = Math.min(lastProgress + 10, 90);
          self.postMessage({
            type: 'progress',
            payload: {
              progress: lastProgress,
              message:
                lastProgress < 30
                  ? 'Reading file...'
                  : lastProgress < 60
                    ? 'Parsing G-code...'
                    : 'Analyzing colors...',
            },
          });
        }, 200);

        // Parse the file
        const stats = await parser.parse(file);

        clearInterval(progressInterval);

        // Get logs
        const logs = logger.getLogs();

        // Send results back to main thread
        self.postMessage({
          type: 'complete',
          payload: {
            stats,
            logs,
          },
        });
      } catch (error) {
        self.postMessage({
          type: 'error',
          payload: {
            message: error instanceof Error ? error.message : 'Unknown error occurred',
          },
        });
      }
      break;

    case 'clear':
      // Clear logs if needed
      if (logger) {
        logger.clearLogs();
      }
      break;
  }
});

// Export type for TypeScript
export {};
