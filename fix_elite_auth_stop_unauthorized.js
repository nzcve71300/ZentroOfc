const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing elite authorization to properly stop unauthorized claims...\n');

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

// Find and fix the elite authorization logic to properly stop unauthorized claims
const updatedContent = rconContent.replace(
  /(\/\/ Handle ELITE kit authorization[\s\S]*?if \(authResult\.length === 0\) \{[\s\S]*?sendRconCommand\(ip, port, password, \`say <color=#FF69B4>\${player}</color> <color=white>you are not authorized for</color> <color=#800080>\${kitlistName}</color>\`\);\s*return;\s*\}\s*console\.log\('\[KIT CLAIM DEBUG\] Authorized for elite kit', kitKey, 'player:', player\);\s*\}\s*)/,
  `$1
        // Stop here for unauthorized elite kits - don't continue to cooldown check
        return;`
);

// Backup the original file
const backupPath = rconPath + '.backup7';
fs.copyFileSync(rconPath, backupPath);
console.log('✅ Created backup:', backupPath);

// Write the updated content
fs.writeFileSync(rconPath, updatedContent);
console.log('✅ Fixed elite authorization to properly stop unauthorized claims');

console.log('\n✅ Elite kit authorization fix completed!');
console.log('📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test elite kit claims (should now show "not authorized" message)');
console.log('3. Unauthorized players will no longer see cooldown messages'); 