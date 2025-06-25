// This script requires sharp to be installed: npm install --save-dev sharp
// Run with: node scripts/generate-favicons.js

import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const svgBuffer = readFileSync(join(__dirname, '../public/favicon-static.svg'));

const sizes = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 192, name: 'favicon-192x192.png' },
  { size: 512, name: 'favicon-512x512.png' },
];

async function generateFavicons() {
  for (const { size, name } of sizes) {
    try {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(join(__dirname, '../public', name));
      console.log(`✓ Generated ${name}`);
    } catch (error) {
      console.error(`✗ Failed to generate ${name}:`, error.message);
    }
  }

  // Also create a .ico file from the 32x32 PNG
  try {
    await sharp(svgBuffer).resize(32, 32).toFile(join(__dirname, '../public/favicon.ico'));
    console.log('✓ Generated favicon.ico');
  } catch (error) {
    console.error('✗ Failed to generate favicon.ico:', error.message);
  }
}

generateFavicons().catch(console.error);
