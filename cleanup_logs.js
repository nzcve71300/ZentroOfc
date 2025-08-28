const fs = require('fs');
const path = require('path');

function getDirectorySize(dirPath) {
  let totalSize = 0;
  
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        totalSize += getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
  }
  
  return totalSize;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function cleanupLogs() {
  console.log('🧹 Log Cleanup Utility');
  console.log('=====================\n');
  
  const logsDir = './logs';
  
  if (!fs.existsSync(logsDir)) {
    console.log('❌ Logs directory not found');
    return;
  }
  
  // Check current log sizes
  const totalSize = getDirectorySize(logsDir);
  console.log(`📊 Current logs size: ${formatBytes(totalSize)}\n`);
  
  // List all log files with sizes
  const files = fs.readdirSync(logsDir);
  console.log('📋 Log files:');
  
  for (const file of files) {
    const filePath = path.join(logsDir, file);
    const stats = fs.statSync(filePath);
    const size = formatBytes(stats.size);
    const modified = stats.mtime.toLocaleDateString();
    console.log(`   ${file} - ${size} (modified: ${modified})`);
  }
  
  console.log('\n💡 To clean up logs:');
  console.log('   pm2 flush                    # Clear PM2 logs');
  console.log('   rm logs/*.log               # Remove all log files');
  console.log('   pm2 restart zentro-bot      # Restart with new log settings');
  
  console.log('\n🔧 Log level settings:');
  console.log('   LOG_LEVEL=ERROR  # Only errors');
  console.log('   LOG_LEVEL=WARN   # Errors and warnings');
  console.log('   LOG_LEVEL=INFO   # Errors, warnings, and info');
  console.log('   LOG_LEVEL=DEBUG  # All logs (verbose)');
}

cleanupLogs();
