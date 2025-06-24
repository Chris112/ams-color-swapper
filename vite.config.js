import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 4000,
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['src/workers/parserWorker.ts']
  }
});
