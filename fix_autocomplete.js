const fs = require('fs');
const path = require('path');

// The improved autocomplete function
const improvedAutocomplete = `  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const guildId = interaction.guildId;

    try {
      console.log(\`🔍 Autocomplete called for guild: \${guildId}, search: "\${focusedValue}"\`);
      
      // First get the guild ID from the database
      const [guildResult] = await pool.query(
        'SELECT id FROM guilds WHERE discord_id = ?',
        [guildId]
      );
      
      if (guildResult.length === 0) {
        console.log(\`❌ Guild not found in database: \${guildId}\`);
        await interaction.respond([]);
        return;
      }
      
      const guildDbId = guildResult[0].id;
      console.log(\`✅ Found guild DB ID: \${guildDbId}\`);
      
      // Now query servers for this guild
      const [result] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25',
        [guildDbId, \`%\${focusedValue}%\`]
      );

      console.log(\`📊 Found \${result.length} servers for autocomplete\`);
      result.forEach(server => {
        console.log(\`  - \${server.nickname}\`);
      });

      const choices = result.map(row => ({
        name: row.nickname,
        value: row.nickname
      }));

      await interaction.respond(choices);
      console.log(\`✅ Autocomplete responded with \${choices.length} choices\`);
      
    } catch (error) {
      console.error('❌ Autocomplete error:', error);
      await interaction.respond([]);
    }
  },`;

// List of files to update
const filesToUpdate = [
  'src/commands/admin/addCurrencyServer.js',
  'src/commands/admin/addCurrencyPlayer.js',
  'src/commands/admin/removeCurrencyServer.js',
  'src/commands/admin/removeCurrencyPlayer.js',
  'src/commands/admin/setCurrency.js',
  'src/commands/admin/killfeedSetup.js',
  'src/commands/admin/ecoGamesSetup.js',
  'src/commands/admin/autokitsSetup.js',
  'src/commands/admin/setup-clan.js',
  'src/commands/admin/addShopItem.js',
  'src/commands/admin/addShopKit.js',
  'src/commands/admin/channelSet.js',
  'src/commands/admin/setEvents.js',
  'src/commands/admin/managePositions.js',
  'src/commands/player/clan-create.js'
];

async function fixAutocomplete() {
  console.log('🔧 Fixing autocomplete in all server commands...\n');
  
  let updatedCount = 0;
  
  for (const filePath of filesToUpdate) {
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found: ${filePath}`);
        continue;
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check if file already has the improved autocomplete
      if (content.includes('console.log(`🔍 Autocomplete called for guild:')) {
        console.log(`✅ Already updated: ${filePath}`);
        continue;
      }
      
      // Replace the old autocomplete with the improved one
      const oldAutocompleteRegex = /async autocomplete\(interaction\) \{[\s\S]*?\},/;
      const newContent = content.replace(oldAutocompleteRegex, improvedAutocomplete);
      
      if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`✅ Updated: ${filePath}`);
        updatedCount++;
      } else {
        console.log(`⚠️  No autocomplete found in: ${filePath}`);
      }
      
    } catch (error) {
      console.error(`❌ Error updating ${filePath}:`, error.message);
    }
  }
  
  console.log(`\n🎉 Updated ${updatedCount} files with improved autocomplete!`);
  console.log('\n💡 Next steps:');
  console.log('1. Restart the bot: pm2 restart zentro-bot');
  console.log('2. Test autocomplete with /add-currency-server');
  console.log('3. Type "Shadows" and see if it appears');
}

fixAutocomplete(); 