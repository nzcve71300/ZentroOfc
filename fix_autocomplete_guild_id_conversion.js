const fs = require('fs');

console.log('🔧 Fixing guild_id conversion in autocomplete functions...');

function fixAutocompleteGuildIdConversion(content) {
  let fixed = content;
  
  // Fix autocomplete functions to properly convert Discord guild ID to database guild ID
  fixed = fixed.replace(
    /async autocomplete\(interaction\) \{[\s\S]*?const guildId = interaction\.guildId;[\s\S]*?const \[result\] = await pool\.query\([\s\S]*?'SELECT nickname FROM rust_servers WHERE guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\) AND nickname LIKE \? LIMIT 25',[\s\S]*?\[guildId, `%\$\{focusedValue\}%`\]\);/g,
    `async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const discordGuildId = interaction.guildId;

    try {
      // First get the guild_id from the guilds table
      const [guildResult] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [discordGuildId]);
      
      if (guildResult.length === 0) {
        await interaction.respond([]);
        return;
      }
      
      const guildId = guildResult[0].id;
      
      const [result] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25',
        [guildId, \`%\${focusedValue}%\`]
      );

      const choices = result.map(row => ({
        name: row.nickname,
        value: row.nickname
      }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  }`
  );
  
  return fixed;
}

const filesToFix = [
  'src/commands/admin/addShopCategory.js',
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
      const originalContent = content;
      
      content = fixAutocompleteGuildIdConversion(content);
      
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed: ${filePath}`);
        totalUpdated++;
      }
    } catch (error) {
      console.log(`❌ Error fixing ${filePath}:`, error.message);
    }
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

console.log(`\n🎉 Autocomplete guild_id conversion fix completed!`);
console.log(`✅ Updated ${totalUpdated} files`);
console.log(`✅ All autocomplete functions now properly convert Discord guild ID to database guild ID`);
console.log(`✅ Your bot autocomplete should now work!`);

console.log(`\n💡 Restart your bot with: pm2 restart zentro-bot`); 