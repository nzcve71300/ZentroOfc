const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing kitName error in handleKitClaim...\n');

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

// Simple string replacements
let fixedContent = rconContent;

// Replace all instances of kitName with kitKey
fixedContent = fixedContent.replace(/kitName/g, 'kitKey');

// Create backup
const backupPath = rconPath + '.backup26';
fs.copyFileSync(rconPath, backupPath);
console.log('✅ Created backup:', backupPath);

// Write the fixed content
fs.writeFileSync(rconPath, fixedContent);
console.log('✅ Fixed kitName error in src/rcon/index.js');

console.log('\n✅ KitName error fixed!');
console.log('📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test autokits in-game');
console.log('3. Check bot logs for any remaining issues'); 