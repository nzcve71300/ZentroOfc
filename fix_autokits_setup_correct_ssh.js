const fs = require('fs');

console.log('🔧 SSH: Corrected fix for autokitsSetup.js...');

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
    
    // Replace the old guildId assignment - look for the exact pattern
    if (content.includes('const guildId = interaction.guildId;')) {
      content = content.replace(/const guildId = interaction\.guildId;/g, guildIdConversionPattern);
      console.log('✅ Fixed guild_id conversion in autokitsSetup.js');
    } else {
      console.log('⚠️  Could not find guildId assignment pattern');
      console.log('💡 Looking for alternative patterns...');
      
      // Try alternative patterns
      if (content.includes('guildId = interaction.guildId')) {
        content = content.replace(/guildId = interaction\.guildId/g, 'discordGuildId = interaction.guildId');
        content = content.replace(/const \[serverResult\] = await pool\.query\(/g, 
          `    // Get the guild_id from the guilds table
    const [guildResult] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [discordGuildId]);
    
    if (guildResult.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Error', 'Guild not found in database.')]
      });
    }
    
    const guildId = guildResult[0].id;
    
    // Get server info
    const [serverResult] = await pool.query(`);
        console.log('✅ Fixed guild_id conversion using alternative pattern');
      }
    }
    
    fs.writeFileSync(filePath, content);
    console.log('✅ Updated: src/commands/admin/autokitsSetup.js');
    
  } catch (error) {
    console.log('❌ Error fixing autokitsSetup.js:', error.message);
  }
} else {
  console.log('⚠️  File not found: src/commands/admin/autokitsSetup.js');
}

console.log('\n🎉 Autokits setup corrected fix completed!');
console.log('💡 Restart your bot with: pm2 restart zentro-bot'); 