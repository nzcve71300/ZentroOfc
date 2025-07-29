const fs = require('fs');
const path = require('path');

// Function to fix MySQL compatibility issues in a file
function fixMySQLCompatibility(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Fix result.rows to [result] pattern
    const rowsPattern = /const\s+(\w+)\s*=\s*await\s+pool\.query\(/g;
    const rowsReplacement = 'const [$1] = await pool.query(';
    if (content.match(rowsPattern)) {
      content = content.replace(rowsPattern, rowsReplacement);
      modified = true;
    }

    // Fix .rows access to array access
    const dotRowsPattern = /\.rows\[/g;
    if (content.match(dotRowsPattern)) {
      content = content.replace(dotRowsPattern, '[');
      modified = true;
    }

    // Fix .rows.length to .length
    const rowsLengthPattern = /\.rows\.length/g;
    if (content.match(rowsLengthPattern)) {
      content = content.replace(rowsLengthPattern, '.length');
      modified = true;
    }

    // Fix PostgreSQL-specific syntax
    const pgPatterns = [
      { from: /ON CONFLICT/g, to: 'ON DUPLICATE KEY UPDATE' },
      { from: /NOW\(\)/g, to: 'CURRENT_TIMESTAMP' },
      { from: /INTERVAL '(\d+) (\w+)'/g, to: 'INTERVAL $1 $2' },
      { from: /::(\w+)/g, to: '' }, // Remove type casting
      { from: /ILIKE/g, to: 'LIKE' }
    ];

    pgPatterns.forEach(pattern => {
      if (content.match(pattern.from)) {
        content = content.replace(pattern.from, pattern.to);
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
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

// Function to recursively process all JS files in a directory
function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  let totalFixed = 0;

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      totalFixed += processDirectory(filePath);
    } else if (file.endsWith('.js')) {
      if (fixMySQLCompatibility(filePath)) {
        totalFixed++;
      }
    }
  });

  return totalFixed;
}

// Main execution
console.log('🔧 Fixing MySQL compatibility issues...');
console.log('');

const commandsDir = path.join(__dirname, 'src', 'commands');
const utilsDir = path.join(__dirname, 'src', 'utils');

let totalFixed = 0;

if (fs.existsSync(commandsDir)) {
  console.log('📁 Processing commands directory...');
  totalFixed += processDirectory(commandsDir);
}

if (fs.existsSync(utilsDir)) {
  console.log('📁 Processing utils directory...');
  totalFixed += processDirectory(utilsDir);
}

console.log('');
console.log(`✅ MySQL compatibility fixes completed!`);
console.log(`📊 Total files modified: ${totalFixed}`);
console.log('');
console.log('💡 Changes made:');
console.log('   - Fixed result.rows → [result] pattern');
console.log('   - Fixed .rows access → array access');
console.log('   - Updated PostgreSQL syntax → MySQL syntax');
console.log('');
console.log('🚀 You can now restart your bot with MySQL!'); 