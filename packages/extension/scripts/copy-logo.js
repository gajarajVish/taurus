#!/usr/bin/env node
/**
 * Ensures only taurus_logo_inverted.png is in public/ so the build ships the correct logo.
 * Removes taurus_logo.png from public/ if present so dist only contains the inverted logo.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const nonInverted = path.join(publicDir, 'taurus_logo.png');

if (fs.existsSync(nonInverted)) {
  fs.unlinkSync(nonInverted);
  console.log('[extension] Removed taurus_logo.png from public/ (using taurus_logo_inverted.png only).');
}

const inverted = path.join(publicDir, 'taurus_logo_inverted.png');
if (!fs.existsSync(inverted)) {
  console.warn('[extension] public/taurus_logo_inverted.png not found. Add it so the logo appears.');
}
