#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Define the type mappings
const typeMappings = {
  GcodeStats: 'gcode',
  SystemConfiguration: 'configuration',
  PrintConstraints: 'configuration',
  OptimizationResult: 'optimization',
  SlotAssignment: 'optimization',
  ManualSwap: 'optimization',
  DebugLog: 'logging',
  LayerConstraintViolation: 'constraints',
  ConstraintViolationRange: 'constraints',
  ColorConsolidationSuggestion: 'constraints',
  ConstraintValidationResult: 'constraints',
};

// Find all TypeScript files
const files = glob.sync('src/**/*.ts', {
  ignore: ['src/types/**/*.ts', 'node_modules/**'],
});

console.log(`Found ${files.length} TypeScript files to process`);

let updatedCount = 0;

files.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  let updated = false;

  // Match import statements from '../types' or similar
  const importRegex = /import\s*(?:type\s*)?{\s*([^}]+)\s*}\s*from\s*['"]([^'"]*types)['"];?/g;

  content = content.replace(importRegex, (match, imports, fromPath) => {
    // Skip if it's already importing from a specific file
    if (fromPath.includes('types/') && !fromPath.endsWith('/types')) {
      return match;
    }

    // Parse the imported types
    const importedTypes = imports.split(',').map((i) => i.trim());

    // Group imports by their target file
    const importGroups = {};
    const remainingImports = [];

    importedTypes.forEach((imp) => {
      // Handle type imports (e.g., "type GcodeStats")
      const typeMatch = imp.match(/^(?:type\s+)?(\w+)$/);
      const typeName = typeMatch ? typeMatch[1] : imp;

      if (typeMappings[typeName]) {
        const targetFile = typeMappings[typeName];
        if (!importGroups[targetFile]) {
          importGroups[targetFile] = [];
        }
        importGroups[targetFile].push(typeName);
      } else {
        remainingImports.push(imp);
      }
    });

    // Build new import statements
    const newImports = [];

    // Add imports for specific type files
    Object.entries(importGroups).forEach(([targetFile, types]) => {
      const typeImports = types.join(', ');
      const importPath = fromPath.replace(/types$/, `types/${targetFile}`);
      newImports.push(`import { ${typeImports} } from '${importPath}';`);
    });

    // Add remaining imports if any
    if (remainingImports.length > 0) {
      newImports.push(`import { ${remainingImports.join(', ')} } from '${fromPath}';`);
    }

    if (newImports.length > 1 || (newImports.length === 1 && !newImports[0].includes(fromPath))) {
      updated = true;
      return newImports.join('\n');
    }

    return match;
  });

  if (updated) {
    fs.writeFileSync(file, content);
    updatedCount++;
    console.log(`Updated: ${file}`);
  }
});

console.log(`\nMigration complete! Updated ${updatedCount} files.`);
console.log('\nNext steps:');
console.log('1. Run "npm run check:types" to verify everything compiles');
console.log('2. Delete src/types/index.ts once verified');
