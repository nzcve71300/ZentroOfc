const fs = require('fs');

console.log('🔧 SSH: Final fix for autokitsSetup.js...');

const filePath = 'src/commands/admin/autokitsSetup.js';

if (fs.existsSync(filePath)) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Add guild_id conversion before the server lookup
    const guildIdConversionPattern = `    const discordGuildId = interaction.guildId;
    
    // Get the guild_id from the guilds table
    const [guildResult] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [discordGuildId]);
    
    if (guildResult.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Error', 'Guild not found in database.')]
      });
    }
    
    const guildId = guildResult[0].id;`;
    
    // Replace the old guildId assignment
    if (content.includes('const guildId = interaction.guildId;')) {
      content = content.replace(/const guildId = interaction\.guildId;/g, guildIdConversionPattern);
      console.log('✅ Fixed guild_id conversion in autokitsSetup.js');
    }
    
    fs.writeFileSync(filePath, content);
    console.log('✅ Updated: src/commands/admin/autokitsSetup.js');
    
  } catch (error) {
    console.log('❌ Error fixing autokitsSetup.js:', error.message);
  }
} else {
  console.log('⚠️  File not found: src/commands/admin/autokitsSetup.js');
}

console.log('\n🎉 Autokits setup final fix completed!');
console.log('💡 Restart your bot with: pm2 restart zentro-bot'); 