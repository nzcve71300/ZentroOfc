const fs = require('fs');
const path = require('path');

// PostgreSQL to MySQL syntax mappings
const syntaxMappings = {
  // Parameter placeholders
  '\\$\\d+': '?', // $1, $2, etc. -> ?
  
  // Query result handling
  'result\\.rows': 'result',
  'result\\.rowCount': 'result.affectedRows',
  
  // SQL functions
  'NOW\\(\\)': 'CURRENT_TIMESTAMP',
  'ILIKE': 'LIKE',
  
  // Upsert syntax
  'ON CONFLICT.*DO NOTHING': 'ON DUPLICATE KEY UPDATE id = id',
  'ON CONFLICT.*DO UPDATE': 'ON DUPLICATE KEY UPDATE',
  'EXCLUDED\\.': 'VALUES(',
  
  // Type casting
  '::BIGINT': '',
  '::TEXT': '',
  '::INT': '',
  
  // Interval syntax
  "INTERVAL '1 hour'": 'INTERVAL 1 HOUR',
  "INTERVAL '10 minutes'": 'INTERVAL 10 MINUTE',
  
  // Boolean values
  'true': 'TRUE',
  'false': 'FALSE'
};

// Files to check and fix
const filesToFix = [
  'src/rcon/index.js',
  'src/utils/permissions.js',
  'src/utils/economy.js',
  'src/utils/unifiedPlayerSystem.js',
  'src/utils/linking.js',
  'src/events/interactionCreate.js',
  'src/commands/admin/*.js',
  'src/commands/player/*.js'
];

function fixPostgreSQLSyntax(content) {
  let fixedContent = content;
  
  // Fix parameter placeholders
  fixedContent = fixedContent.replace(/\$(\d+)/g, '?');
  
  // Fix result handling
  fixedContent = fixedContent.replace(/result\.rows/g, 'result');
  fixedContent = fixedContent.replace(/result\.rowCount/g, 'result.affectedRows');
  
  // Fix SQL functions
  fixedContent = fixedContent.replace(/NOW\(\)/g, 'CURRENT_TIMESTAMP');
  fixedContent = fixedContent.replace(/ILIKE/g, 'LIKE');
  
  // Fix upsert syntax
  fixedContent = fixedContent.replace(/ON CONFLICT \([^)]+\) DO NOTHING/g, 'ON DUPLICATE KEY UPDATE id = id');
  fixedContent = fixedContent.replace(/ON CONFLICT \([^)]+\) DO UPDATE SET/g, 'ON DUPLICATE KEY UPDATE');
  fixedContent = fixedContent.replace(/EXCLUDED\./g, 'VALUES(');
  
  // Fix type casting
  fixedContent = fixedContent.replace(/::BIGINT/g, '');
  fixedContent = fixedContent.replace(/::TEXT/g, '');
  fixedContent = fixedContent.replace(/::INT/g, '');
  
  // Fix interval syntax
  fixedContent = fixedContent.replace(/INTERVAL '1 hour'/g, 'INTERVAL 1 HOUR');
  fixedContent = fixedContent.replace(/INTERVAL '10 minutes'/g, 'INTERVAL 10 MINUTE');
  
  // Fix boolean values
  fixedContent = fixedContent.replace(/\btrue\b/g, 'TRUE');
  fixedContent = fixedContent.replace(/\bfalse\b/g, 'FALSE');
  
  return fixedContent;
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fixedContent = fixPostgreSQLSyntax(content);
    
    if (content !== fixedContent) {
      fs.writeFileSync(filePath, fixedContent, 'utf8');
      console.log(`✅ Fixed: ${filePath}`);
      return true;
    } else {
      console.log(`ℹ️ No changes needed: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function findAndProcessFiles(dir, pattern) {
  const files = fs.readdirSync(dir);
  let processedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processedCount += findAndProcessFiles(filePath, pattern);
    } else if (file.endsWith('.js') && pattern.test(file)) {
      if (processFile(filePath)) {
        processedCount++;
      }
    }
  }
  
  return processedCount;
}

// Main execution
console.log('🔧 Starting PostgreSQL to MySQL syntax conversion...');

let totalProcessed = 0;

// Process specific files
const specificFiles = [
  'src/rcon/index.js',
  'src/utils/permissions.js',
  'src/utils/economy.js',
  'src/utils/unifiedPlayerSystem.js',
  'src/utils/linking.js',
  'src/events/interactionCreate.js'
];

for (const file of specificFiles) {
  if (fs.existsSync(file)) {
    if (processFile(file)) {
      totalProcessed++;
    }
  }
}

// Process command directories
const commandDirs = [
  'src/commands/admin',
  'src/commands/player'
];

for (const dir of commandDirs) {
  if (fs.existsSync(dir)) {
    totalProcessed += findAndProcessFiles(dir, /\.js$/);
  }
}

console.log(`\n✅ Conversion complete! Processed ${totalProcessed} files.`);
console.log('\n📋 Summary of changes:');
console.log('- Replaced $1, $2, etc. with ?');
console.log('- Changed result.rows to result');
console.log('- Changed result.rowCount to result.affectedRows');
console.log('- Replaced NOW() with CURRENT_TIMESTAMP');
console.log('- Replaced ILIKE with LIKE');
console.log('- Fixed ON CONFLICT to ON DUPLICATE KEY UPDATE');
console.log('- Removed PostgreSQL type casting');
console.log('- Fixed interval syntax');
console.log('- Changed boolean values to uppercase'); 