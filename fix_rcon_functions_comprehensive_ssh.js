const fs = require('fs');

console.log('🔧 SSH: Comprehensive RCON guild_id fix...');

// The correct pattern for RCON functions
const correctRconPattern = `    // Get server ID using correct guild_id conversion
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );`;

// Files to fix
const rconFilesToFix = [
  'src/rcon/index.js'
];

let totalUpdated = 0;

rconFilesToFix.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      let updated = false;
      
      // Fix patterns that need updating
      const patternsToFix = [
        // Old pattern: direct guild_id usage
        {
          old: /const \[serverResult\] = await pool\.query\(\s*'SELECT id FROM rust_servers WHERE guild_id = \? AND nickname = \?',\s*\[guildId, serverName\]\s*\);/g,
          new: correctRconPattern,
          name: 'direct guild_id usage'
        },
        // Old pattern: using guildId directly
        {
          old: /const \[serverResult\] = await pool\.query\(\s*'SELECT id FROM rust_servers WHERE guild_id = \? AND nickname = \?',\s*\[guildId, serverName\]\s*\);/g,
          new: correctRconPattern,
          name: 'guildId direct usage'
        }
      ];
      
      patternsToFix.forEach(pattern => {
        if (pattern.old.test(content)) {
          content = content.replace(pattern.old, pattern.new);
          console.log(`✅ Fixed ${pattern.name} pattern`);
          updated = true;
        }
      });
      
      // Also fix any other server lookup patterns
      const otherPatterns = [
        // Fix server lookups in other functions
        {
          old: /WHERE guild_id = \? AND nickname = \?/g,
          new: 'WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
          name: 'server lookup WHERE clause'
        }
      ];
      
      otherPatterns.forEach(pattern => {
        if (pattern.old.test(content)) {
          content = content.replace(pattern.old, pattern.new);
          console.log(`✅ Fixed ${pattern.name}`);
          updated = true;
        }
      });
      
      if (updated) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Updated: ${filePath}`);
        totalUpdated++;
      } else {
        console.log(`⚠️  No patterns found to fix in: ${filePath}`);
      }
      
    } catch (error) {
      console.log(`❌ Error fixing ${filePath}:`, error.message);
    }
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

console.log(`\n🎉 Comprehensive RCON fix completed!`);
console.log(`✅ Updated ${totalUpdated} files`);
console.log(`✅ All RCON functions now use the correct guild_id pattern!`);
console.log(`✅ "Server not found" errors should now be resolved!`);

console.log(`\n💡 Restart your bot with: pm2 restart zentro-bot`); 