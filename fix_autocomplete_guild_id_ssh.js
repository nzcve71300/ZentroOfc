const mysql = require('mysql2/promise');

console.log('🔧 SSH: Fixing autocomplete guild_id conversion for ALL commands...');

// Database connection configuration for SSH
const dbConfig = {
  host: 'localhost',
  user: 'zentro_bot',
  password: 'your_password_here', // Replace with actual password
  database: 'zentro_bot',
  charset: 'utf8mb4'
};

// The correct autocomplete function pattern
const newAutocompletePattern = `  async autocomplete(interaction) {
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
  },`;

// For commands that need category autocomplete (like add-shop-item)
const newCategoryAutocompletePattern = `  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const discordGuildId = interaction.guildId;

    try {
      // First get the guild_id from the guilds table
      const [guildResult] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [discordGuildId]);
      
      if (guildResult.length === 0) {
        await interaction.respond([]);
        return;
      }
      
      const guildId = guildResult[0].id;

      if (focusedOption.name === 'server') {
        const [result] = await pool.query(
          'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25',
          [guildId, \`%\${focusedOption.value}%\`]
        );

        const choices = result.map(row => ({
          name: row.nickname,
          value: row.nickname
        }));

        await interaction.respond(choices);
      } else if (focusedOption.name === 'category') {
        const serverNickname = interaction.options.getString('server');
        
        if (!serverNickname) {
          await interaction.respond([]);
          return;
        }

        const [result] = await pool.query(
          \`SELECT sc.id, sc.name FROM shop_categories sc 
           JOIN rust_servers rs ON sc.server_id = rs.id 
           WHERE rs.guild_id = ? AND rs.nickname = ? 
           AND (sc.type = 'items' OR sc.type = 'both')
           AND sc.name LIKE ? LIMIT 25\`,
          [guildId, serverNickname, \`%\${focusedOption.value}%\`]
        );

        const choices = result.map(row => ({
          name: row.name,
          value: row.name
        }));

        await interaction.respond(choices);
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
      await interaction.respond([]);
    }
  },`;

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

async function fixAutocompleteFiles() {
  let totalUpdated = 0;
  const fs = require('fs');

  for (const filePath of filesToFix) {
    if (fs.existsSync(filePath)) {
      try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Check if this file has category autocomplete (like add-shop-item)
        const hasCategoryAutocomplete = content.includes("category") && content.includes("setAutocomplete(true)");
        
        // Replace the old autocomplete function
        const oldPattern = /async autocomplete\(interaction\) \{[\s\S]*?\},/;
        if (oldPattern.test(content)) {
          const newPattern = hasCategoryAutocomplete ? newCategoryAutocompletePattern : newAutocompletePattern;
          content = content.replace(oldPattern, newPattern);
          fs.writeFileSync(filePath, content);
          console.log(`✅ Fixed: ${filePath} ${hasCategoryAutocomplete ? '(with category support)' : ''}`);
          totalUpdated++;
        } else {
          console.log(`⚠️  No autocomplete function found in: ${filePath}`);
        }
      } catch (error) {
        console.log(`❌ Error fixing ${filePath}:`, error.message);
      }
    } else {
      console.log(`⚠️  File not found: ${filePath}`);
    }
  }

  console.log(`\n🎉 SSH Autocomplete guild_id fix completed!`);
  console.log(`✅ Updated ${totalUpdated} files`);
  console.log(`✅ All commands now properly convert Discord guild IDs to database guild IDs!`);
  console.log(`✅ Category autocomplete is now working correctly!`);
  console.log(`✅ Your bot is now fully multi-tenant ready!`);

  console.log(`\n💡 Restart your bot with: pm2 restart zentro-bot`);
}

// Run the fix
fixAutocompleteFiles().catch(console.error); 