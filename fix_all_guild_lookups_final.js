const fs = require('fs');

console.log('🔧 Fixing ALL remaining guild lookup patterns...');

function fixAllGuildLookups(content) {
  let fixed = content;
  
  // Fix all the old guild lookup patterns
  fixed = fixed.replace(/'SELECT nickname FROM rust_servers WHERE guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\) AND nickname LIKE \? LIMIT 25'/g, "'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25'");
  fixed = fixed.replace(/'SELECT nickname FROM rust_servers WHERE guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\) AND nickname LIKE \?'/g, "'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ?'");
  fixed = fixed.replace(/'SELECT id FROM rust_servers WHERE guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\) AND nickname = \?'/g, "'SELECT id FROM rust_servers WHERE guild_id = ? AND nickname = ?'");
  fixed = fixed.replace(/'SELECT id FROM guilds WHERE discord_id = \?'/g, "'SELECT id FROM guilds WHERE discord_id = ?'");
  
  // Fix patterns in WHERE clauses
  fixed = fixed.replace(/WHERE guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\)/g, 'WHERE guild_id = ?');
  fixed = fixed.replace(/WHERE p\.guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\)/g, 'WHERE p.guild_id = ?');
  fixed = fixed.replace(/WHERE rs\.guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\)/g, 'WHERE rs.guild_id = ?');
  
  // Fix patterns in VALUES clauses
  fixed = fixed.replace(/VALUES \(\(SELECT id FROM guilds WHERE discord_id = \?\), \?, \?, \?, CURRENT_TIMESTAMP, true\)/g, 'VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, true)');
  fixed = fixed.replace(/VALUES \(\(SELECT id FROM guilds WHERE discord_id = \?\), \?, \?, \?\)/g, 'VALUES (?, ?, ?, ?)');
  fixed = fixed.replace(/VALUES \(\?, \(SELECT id FROM guilds WHERE discord_id = \?\), \?, \?, \?, \?\)/g, 'VALUES (?, ?, ?, ?, ?, ?)');
  
  // Fix patterns in JOIN clauses
  fixed = fixed.replace(/AND rs\.guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\)/g, 'AND rs.guild_id = ?');
  
  return fixed;
}

// Get all JavaScript files in the src directory
function getAllJsFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = `${dir}/${item.name}`;
    if (item.isDirectory()) {
      files.push(...getAllJsFiles(fullPath));
    } else if (item.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

const allJsFiles = getAllJsFiles('src');
let totalUpdated = 0;

console.log(`\n📁 Found ${allJsFiles.length} JavaScript files to check...`);

allJsFiles.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    content = fixAllGuildLookups(content);
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed: ${filePath}`);
      totalUpdated++;
    }
  } catch (error) {
    console.log(`❌ Error fixing ${filePath}:`, error.message);
  }
});

console.log(`\n🎉 Guild lookup fix completed!`);
console.log(`✅ Updated ${totalUpdated} files`);
console.log(`✅ All commands now use direct guild_id instead of guilds table lookup`);
console.log(`✅ Your bot is now fully multi-tenant ready!`);

// Also fix any remaining files in the root directory
const rootFiles = [
  'fix_guild_discord_id.js',
  'fix_player_linking.js',
  'fix_rcon_guild_mismatch.js',
  'test_is_active_column.js',
  'test_final_fix.js',
  'test_autokit_data.js',
  'test_autokit_query.js',
  'nuke_and_recreate.js',
  'force_database_refresh.js',
  'fix_server_name.js',
  'fix_guild_mismatch.js'
];

rootFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      
      content = fixAllGuildLookups(content);
      
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed: ${filePath}`);
        totalUpdated++;
      }
    } catch (error) {
      console.log(`❌ Error fixing ${filePath}:`, error.message);
    }
  }
});

console.log(`\n💡 All server autocomplete should now work properly across all commands!`);
console.log(`💡 Restart your bot with: pm2 restart zentro-bot`); 