const fs = require('fs');
const path = require('path');

console.log('🔧 Simple fix for kitKey scope issue...\n');

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

// Simple fix: rename the loop variable
const fixedContent = rconContent.replace(
  'for (const [kitKey, emote] of Object.entries(KIT_EMOTES)) {',
  'for (const [kitKeyLoop, emote] of Object.entries(KIT_EMOTES)) {'
);

// Create backup
const backupPath = rconPath + '.backup34';
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