const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing kitKey scope issue - simple approach...\n');

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

// Split into lines for easier editing
let lines = rconContent.split('\n');

// Find and fix the specific lines
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Fix the for loop declaration
  if (line.includes('for (const [kitKey, emote] of Object.entries(KIT_EMOTES)) {')) {
    lines[i] = line.replace('kitKey', 'kitKeyLoop');
    console.log('✅ Fixed for loop declaration at line', i + 1);
  }
  
  // Fix console.log statements in the loop
  if (line.includes('[KIT EMOTE DEBUG] Found kit emote in string:') && line.includes('kitKey')) {
    lines[i] = line.replace('kitKey', 'kitKeyLoop');
    console.log('✅ Fixed string debug log at line', i + 1);
  }
  
  if (line.includes('[KIT EMOTE DEBUG] Found kit emote in object:') && line.includes('kitKey')) {
    lines[i] = line.replace('kitKey', 'kitKeyLoop');
    console.log('✅ Fixed object debug log at line', i + 1);
  }
  
  if (line.includes('[KIT EMOTE DEBUG] Processing kit claim for:') && line.includes('kitKey')) {
    lines[i] = line.replace('kitKey', 'kitKeyLoop');
    console.log('✅ Fixed processing debug log at line', i + 1);
  }
  
  // Fix the handleKitClaim call
  if (line.includes('await handleKitClaim(') && line.includes('kitKey, player)')) {
    lines[i] = line.replace('kitKey, player)', 'kitKeyLoop, player)');
    console.log('✅ Fixed handleKitClaim call at line', i + 1);
  }
}

// Join lines back together
const fixedContent = lines.join('\n');

// Create backup
const backupPath = rconPath + '.backup29';
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