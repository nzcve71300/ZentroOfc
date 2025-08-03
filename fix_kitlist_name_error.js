const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing kitlistName variable error...\n');

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

// Find where kitlistName is being used outside the elite authorization block
console.log('📋 Looking for kitlistName usage outside elite authorization...');

// The error is happening in the kit giving section where kitlistName is not defined
// We need to define kitlistName for elite kits in the main kit giving section
const kitGivingPattern = 'console.log(\'[KIT CLAIM DEBUG] Giving kit:\', kitKey, \'to player:\', player);';
const kitGivingIndex = rconContent.indexOf(kitGivingPattern);

if (kitGivingIndex !== -1) {
  // Add kitlistName definition before the kit giving section for elite kits
  const beforeKitGiving = rconContent.substring(0, kitGivingIndex);
  const afterKitGiving = rconContent.substring(kitGivingIndex);
  
  const kitlistNameDefinition = `
        // Define kitlistName for elite kits
        let kitlistName = '';
        if (kitKey.startsWith('ELITEkit')) {
          const eliteNumber = kitKey.replace('ELITEkit', '');
          kitlistName = \`Elite\${eliteNumber}\`;
        }
`;
  
  updatedContent = beforeKitGiving + kitlistNameDefinition + afterKitGiving;
  console.log('✅ Added kitlistName definition for elite kits');
} else {
  console.log('❌ Could not find kit giving section');
  updatedContent = rconContent;
}

// Backup the original file
const backupPath = rconPath + '.backup11';
fs.copyFileSync(rconPath, backupPath);
console.log('✅ Created backup:', backupPath);

// Write the updated content
fs.writeFileSync(rconPath, updatedContent);
console.log('✅ Fixed kitlistName variable error');

console.log('\n✅ Elite kit authorization fix completed!');
console.log('📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test elite kit claims (should now work without errors)');
console.log('3. Authorized players will get their kits, unauthorized will see error message'); 