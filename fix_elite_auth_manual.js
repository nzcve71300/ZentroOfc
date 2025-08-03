const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing elite authorization manually...\n');

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

// Simple string replacements
console.log('📋 Fixing kitName variable error...');
let updatedContent = rconContent.replace(/\${kitName}/g, '${kitlistName}');

console.log('📋 Adding return statement after elite authorization...');
// Find the end of the elite authorization block and add a return statement
const eliteAuthEnd = updatedContent.indexOf('console.log(\'[KIT CLAIM DEBUG] Authorized for elite kit\', kitKey, \'player:\', player);');
if (eliteAuthEnd !== -1) {
  const insertPoint = updatedContent.indexOf('}', eliteAuthEnd) + 1;
  updatedContent = updatedContent.slice(0, insertPoint) + '\n        // Stop here for elite kits - don\'t continue to cooldown check\n        return;' + updatedContent.slice(insertPoint);
  console.log('✅ Added return statement after elite authorization');
} else {
  console.log('❌ Could not find elite authorization block');
}

// Backup the original file
const backupPath = rconPath + '.backup9';
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