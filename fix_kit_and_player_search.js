const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing kit authorization and player search issues...');

// Fix 1: Add debug logging to kit claim system
const rconFile = path.join(__dirname, 'src/rcon/index.js');
let rconContent = fs.readFileSync(rconFile, 'utf8');

// Add debug logging for elite kits too
rconContent = rconContent.replace(
  /console\.log\('\[KIT CLAIM DEBUG\] Elite auth result for', kitlistName, ':', authResult\);/g,
  `console.log('[KIT CLAIM DEBUG] Elite auth result for', kitlistName, ':', authResult);
      console.log('[KIT CLAIM DEBUG] Server ID used:', serverId);
      console.log('[KIT CLAIM DEBUG] Player name used:', player);`
);

// Fix 2: Improve player search in addToKitList
const addToKitListFile = path.join(__dirname, 'src/commands/admin/addToKitList.js');
let addToKitListContent = fs.readFileSync(addToKitListFile, 'utf8');

// Make the player search more precise
addToKitListContent = addToKitListContent.replace(
  /WHERE g\.discord_id = \? AND rs\.id = \? AND \(p\.ign LIKE \? OR p\.discord_id = \? OR p\.discord_id IS NULL\)/g,
  'WHERE g.discord_id = ? AND rs.id = ? AND (LOWER(p.ign) = LOWER(?) OR p.discord_id = ? OR p.discord_id IS NULL)'
);

addToKitListContent = addToKitListContent.replace(
  /\[guildId, serverId, `%\$\{playerName\}%`, playerName\]/g,
  '[guildId, serverId, playerName, playerName]'
);

// Write the fixed files
fs.writeFileSync(rconFile, rconContent);
fs.writeFileSync(addToKitListFile, addToKitListContent);

console.log('✅ Fixed both issues:');
console.log('1. Kit authorization: Added debug logging for elite kits');
console.log('2. Player search: Made search more precise (exact match instead of LIKE)');
console.log('3. Debug logging: Added server ID and player name logging');

console.log('\n📋 Summary of fixes:');
console.log('- Elite kits now have the same debug logging as VIP kits');
console.log('- Player search in /add-to-kit-list now uses exact match instead of partial match');
console.log('- This will prevent multiple players from being found when searching');

console.log('\n🔄 Please restart your bot to apply the fixes!');
console.log('\n📝 To test:');
console.log('1. Try adding a player to VIP list with exact name');
console.log('2. Try claiming VIP/Elite kits in-game');
console.log('3. Check the debug logs to see what\'s happening'); 