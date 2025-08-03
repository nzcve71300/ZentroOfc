const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing kitName error in handleKitClaim...\n');

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

// Find and fix the kitName error
const kitNameErrorPattern = /kitName/g;
if (kitNameErrorPattern.test(rconContent)) {
  console.log('✅ Found kitName error, fixing...');
  
  // Replace kitName with kitKey in the handleKitClaim function
  const fixedContent = rconContent.replace(
    /console\.log\('\[KIT CLAIM DEBUG\] Giving kit:', kitName, 'to player:', player\);/g,
    "console.log('[KIT CLAIM DEBUG] Giving kit:', kitKey, 'to player:', player);"
  ).replace(
    /sendRconCommand\(ip, port, password, `kit givetoplayer \${kitName} \${player}`\);/g,
    "sendRconCommand(ip, port, password, `kit givetoplayer ${kitKey} ${player}`);"
  ).replace(
    /sendRconCommand\(ip, port, password, `say <color=#FF69B4>\${player}</color> <color=white>claimed</color> <color=#800080>\${kitName}</color>`\);/g,
    "sendRconCommand(ip, port, password, `say <color=#FF69B4>${player}</color> <color=white>claimed</color> <color=#800080>${kitKey}</color>`);"
  ).replace(
    /await sendFeedEmbed\(client, guildId, serverName, 'adminfeed', `🛡️ \*\*Kit Claim:\*\* \${player} claimed \${kitName}`\);/g,
    "await sendFeedEmbed(client, guildId, serverName, 'adminfeed', `🛡️ **Kit Claim:** ${player} claimed ${kitKey}`);"
  );
  
  // Create backup
  const backupPath = rconPath + '.backup25';
  fs.copyFileSync(rconPath, backupPath);
  console.log('✅ Created backup:', backupPath);
  
  // Write the fixed content
  fs.writeFileSync(rconPath, fixedContent);
  console.log('✅ Fixed kitName error in src/rcon/index.js');
} else {
  console.log('❌ No kitName error found');
}

console.log('\n✅ KitName error fixed!');
console.log('📋 Next steps:');
console.log('1. Restart your bot: pm2 restart zentro-bot');
console.log('2. Test autokits in-game');
console.log('3. Check bot logs for any remaining issues'); 