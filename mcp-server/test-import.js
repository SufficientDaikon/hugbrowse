#!/usr/bin/env node
// Simple import test
try {
  console.log('Attempting to import dist/index.js...');
  console.log('Current directory:', process.cwd());
  console.log('Files in dist:');
  const fs = require('fs');
  console.log(fs.readdirSync('dist'));
  console.log('');
  console.log('Attempting import...');
  require('./dist/index.js');
  console.log('✅ Import successful!');
} catch (e) {
  console.error('❌ Import failed:');
  console.error('  Message:', e.message);
  console.error('  Stack:', e.stack);
  process.exit(1);
}
