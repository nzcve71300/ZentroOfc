const fs = require('fs');

console.log('🔍 SSH: Checking for remaining command guild_id issues...');

// Check all command files for guild_id usage
const commandFiles = [
  'src/commands/admin/addCurrencyPlayer.js',
  'src/commands/admin/addCurrencyServer.js',
  'src/commands/admin/console.js',
  'src/commands/admin/addShopItem.js',
  'src/commands/admin/addShopKit.js',
  'src/commands/admin/editShopCategory.js',
  'src/commands/admin/editShopItem.js',
  'src/commands/admin/editShopKit.js',
  'src/commands/admin/removeShopCategory.js',
  'src/commands/admin/removeShopItem.js',
  'src/commands/admin/removeShopKit.js',
  'src/commands/admin/addToKitList.js',
  'src/commands/admin/removeFromKitList.js',
  'src/commands/admin/viewKitListPlayers.js',
  'src/commands/admin/wipeKitClaims.js',
  'src/commands/admin/markPaid.js',
  'src/commands/admin/setCurrency.js',
  'src/commands/admin/setEvents.js',
  'src/commands/admin/setPositions.js',
  'src/commands/admin/killfeed.js',
  'src/commands/admin/killfeedSetup.js',
  'src/commands/admin/autokitsSetup.js',
  'src/commands/admin/viewAutokitsConfigs.js',
  'src/commands/admin/ecoGamesSetup.js',
  'src/commands/admin/channelSet.js',
  'src/commands/admin/listChannels.js',
  'src/commands/admin/listServers.js',
  'src/commands/admin/removeServer.js',
  'src/commands/admin/forceLink.js',
  'src/commands/admin/allowLink.js',
  'src/commands/admin/unlink.js',
  'src/commands/admin/testMessage.js',
  'src/commands/admin/managePositions.js',
  'src/commands/player/balance.js',
  'src/commands/player/blackjack.js',
  'src/commands/player/coinflip.js',
  'src/commands/player/daily.js',
  'src/commands/player/link.js',
  'src/commands/player/shop.js'
];

let issuesFound = 0;

commandFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for old guild_id patterns
      if (content.includes('guildId = interaction.guildId')) {
        console.log(`⚠️  Found old guild_id pattern in: ${filePath}`);
        issuesFound++;
      }
      
      // Check for direct guild_id usage in queries
      if (content.includes('WHERE guild_id = ? AND nickname = ?')) {
        console.log(`⚠️  Found direct guild_id usage in: ${filePath}`);
        issuesFound++;
      }
      
      // Check for rs.nickname without table alias
      if (content.includes('rs.nickname') && !content.includes('FROM rust_servers rs')) {
        console.log(`⚠️  Found rs.nickname without table alias in: ${filePath}`);
        issuesFound++;
      }
      
    } catch (error) {
      console.log(`❌ Error checking ${filePath}:`, error.message);
    }
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

if (issuesFound === 0) {
  console.log(`\n✅ No remaining guild_id issues found!`);
  console.log(`✅ All command files should be working correctly.`);
} else {
  console.log(`\n⚠️  Found ${issuesFound} potential issues that need fixing.`);
  console.log(`💡 We may need to run additional fixes.`);
}

console.log(`\n💡 The "Server Not Found" error might be from a specific command.`);
console.log(`💡 Try using different commands to see which one is causing the issue.`); 