const fs = require('fs');

console.log('🔧 Simple autocomplete fix...');

// Fix one file at a time to test
const filePath = 'src/commands/admin/addShopCategory.js';

if (fs.existsSync(filePath)) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the autocomplete function
    const newAutocomplete = `  async autocomplete(interaction) {
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

  // Replace the old autocomplete function
  content = content.replace(
    /async autocomplete\(interaction\) \{[\s\S]*?\},/,
    newAutocomplete
  );
  
  fs.writeFileSync(filePath, content);
  console.log(`✅ Fixed: ${filePath}`);
  
} catch (error) {
  console.log(`❌ Error fixing ${filePath}:`, error.message);
}

console.log(`\n💡 Test this one file first, then we'll fix the rest!`);
console.log(`💡 Restart your bot with: pm2 restart zentro-bot`);
}