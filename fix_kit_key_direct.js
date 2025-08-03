const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing kitKey scope issue directly...\n');

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

// Simple string replacements - no regex
let fixedContent = rconContent;

// Replace the for loop declaration
fixedContent = fixedContent.replace(
  'for (const [kitKey, emote] of Object.entries(KIT_EMOTES)) {',
  'for (const [kitKeyLoop, emote] of Object.entries(KIT_EMOTES)) {'
);

// Replace all references in the loop
fixedContent = fixedContent.replace(
  'console.log(\'[KIT EMOTE DEBUG] Found kit emote in string:\', kitKey, \'player:\', player, \'emote:\', emote);',
  'console.log(\'[KIT EMOTE DEBUG] Found kit emote in string:\', kitKeyLoop, \'player:\', player, \'emote:\', emote);'
);

fixedContent = fixedContent.replace(
  'console.log(\'[KIT EMOTE DEBUG] Found kit emote in object:\', kitKey, \'player:\', player, \'emote:\', emote);',
  'console.log(\'[KIT EMOTE DEBUG] Found kit emote in object:\', kitKeyLoop, \'player:\', player, \'emote:\', emote);'
);

fixedContent = fixedContent.replace(
  'console.log(\'[KIT EMOTE DEBUG] Processing kit claim for:\', kitKey, \'player:\', player);',
  'console.log(\'[KIT EMOTE DEBUG] Processing kit claim for:\', kitKeyLoop, \'player:\', player);'
);

fixedContent = fixedContent.replace(
  'await handleKitClaim(client, guildId, serverName, ip, port, password, kitKey, player);',
  'await handleKitClaim(client, guildId, serverName, ip, port, password, kitKeyLoop, player);'
);

// Create backup
const backupPath = rconPath + '.backup28';
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