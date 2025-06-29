import { GcodeParser } from '../parser/gcodeParser';
import { Logger } from '../utils/logger';
import type { ParserWorkerRequest } from '../types/worker';

// Web Worker for parsing G-code files in a background thread
let parser: GcodeParser;
let logger: Logger;

// Initialize parser and logger once
function initialize(onProgress?: (progress: number, message: string) => void) {
  if (!parser || onProgress) {
    logger = new Logger('ParserWorker');
    parser = new GcodeParser(logger, onProgress);
  }
}

// Handle messages from the main thread
self.addEventListener('message', async (event: MessageEvent<ParserWorkerRequest>) => {
  const { type } = event.data;

  switch (type) {
    case 'parse':
      try {
        // Create progress callback
        const progressCallback = (progress: number, message: string) => {
          self.postMessage({
            type: 'progress',
            payload: { progress, message },
          });
        };

        initialize(progressCallback);

        const { fileContent, fileName } = event.data.payload;

        // Create a fake File object for the parser
        const blob = new Blob([fileContent], { type: 'text/plain' });
        const file = new File([blob], fileName, { type: 'text/plain' });

        // Parse the file with real progress tracking
        const stats = await parser.parse(file);

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
