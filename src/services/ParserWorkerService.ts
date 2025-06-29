import { GcodeStats } from '../types/gcode';
import { DebugLog } from '../types/logging';

export interface ParseResult {
  stats: GcodeStats;
  logs: DebugLog[];
}

export class ParserWorkerService {
  private worker: Worker | null = null;

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker(): void {
    try {
      // Create worker with proper Vite syntax
      this.worker = new Worker(new URL('../workers/parserWorker.ts', import.meta.url), {
        type: 'module',
      });
    } catch (error) {
      console.error('Failed to create Web Worker:', error);
    }
  }

  async parse(
    file: File,
    onProgress?: (progress: number, message: string) => void
  ): Promise<ParseResult> {
    if (!this.worker) {
      throw new Error('Web Worker not available');
    }

    return new Promise((resolve, reject) => {
      const handleMessage = (event: MessageEvent) => {
        const { type, payload } = event.data;

        switch (type) {
          case 'progress':
            if (onProgress) {
              onProgress(payload.progress, payload.message);
            }
            break;

          case 'complete':
            this.worker!.removeEventListener('message', handleMessage);
            resolve(payload);
            break;

          case 'error':
            this.worker!.removeEventListener('message', handleMessage);
            reject(new Error(payload.message));
            break;
        }
      };

      this.worker?.addEventListener('message', handleMessage);

      // Read file content and send to worker
      const reader = new FileReader();
      reader.onload = () => {
        this.worker!.postMessage({
          type: 'parse',
          payload: {
            fileContent: reader.result,
            fileName: file.name,
            fileSize: file.size,
          },
        });
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsText(file);
    });
  }

  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

// Singleton instance
export const parserWorkerService = new ParserWorkerService();
