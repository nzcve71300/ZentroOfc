const fs = require('fs');

console.log('🔧 SSH: Fixing all remaining guild_id and SQL pattern issues...');

// Files that need fixing
const filesToFix = [
  'src/commands/admin/editShopCategory.js',
  'src/commands/admin/editShopItem.js',
  'src/commands/admin/editShopKit.js',
  'src/commands/admin/removeShopCategory.js',
  'src/commands/admin/removeShopItem.js',
  'src/commands/admin/removeShopKit.js',
  'src/commands/admin/removeServer.js',
  'src/commands/admin/testMessage.js',
  'src/commands/player/shop.js'
];

let totalUpdated = 0;

filesToFix.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let updated = false;
      
      // Fix 1: Replace rs.nickname without table alias
      if (content.includes('rs.nickname') && !content.includes('FROM rust_servers rs')) {
        content = content.replace(/rs\.nickname/g, 'nickname');
        console.log(`✅ Fixed rs.nickname references in: ${filePath}`);
        updated = true;
      }
      
      // Fix 2: Replace rs.id without table alias
      if (content.includes('rs.id') && !content.includes('FROM rust_servers rs')) {
        content = content.replace(/rs\.id/g, 'id');
        console.log(`✅ Fixed rs.id references in: ${filePath}`);
        updated = true;
      }
      
      // Fix 3: Replace direct guild_id usage with proper conversion
      if (content.includes('WHERE guild_id = ? AND nickname = ?')) {
        content = content.replace(
          /WHERE guild_id = \? AND nickname = \?/g,
          'WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?'
        );
        console.log(`✅ Fixed direct guild_id usage in: ${filePath}`);
        updated = true;
      }
      
      // Fix 4: Replace old guild_id assignment pattern
      if (content.includes('guildId = interaction.guildId')) {
        const guildIdConversionPattern = `    const discordGuildId = interaction.guildId;
    
    // Get the guild_id from the guilds table
    const [guildResult] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [discordGuildId]);
    
    if (guildResult.length === 0) {
      return interaction.editReply({
        embeds: [errorEmbed('Error', 'Guild not found in database.')]
      });
    }
    
    const guildId = guildResult[0].id;`;
        
        content = content.replace(/const guildId = interaction\.guildId;/g, guildIdConversionPattern);
        console.log(`✅ Fixed guild_id assignment in: ${filePath}`);
        updated = true;
      }
      
      if (updated) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Updated: ${filePath}`);
        totalUpdated++;
      }
      
    } catch (error) {
      console.log(`❌ Error fixing ${filePath}:`, error.message);
    }
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

console.log(`\n🎉 Remaining issues fix completed!`);
console.log(`✅ Updated ${totalUpdated} files`);
console.log(`✅ All remaining guild_id and SQL pattern issues should be resolved!`);

console.log(`\n💡 Restart your bot with: pm2 restart zentro-bot`); 