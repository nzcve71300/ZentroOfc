const fs = require('fs');

console.log('🔧 SSH: Fixing autokitsSetup.js query pattern...');

// The correct pattern for autokitsSetup.js
const correctAutokitsPattern = `      // Get server info
      const [serverResult] = await pool.query(
        'SELECT rs.id, rs.nickname FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ? AND rs.nickname = ?',
        [guildId, serverOption]
      );`;

// Files to fix
const filesToFix = [
  'src/commands/admin/autokitsSetup.js'
];

let totalUpdated = 0;

filesToFix.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Check if this file has the wrong pattern
      if (content.includes('SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?')) {
        // Replace the wrong pattern with the correct one
        content = content.replace(
          /const \[serverResult\] = await pool\.query\(\s*'SELECT id FROM rust_servers WHERE guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\) AND nickname = \?',\s*\[guildId, serverOption\]\s*\);/g,
          correctAutokitsPattern
        );
        
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed: ${filePath}`);
        totalUpdated++;
      } else {
        console.log(`⚠️  No wrong pattern found in: ${filePath}`);
      }
      
    } catch (error) {
      console.log(`❌ Error fixing ${filePath}:`, error.message);
    }
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

console.log(`\n🎉 Autokits setup fix completed!`);
console.log(`✅ Updated ${totalUpdated} files`);
console.log(`✅ Autokits setup now uses the correct query pattern!`);

console.log(`\n💡 Restart your bot with: pm2 restart zentro-bot`); 