const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing kitName variable error in elite authorization...\n');

// Read the current RCON file
const rconPath = path.join(__dirname, 'src', 'rcon', 'index.js');
let rconContent = '';

try {
  rconContent = fs.readFileSync(rconPath, 'utf8');
  console.log('✅ Found src/rcon/index.js');
} catch (error) {
  console.log('❌ Could not read src/rcon/index.js:', error.message);
  process.exit(1);
}

// Fix the kitName variable error by replacing it with the actual kit name
const updatedContent = rconContent.replace(
  /sendRconCommand\(ip, port, password, \`say <color=#FF69B4>\${player}</color> <color=white>you are not authorized for</color> <color=#800080>\${kitName}</color>\`\);/,
  'sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>you are not authorized for</color> <color=#800080>${kitlistName}</color>`);'
);

// Backup the original file
const backupPath = rconPath + '.backup6';
fs.copyFileSync(rconPath, backupPath);
console.log('✅ Created backup:', backupPath);

// Write the updated content
fs.writeFileSync(rconPath, updatedContent);
console.log('✅ Fixed kitName variable error in elite authorization');

console.log('\n✅ Elite kit authorization fix completed!');
console.log('📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test elite kit claims (should now properly block unauthorized players)');
console.log('3. Make sure players are linked and added to elite kit lists'); 