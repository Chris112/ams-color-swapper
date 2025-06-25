import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/ams-color-swapper/' : '/',
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
