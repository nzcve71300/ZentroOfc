// Log Level Control Script
// Run this to change log levels temporarily

const fs = require('fs');
const path = require('path');

// Available log levels: ERROR, WARN, INFO, DEBUG
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

function setLogLevel(level) {
  if (!LOG_LEVELS.hasOwnProperty(level)) {
    console.log('❌ Invalid log level. Available levels: ERROR, WARN, INFO, DEBUG');
    return;
  }

  // Set environment variable
  process.env.LOG_LEVEL = level;
  
  console.log(`✅ Log level set to: ${level}`);
  console.log(`📝 This will show logs with level ${level} and above`);
  console.log(`🔄 Restart the bot to apply changes`);
  
  // Show what each level includes
  console.log('\n📋 Log levels:');
  console.log('ERROR (0): Only errors');
  console.log('WARN  (1): Warnings and errors');
  console.log('INFO  (2): Info, warnings, and errors (default)');
  console.log('DEBUG (3): All logs including debug messages');
}

// Command line usage
if (require.main === module) {
  const level = process.argv[2];
  if (!level) {
    console.log('Usage: node logLevel.js <LEVEL>');
    console.log('Example: node logLevel.js DEBUG');
    console.log('Available levels: ERROR, WARN, INFO, DEBUG');
    return;
  }
  
  setLogLevel(level.toUpperCase());
}

module.exports = { setLogLevel, LOG_LEVELS }; 