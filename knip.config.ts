import type { KnipConfig } from 'knip';

/**
 * Knip v5 Configuration for AMS Color Swapper
 *
 * This configuration is optimized to handle the specific patterns in this codebase:
 * - Web Workers with dynamic imports
 * - Event-driven architecture with EventEmitter
 * - Component-based UI with lifecycle methods
 * - TypeScript strict mode with comprehensive types
 * - Three.js and WebGL visualization components
 */
const config: KnipConfig = {
  // Schema for IDE support
  $schema: 'https://unpkg.com/knip@5/schema.json',

  /**
   * Entry points - files that start the application
   * These are the roots from which all other code should be reachable
   */
  entry: [
    // HTML file that loads the main application script
    'index.html',

    // Main TypeScript entry point referenced in index.html
    'src/app.ts',

    // Worker files that are dynamically imported using new Worker(new URL(...))
    // These need to be explicitly listed as entry points because knip can't
    // trace through the dynamic Worker constructor pattern
    'src/workers/**/*.worker.ts',
    'src/workers/**/parserWorker.ts',
    'src/parser/variants/gcode.worker.ts',

    // Build scripts referenced in package.json scripts
    'scripts/**/*.js',
  ],

  /**
   * Project files to analyze
   * This tells knip which files to check for dead code
   */
  project: [
    // All TypeScript files in src directory
    'src/**/*.ts',
  ],

  /**
   * Files to exclude from dead code analysis
   * These are files that shouldn't be analyzed or are known false positives
   */
  ignore: [
    // Test files - not part of production code
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/__tests__/**',
    '**/*.benchmark.ts',

    // Type declaration files - often contain ambient types
    '**/*.d.ts',

    // Build outputs
    'dist/**',
    'coverage/**',

    // Dependencies
    'node_modules/**',

    // Worker type definitions - false positives due to worker import patterns
    // These types are used but knip can't trace through Worker constructor
    'src/types/worker/**',

    // Non-TypeScript files
    'src/**/*.css', // Stylesheets
    'src/**/*.frag', // WebGL fragment shaders
    'src/**/*.vert', // WebGL vertex shaders
  ],

  /**
   * Dependencies to ignore from unused dependency checks
   * These are build tools and type definitions that are always needed
   */
  ignoreDependencies: [
    // Build tool - required for dev/build but not imported in code
    'vite',

    // Node types - used by build tools and scripts
    '@types/node',

    // Self-reference to avoid circular dependency warnings
    'knip',
  ],

  /**
   * Configuration for export handling
   * This is crucial for avoiding false positives in event-driven code
   */
  // Ignore exports that are only used within the same file
  // Important for event handlers, internal helpers, and module organization
  ignoreExportsUsedInFile: true,

  // Don't report unused exports from entry files
  // Entry files often export APIs for external use or testing
  includeEntryExports: false,

  /**
   * Binaries to ignore
   * These are CLI tools used in npm scripts but not imported
   */
  ignoreBinaries: [
    // GitHub CLI - used for PR creation in git scripts
    'gh',

    // Image processing - used in generate:favicons script
    'sharp',

    // Code formatter - used in format scripts
    'prettier',
  ],

  /**
   * Workspaces configuration (if needed in future)
   * Currently a single-package repository
   */
  // workspaces: {},

  /**
   * Custom reporters (optional)
   * Can be used to format output for CI/CD integration
   */
  // reporters: ['symbols'],

  /**
   * Rules configuration
   * Set severity levels for different types of issues
   *
   * Available in future versions of knip:
   * rules: {
   *   files: 'warn',        // Unused files as warnings (many false positives)
   *   dependencies: 'error', // Unused deps are errors (affects install time)
   *   devDependencies: 'warn', // Dev deps less critical
   *   exports: 'warn',      // Unused exports as warnings (event handlers)
   *   types: 'warn',        // Unused types as warnings (used for type checking)
   *   duplicates: 'warn'    // Duplicate exports as warnings
   * }
   */

  /**
   * Compiler configuration
   * Tells knip how to handle different file types
   *
   * Note: In knip v5, this should be handled automatically
   * for TypeScript files
   */
  // compilers: {
  //   css: (text: string) => [...text.matchAll(/\.([a-zA-Z-]+)\s*{/g)].map(match => match[1]),
  //   vue: (text: string) => '', // If Vue is added later
  // }
};

export default config;
