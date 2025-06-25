import { IFileRepository } from './interfaces';
import { Result, FileError } from '../types';
import { generateCacheKey } from '../utils/hash';

export class FileRepository implements IFileRepository {
  async readAsText(file: File): Promise<Result<string>> {
    try {
      const content = await file.text();
      return Result.ok(content);
    } catch (error) {
      return Result.err(
        new FileError(
          `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          file.name,
          error
        )
      );
    }
  }

  async calculateHash(file: File): Promise<Result<string>> {
    try {
      // Use the new cache key generator that includes algorithm version
      const cacheKey = await generateCacheKey(file);
      return Result.ok(cacheKey);
    } catch (error) {
      return Result.err(
        new FileError(
          `Failed to calculate file hash: ${error instanceof Error ? error.message : 'Unknown error'}`,
          file.name,
          error
        )
      );
    }
  }

  downloadFile(content: string, fileName: string, mimeType: string): Result<void> {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      
      return Result.ok(undefined);
    } catch (error) {
      return Result.err(
        new FileError(
          `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          fileName,
          error
        )
      );
    }
  }
}