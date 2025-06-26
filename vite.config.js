import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'child_process';

// Get git commit hash at build time
function getGitCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch (error) {
    console.warn('Failed to get git commit hash:', error.message);
    return 'no-git-' + Date.now().toString(36);
  }
}

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
    exclude: ['src/workers/parserWorker.ts'],
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  define: {
    'import.meta.env.VITE_GIT_COMMIT_HASH': JSON.stringify(getGitCommitHash()),
  },
});
