import { IFileRepository } from './interfaces';
import { Result, FileError } from '../types';

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
      // Create a hash using file metadata as a simple implementation
      // For production, you might want to use Web Crypto API with actual file content
      const hashData = `${file.name}-${file.size}-${file.lastModified}`;
      
      // Use Web Crypto API for better hashing
      const encoder = new TextEncoder();
      const data = encoder.encode(hashData);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return Result.ok(hashHex);
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