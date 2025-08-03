const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing kitKey redeclaration issue...\n');

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

// Find and fix the problematic line
const lines = rconContent.split('\n');
let fixed = false;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const kitKey = kitConfig.game_name || kitKey;')) {
    console.log(`✅ Found problematic line ${i + 1}: ${lines[i].trim()}`);
    // Replace with just using the existing kitKey parameter
    lines[i] = '    const kitName = kitConfig.game_name || kitKey;';
    console.log(`✅ Fixed line ${i + 1}: ${lines[i].trim()}`);
    fixed = true;
    break;
  }
}

if (!fixed) {
  console.log('❌ Could not find the problematic line');
  process.exit(1);
}

// Create backup
const backupPath = rconPath + '.backup35';
fs.copyFileSync(rconPath, backupPath);
console.log('✅ Created backup:', backupPath);

// Write the fixed content
const fixedContent = lines.join('\n');
fs.writeFileSync(rconPath, fixedContent);
console.log('✅ Fixed kitKey redeclaration in src/rcon/index.js');

console.log('\n✅ KitKey redeclaration issue fixed!');
console.log('📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test autokits in-game');
console.log('3. Check bot logs for any remaining issues'); 