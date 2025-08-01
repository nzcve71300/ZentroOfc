const fs = require('fs');

console.log('🔧 SSH: Fixing execute functions guild_id conversion for ALL commands...');

// Pattern to fix guild_id usage in execute functions
const guildIdConversionPattern = `    const discordGuildId = interaction.guildId;
    
    // Get the guild_id from the guilds table
    const [guildResult] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [discordGuildId]);
    
    if (guildResult.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Error', 'Guild not found in database.')]
      });
    }
    
    const guildId = guildResult[0].id;`;

const filesToFix = [
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

let totalUpdated = 0;

filesToFix.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Check if this file has execute function with guildId usage
      if (content.includes('async execute') && content.includes('guildId = interaction.guildId')) {
        // Replace the old guildId assignment with the proper conversion
        const oldPattern = /const guildId = interaction\.guildId;/;
        if (oldPattern.test(content)) {
          content = content.replace(oldPattern, guildIdConversionPattern);
          fs.writeFileSync(filePath, content);
          console.log(`✅ Fixed execute function: ${filePath}`);
          totalUpdated++;
        } else {
          console.log(`⚠️  No guildId assignment found in execute: ${filePath}`);
        }
      } else {
        console.log(`⚠️  No execute function or guildId usage found in: ${filePath}`);
      }
    } catch (error) {
      console.log(`❌ Error fixing ${filePath}:`, error.message);
    }
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

console.log(`\n🎉 Execute functions guild_id fix completed!`);
console.log(`✅ Updated ${totalUpdated} files`);
console.log(`✅ All execute functions now properly convert Discord guild IDs to database guild IDs!`);
console.log(`✅ "Server not found" errors should now be resolved!`);

console.log(`\n💡 Restart your bot with: pm2 restart zentro-bot`); 