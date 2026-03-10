#!/usr/bin/env node
/**
 * File-based test for MCP server
 * Outputs results to test-output.txt
 */
const fs = require('fs');
const { spawn } = require('child_process');

const logFile = 'test-output.txt';
const logs = [];

function log(msg) {
  console.log(msg);
  logs.push(msg);
}

log('🚀 MCP Server Test Started');
log('Time: ' + new Date().toISOString());
log('CWD: ' + process.cwd());
log('Node: ' + process.version);
log('');

// Check if dist/index.js exists
const distPath = 'dist/index.js';
if (!fs.existsSync(distPath)) {
  log('❌ ERROR: dist/index.js not found!');
  fs.writeFileSync(logFile, logs.join('\n'));
  process.exit(1);
}
log('✅ dist/index.js exists');

// Check if node_modules exists
if (!fs.existsSync('node_modules')) {
  log('❌ ERROR: node_modules not found - did you run npm install?');
  fs.writeFileSync(logFile, logs.join('\n'));
  process.exit(1);
}
log('✅ node_modules exists');
log('');

log('🔄 Starting server...');
const child = spawn('node', [distPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  timeout: 6000,
});

let stdoutData = '';
let stderrData = '';
let hasError = false;

child.stdout.on('data', (data) => {
  const str = data.toString();
  stdoutData += str;
  log(`📤 STDOUT: ${str.trim()}`);
});

child.stderr.on('data', (data) => {
  const str = data.toString();
  stderrData += str;
  log(`📌 STDERR: ${str.trim()}`);
  if (str.includes('Error') || str.includes('error')) {
    hasError = true;
  }
});

child.on('error', (err) => {
  log(`❌ PROCESS ERROR: ${err.message}`);
  hasError = true;
});

// Send init message after 300ms
setTimeout(() => {
  log('');
  log('📨 Sending initialize request...');
  const init = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0' },
    },
  };
  try {
    child.stdin.write(JSON.stringify(init) + '\n');
    log('✅ Request sent');
  } catch (e) {
    log(`❌ Failed to send: ${e.message}`);
  }
}, 300);

// Final report after 5s
setTimeout(() => {
  log('');
  log('📊 TEST REPORT:');
  log(`   - Server PID: ${child.pid}`);
  log(`   - Exit code: ${child.exitCode}`);
  log(`   - Still running: ${child.exitCode === null}`);
  log(`   - Stdout length: ${stdoutData.length} chars`);
  log(`   - Stderr length: ${stderrData.length} chars`);
  log(`   - Has errors: ${hasError}`);
  log('');
  if (stdoutData.includes('running')) {
    log('✅ SUCCESS: Server appears to be running!');
  } else if (stderrData.includes('running')) {
    log('✅ SUCCESS: Server appears to be running!');
  } else if (!hasError && child.exitCode === null) {
    log('⚠️  PARTIAL: Server is running but no startup confirmation yet');
  } else {
    log('❌ FAILURE: Server did not start properly');
  }
  
  // Kill server
  log('');
  log('⏹️  Terminating server...');
  child.kill();
  
  // Write to file
  setTimeout(() => {
    fs.writeFileSync(logFile, logs.join('\n'));
    log(`\n📁 Results written to ${logFile}`);
    process.exit(0);
  }, 500);
}, 5000);

// Safety timeout
setTimeout(() => {
  log('\n⏰ TIMEOUT - force killing');
  child.kill('SIGKILL');
  fs.writeFileSync(logFile, logs.join('\n'));
  process.exit(1);
}, 7000);
