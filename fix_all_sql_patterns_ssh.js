const fs = require('fs');

console.log('🔧 SSH: Fixing all SQL pattern issues...');

// Files to check and fix
const filesToCheck = [
  'src/commands/admin/autokitsSetup.js',
  'src/commands/admin/ecoGamesSetup.js',
  'src/commands/admin/killfeedSetup.js',
  'src/commands/admin/removeFromKitList.js',
  'src/commands/admin/setCurrency.js',
  'src/commands/admin/setEvents.js',
  'src/commands/admin/viewAutokitsConfigs.js',
  'src/commands/admin/viewEvents.js',
  'src/commands/admin/viewKitListPlayers.js',
  'src/commands/admin/wipeKitClaims.js',
  'src/commands/admin/openShop.js',
  'src/commands/admin/killfeed.js',
  'src/commands/admin/addToKitList.js',
  'src/utils/economy.js'
];

let totalUpdated = 0;

filesToCheck.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let updated = false;
      
      // Fix patterns that use rs.nickname without proper table alias
      const patternsToFix = [
        // Fix queries that use rs.nickname but don't have proper table alias
        {
          old: /WHERE guild_id = \? AND rs\.nickname = \?/g,
          new: 'WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
          name: 'rs.nickname without table alias'
        },
        // Fix queries that use rs.id but don't have proper table alias
        {
          old: /WHERE guild_id = \? AND rs\.id = \?/g,
          new: 'WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND id = ?',
          name: 'rs.id without table alias'
        }
      ];
      
      patternsToFix.forEach(pattern => {
        if (pattern.old.test(content)) {
          content = content.replace(pattern.old, pattern.new);
          console.log(`✅ Fixed ${pattern.name} in: ${filePath}`);
          updated = true;
        }
      });
      
      // Also check for any other malformed queries
      if (content.includes('rs.nickname') && !content.includes('FROM rust_servers rs')) {
        console.log(`⚠️  Found rs.nickname without table alias in: ${filePath}`);
        // Replace rs.nickname with nickname
        content = content.replace(/rs\.nickname/g, 'nickname');
        console.log(`✅ Fixed rs.nickname references in: ${filePath}`);
        updated = true;
      }
      
      if (content.includes('rs.id') && !content.includes('FROM rust_servers rs')) {
        console.log(`⚠️  Found rs.id without table alias in: ${filePath}`);
        // Replace rs.id with id
        content = content.replace(/rs\.id/g, 'id');
        console.log(`✅ Fixed rs.id references in: ${filePath}`);
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

console.log(`\n🎉 SQL pattern fix completed!`);
console.log(`✅ Updated ${totalUpdated} files`);
console.log(`✅ All SQL queries now use correct patterns!`);

console.log(`\n💡 Restart your bot with: pm2 restart zentro-bot`); 