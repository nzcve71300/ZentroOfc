const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing linking system issues...');

// Fix 1: Update unlinkAllPlayersByIdentifier to only unlink players with Discord IDs
const unifiedPlayerSystemFile = path.join(__dirname, 'src/utils/unifiedPlayerSystem.js');
let unifiedPlayerSystemContent = fs.readFileSync(unifiedPlayerSystemFile, 'utf8');

// Fix the unlink function to only unlink players with Discord IDs
unifiedPlayerSystemContent = unifiedPlayerSystemContent.replace(
  /AND LOWER\(ign\) = LOWER\(\?\)/g,
  'AND LOWER(ign) = LOWER(?) AND discord_id IS NOT NULL'
);

// Fix the isIgnLinkedToDifferentDiscordId function to only check players with Discord IDs
unifiedPlayerSystemContent = unifiedPlayerSystemContent.replace(
  /AND LOWER\(ign\) = LOWER\(\?\)\s+AND discord_id != \?/g,
  'AND LOWER(ign) = LOWER(?) AND discord_id IS NOT NULL AND discord_id != ?'
);

// Write the fixed file
fs.writeFileSync(unifiedPlayerSystemFile, unifiedPlayerSystemContent);

console.log('✅ Fixed linking system issues:');
console.log('1. Unlink command: Now only unlinks players that are actually linked (have Discord ID)');
console.log('2. Link command: Now only considers players with Discord IDs as "already linked"');
console.log('3. Better logic: Prevents unlinking unlinked players and false "already linked" messages');

console.log('\n📋 Summary of fixes:');
console.log('- Unlink command will only affect players with Discord IDs');
console.log('- Link command will only say "already linked" for players with Discord IDs');
console.log('- Prevents confusion with unlinked players in the database');

console.log('\n🔄 Please restart your bot to apply the fixes!');
console.log('\n📝 To test:');
console.log('1. Try unlinking a player - should only affect linked players');
console.log('2. Try linking a player - should not say "already linked" for unlinked players');
console.log('3. Check that the linking system works correctly'); 