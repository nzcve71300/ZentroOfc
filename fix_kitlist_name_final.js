const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing kitlistName undefined error...\n');

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
  if (lines[i].includes('kitlistName') && i >= 720 && i <= 735) {
    console.log(`✅ Found problematic line ${i + 1}: ${lines[i].trim()}`);
    // Replace kitlistName with kitKey
    lines[i] = lines[i].replace(/kitlistName/g, 'kitKey');
    console.log(`✅ Fixed line ${i + 1}: ${lines[i].trim()}`);
    fixed = true;
  }
}

if (!fixed) {
  console.log('❌ Could not find the problematic line');
  process.exit(1);
}

// Create backup
const backupPath = rconPath + '.backup36';
fs.copyFileSync(rconPath, backupPath);
console.log('✅ Created backup:', backupPath);

// Write the fixed content
const fixedContent = lines.join('\n');
fs.writeFileSync(rconPath, fixedContent);
console.log('✅ Fixed kitlistName undefined error in src/rcon/index.js');

console.log('\n✅ KitlistName undefined error fixed!');
console.log('📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test autokits in-game');
console.log('3. Check bot logs for any remaining issues'); 