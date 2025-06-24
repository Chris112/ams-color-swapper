import { describe, it, expect, vi } from 'vitest';
import { generateFileHash, generateQuickHash } from '../hash';

// Mock crypto.subtle.digest
const mockDigest = vi.fn();
Object.defineProperty(global.crypto, 'subtle', {
  value: {
    digest: mockDigest,
  },
  writable: true,
});

describe('hash utilities', () => {
  describe('generateFileHash', () => {
    it('should generate SHA-256 hash for file', async () => {
      // Create mock file
      const mockFileContent = 'test file content';
      const encoder = new TextEncoder();
      const contentBuffer = encoder.encode(mockFileContent);
      
      const mockFile = new File([contentBuffer], 'test.gcode', {
        type: 'text/plain',
      });

      // Mock the slice method to return a Blob with arrayBuffer method
      const originalSlice = mockFile.slice.bind(mockFile);
      mockFile.slice = vi.fn((start, end) => {
        const blob = originalSlice(start, end);
        blob.arrayBuffer = vi.fn().mockResolvedValue(contentBuffer.buffer);
        return blob;
      });

      // Mock crypto digest to return a predictable hash
      const mockHashBuffer = new ArrayBuffer(32);
      const mockHashArray = new Uint8Array(mockHashBuffer);
      // Fill with test values
      for (let i = 0; i < 32; i++) {
        mockHashArray[i] = i;
      }
      
      mockDigest.mockResolvedValue(mockHashBuffer);

      const hash = await generateFileHash(mockFile);
      
      expect(mockDigest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array));
      expect(hash).toMatch(/^[0-9a-f]{64}$/); // SHA-256 produces 64 hex chars
      expect(hash).toBe('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
    });

    it('should handle large files in chunks', async () => {
      // Create a mock large file (128MB)
      const chunkSize = 64 * 1024 * 1024; // 64MB
      const fileSize = chunkSize * 2; // 128MB
      
      // Create mock file with size but simplified content
      const mockFile = {
        size: fileSize,
        slice: vi.fn((start, end) => ({
          arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(end - start)),
        })),
      } as any;

      const mockHashBuffer = new ArrayBuffer(32);
      mockDigest.mockResolvedValue(mockHashBuffer);

      await generateFileHash(mockFile);
      
      // Should have called slice twice for a 128MB file with 64MB chunks
      expect(mockFile.slice).toHaveBeenCalledTimes(2);
      expect(mockFile.slice).toHaveBeenCalledWith(0, chunkSize);
      expect(mockFile.slice).toHaveBeenCalledWith(chunkSize, fileSize);
    });
  });

  describe('generateQuickHash', () => {
    it('should generate hash from file metadata', () => {
      const mockFile = new File(['content'], 'test.gcode', {
        type: 'text/plain',
        lastModified: 1234567890,
      });

      const hash = generateQuickHash(mockFile);
      
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      // Should be base36 encoded
      expect(hash).toMatch(/^[0-9a-z]+$/);
    });

    it('should produce different hashes for different files', () => {
      const file1 = new File(['content1'], 'test1.gcode', {
        lastModified: 1234567890,
      });
      
      const file2 = new File(['content2'], 'test2.gcode', {
        lastModified: 1234567891,
      });

      const hash1 = generateQuickHash(file1);
      const hash2 = generateQuickHash(file2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should produce same hash for same file metadata', () => {
      const metadata = {
        lastModified: 1234567890,
      };
      
      // Create files with same content to have same size
      const file1 = new File(['same content'], 'test.gcode', metadata);
      const file2 = new File(['same content'], 'test.gcode', metadata);

      const hash1 = generateQuickHash(file1);
      const hash2 = generateQuickHash(file2);
      
      // Same name, size, and lastModified should produce same hash
      expect(hash1).toBe(hash2);
    });
  });
});