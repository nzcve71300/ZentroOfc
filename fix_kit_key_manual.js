const fs = require('fs');
const path = require('path');

console.log('🔧 Manual fix for kitKey scope issue...\n');

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

// Split into lines
let lines = rconContent.split('\n');

// Find and fix the specific line
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('for (const [kitKey, emote] of Object.entries(KIT_EMOTES)) {')) {
    console.log('✅ Found the problematic line at line', i + 1);
    lines[i] = '  for (const [kitKeyLoop, emote] of Object.entries(KIT_EMOTES)) {';
    console.log('✅ Fixed the line');
    break;
  }
}

// Join lines back together
const fixedContent = lines.join('\n');

// Create backup
const backupPath = rconPath + '.backup32';
fs.copyFileSync(rconPath, backupPath);
console.log('✅ Created backup:', backupPath);

// Write the fixed content
fs.writeFileSync(rconPath, fixedContent);
console.log('✅ Fixed kitKey scope issue in src/rcon/index.js');

console.log('\n✅ KitKey scope issue fixed!');
console.log('📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test autokits in-game');
console.log('3. Check bot logs for any remaining issues'); 