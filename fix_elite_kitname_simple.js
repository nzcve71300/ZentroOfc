const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Elite authorization kitName issue...\n');

// Read the current RCON file
const rconPath = path.join(__dirname, 'src', 'rcon', 'index.js');
let rconContent = '';

try {
  rconContent = fs.readFileSync(rconPath, 'utf8');
  console.log('✅ Read RCON file');
} catch (error) {
  console.log('❌ Could not read RCON file:', error.message);
  process.exit(1);
}

// Find and fix the kitName usage in Elite authorization
const lines = rconContent.split('\n');
let fixed = false;

for (let i = 0; i < lines.length; i++) {
  // Find the line where kitName is used in Elite authorization error message
  if (lines[i].includes('you are not authorized for') && lines[i].includes('${kitName}') && lines[i].includes('ELITEkit')) {
    console.log(`✅ Found problematic line ${i + 1}: ${lines[i].trim()}`);
    // Replace kitName with kitKey
    lines[i] = lines[i].replace('${kitName}', '${kitKey}');
    console.log(`✅ Fixed line ${i + 1}: ${lines[i].trim()}`);
    fixed = true;
  }
}

if (!fixed) {
  console.log('❌ Could not find the problematic line');
  process.exit(1);
}

// Create backup
const backupPath = rconPath + '.backup39';
fs.copyFileSync(rconPath, backupPath);
console.log('✅ Created backup:', backupPath);

// Write the fixed content
const fixedContent = lines.join('\n');
fs.writeFileSync(rconPath, fixedContent);
console.log('✅ Fixed Elite authorization kitName issue in src/rcon/index.js');

console.log('\n✅ Elite authorization kitName issue fixed!');
console.log('📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test Elite kit authorization');
console.log('3. Check bot logs for any remaining issues'); 