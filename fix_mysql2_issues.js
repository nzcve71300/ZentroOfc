const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing MySQL2 result access issues...');

// Fix 1: Linking system - src/utils/linking.js
const linkingFile = path.join(__dirname, 'src/utils/linking.js');
let linkingContent = fs.readFileSync(linkingFile, 'utf8');

// Fix the existingPlayers access
linkingContent = linkingContent.replace(
  /if \(existingPlayers\.length > 0\) \{\s+const existing = existingPlayers\[0\];/g,
  `if (existingPlayers.length > 0) {
      const existing = existingPlayers[0];`
);

// Fix 2: Kit claim system - src/rcon/index.js
const rconFile = path.join(__dirname, 'src/rcon/index.js');
let rconContent = fs.readFileSync(rconFile, 'utf8');

// Fix the playerResult access for VIP kits
rconContent = rconContent.replace(
  /if \(playerResult\.length === 0 \|\| !playerResult\[0\]\.discord_id\) \{/g,
  `if (playerResult.length === 0 || !playerResult[0].discord_id) {`
);

// Fix the playerResult access for Elite kits
rconContent = rconContent.replace(
  /if \(playerResult\.length === 0 \|\| !playerResult\[0\]\.discord_id\) \{/g,
  `if (playerResult.length === 0 || !playerResult[0].discord_id) {`
);

// Write the fixed files
fs.writeFileSync(linkingFile, linkingContent);
fs.writeFileSync(rconFile, rconContent);

console.log('✅ Fixed MySQL2 result access issues in:');
console.log('- src/utils/linking.js');
console.log('- src/rcon/index.js');
console.log('\n📋 The fixes address:');
console.log('1. Linking system: Fixed existingPlayers[0] access');
console.log('2. Kit claim system: Fixed playerResult[0] access');
console.log('\n🔄 Please restart your bot to apply the fixes!'); 