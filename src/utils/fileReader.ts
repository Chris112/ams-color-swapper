export class BrowserFileReader {
  private file: File;
  private chunkSize: number;

  constructor(file: File, chunkSize: number = 1024 * 1024) {
    // 1MB chunks
    this.file = file;
    this.chunkSize = chunkSize;
  }

  async *readLines(): AsyncGenerator<string, void, unknown> {
    let buffer = '';

    for await (const chunk of this.readChunks()) {
      buffer += chunk;
      const lines = buffer.split('\n');

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || '';

      // Yield complete lines
      for (const line of lines) {
        yield line;
      }
    }

    // Yield any remaining content
    if (buffer) {
      yield buffer;
    }
  }

  private async *readChunks(): AsyncGenerator<string, void, unknown> {
    const reader = new FileReader();
    let offset = 0;

    while (offset < this.file.size) {
      const chunk = this.file.slice(offset, offset + this.chunkSize);

      const result = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(chunk);
      });

      yield result;
      offset += this.chunkSize;
    }
  }

  async readAll(): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(this.file);
    });
  }
}
