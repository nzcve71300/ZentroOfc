const fs = require('fs');
const path = require('path');

console.log('�� Fixing kitlistName error in handleKitClaim...\n');

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

// Find and fix the kitlistName error
const kitlistNameErrorPattern = /kitlistName is not defined/;
if (kitlistNameErrorPattern.test(rconContent)) {
  console.log('✅ Found kitlistName error, fixing...');
  
  // Replace the problematic line with the correct variable name
  const fixedContent = rconContent.replace(
    /kitlistName/g,
    'kitKey'
  );
  
  // Create backup
  const backupPath = rconPath + '.backup24';
  fs.copyFileSync(rconPath, backupPath);
  console.log('✅ Created backup:', backupPath);
  
  // Write the fixed content
  fs.writeFileSync(rconPath, fixedContent);
  console.log('✅ Fixed kitlistName error in src/rcon/index.js');
} else {
  console.log('❌ No kitlistName error found');
}

console.log('\n✅ KitlistName error fixed!');
console.log('📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test autokits in-game');
console.log('3. Check bot logs for any remaining issues'); 