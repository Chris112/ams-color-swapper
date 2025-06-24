/**
 * Generate SHA-256 hash of a file
 * @param file The file to hash
 * @returns Promise resolving to hex-encoded hash string
 */
export async function generateFileHash(file: File): Promise<string> {
  // Read file in chunks to handle large files efficiently
  const chunkSize = 64 * 1024 * 1024; // 64MB chunks
  const chunks: ArrayBuffer[] = [];
  
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const chunk = file.slice(offset, offset + chunkSize);
    const buffer = await chunk.arrayBuffer();
    chunks.push(buffer);
  }

  // Concatenate all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const concatenated = new Uint8Array(totalLength);
  let position = 0;
  
  for (const chunk of chunks) {
    concatenated.set(new Uint8Array(chunk), position);
    position += chunk.byteLength;
  }

  // Generate hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', concatenated);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Generate a quick hash using file metadata (less secure but much faster)
 * Uses file name, size, and last modified date
 */
export function generateQuickHash(file: File): string {
  const metadata = `${file.name}-${file.size}-${file.lastModified}`;
  
  // Simple hash function for metadata
  let hash = 0;
  for (let i = 0; i < metadata.length; i++) {
    const char = metadata.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36);
}