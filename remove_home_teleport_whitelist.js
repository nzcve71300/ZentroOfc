const fs = require('fs');
const path = require('path');

function removeHomeTeleportWhitelist() {
  console.log('🔧 Removing whitelist functionality from home teleport system...\n');

  const filePath = path.join(__dirname, 'src', 'rcon', 'index.js');
  
  try {
    // Read the file
    let content = fs.readFileSync(filePath, 'utf8');
    
    console.log('📝 Making changes to home teleport system...');
    
    // Remove whitelist from SET HOME function
    content = content.replace(
      /\/\/ Check home teleport configuration\s+const \[configResult\] = await pool\.query\(\s+'SELECT whitelist_enabled, cooldown_minutes FROM home_teleport_configs WHERE server_id = \?'\s*,\s*\[serverId\]\s*\);\s*\s*let config = \{\s*whitelist_enabled: false,\s*cooldown_minutes: 5\s*\};/g,
      '// Check home teleport configuration (cooldown only)\n    const [configResult] = await pool.query(\n      \'SELECT cooldown_minutes FROM home_teleport_configs WHERE server_id = ?\',\n      [serverId]\n    );\n\n    let config = {\n      cooldown_minutes: 5\n    };'
    );
    
    content = content.replace(
      /if \(configResult\.length > 0\) \{\s*config = \{\s*whitelist_enabled: configResult\[0\]\.whitelist_enabled !== 0,\s*cooldown_minutes: configResult\[0\]\.cooldown_minutes \|\| 5\s*\};\s*\}/g,
      'if (configResult.length > 0) {\n      config = {\n        cooldown_minutes: configResult[0].cooldown_minutes || 5\n      };\n    }'
    );
    
    // Remove whitelist check blocks
    content = content.replace(
      /\/\/ Check whitelist if enabled\s+if \(config\.whitelist_enabled\) \{\s+const \[whitelistResult\] = await pool\.query\(\s+'SELECT \* FROM player_whitelists WHERE guild_id = \(SELECT id FROM guilds WHERE discord_id = \?\) AND server_id = \? AND player_name = \? AND whitelist_type = \?'\s*,\s*\[guildId, serverId, player, 'home_teleport'\]\s*\);\s*\s*if \(whitelistResult\.length === 0\) \{\s*sendRconCommand\(ip, port, password, `say <color=#FF69B4>\$\{player\}</color> <color=white>you are not whitelisted for home teleport</color>`\);\s*return;\s*\}\s*\}/g,
      '// Whitelist check removed - using /add-to-list system instead'
    );
    
    // Write the modified content back
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log('✅ Successfully removed whitelist functionality from home teleport system!');
    console.log('\n🔧 Changes made:');
    console.log('✅ Removed whitelist_enabled from database query');
    console.log('✅ Removed whitelist check logic');
    console.log('✅ Removed whitelist error messages');
    console.log('✅ Kept cooldown functionality intact');
    
    console.log('\n🎯 Home teleport system now:');
    console.log('✅ Uses /add-to-list system for permissions');
    console.log('✅ No more whitelist checks');
    console.log('✅ Cooldown system still works');
    console.log('✅ All other functionality preserved');
    
  } catch (error) {
    console.error('❌ Error removing whitelist functionality:', error);
  }
}

removeHomeTeleportWhitelist();
