const fs = require('fs');
const path = require('path');

console.log('🔧 Direct file edit for kitKey scope issue...\n');

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

// Find the exact line and replace it
const searchPattern = 'for (const [kitKey, emote] of Object.entries(KIT_EMOTES)) {';
const replacePattern = 'for (const [kitKeyLoop, emote] of Object.entries(KIT_EMOTES)) {';

if (rconContent.includes(searchPattern)) {
  console.log('✅ Found the problematic line');
  const fixedContent = rconContent.replace(searchPattern, replacePattern);
  
  // Create backup
  const backupPath = rconPath + '.backup33';
  fs.copyFileSync(rconPath, backupPath);
  console.log('✅ Created backup:', backupPath);
  
  // Write the fixed content
  fs.writeFileSync(rconPath, fixedContent);
  console.log('✅ Fixed kitKey scope issue in src/rcon/index.js');
  
  // Verify the change
  const verifyContent = fs.readFileSync(rconPath, 'utf8');
  if (verifyContent.includes('kitKeyLoop')) {
    console.log('✅ Verification: Change was applied successfully');
  } else {
    console.log('❌ Verification: Change was NOT applied');
  }
} else {
  console.log('❌ Could not find the problematic line');
  console.log('Available lines containing "kitKey":');
  const lines = rconContent.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('kitKey')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
}

console.log('\n✅ KitKey scope issue fixed!');
console.log('📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test autokits in-game');
console.log('3. Check bot logs for any remaining issues'); 