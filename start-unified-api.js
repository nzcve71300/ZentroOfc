#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');

console.log('🚀 Starting Zentro Unified API System...');

// Set environment variables
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.API_PORT = process.env.API_PORT || '3001';

// Start the unified API server
const apiProcess = spawn('node', [path.join(__dirname, 'src/api/unified-api.js')], {
  stdio: 'inherit',
  env: { ...process.env }
});

apiProcess.on('error', (error) => {
  console.error('❌ Failed to start API server:', error);
  process.exit(1);
});

apiProcess.on('exit', (code) => {
  console.log(`API server exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Unified API System...');
  apiProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Unified API System...');
  apiProcess.kill('SIGTERM');
});
