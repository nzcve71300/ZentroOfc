const pool = require('./src/db');

async function checkTeleportConfigs() {
  try {
    console.log('🔍 Checking Teleport Configurations...\n');

    // Get all servers
    const [servers] = await pool.query(`
      SELECT rs.id, rs.nickname, g.discord_id 
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id
      ORDER BY rs.nickname
    `);

    console.log(`📋 Found ${servers.length} servers:\n`);

    for (const server of servers) {
      console.log(`🏠 Server: ${server.nickname} (ID: ${server.id})`);
      
      // Check all teleport types
      const teleports = ['default', 'tpne', 'tpe', 'tpse', 'tps', 'tpsw', 'tpw', 'tpnw'];
      let hasAnyConfig = false;
      
      for (const teleport of teleports) {
        const [configs] = await pool.query(
          'SELECT * FROM teleport_configs WHERE server_id = ? AND teleport_name = ?',
          [server.id, teleport]
        );
        
        if (configs.length > 0) {
          hasAnyConfig = true;
          const config = configs[0];
          console.log(`  ✅ ${teleport.toUpperCase()} Teleport Config:`);
          console.log(`     - Enabled: ${config.enabled ? 'Yes' : 'No'}`);
          console.log(`     - Position: ${config.position_x}, ${config.position_y}, ${config.position_z}`);
          console.log(`     - Display Name: ${config.display_name || 'Not set'}`);
          console.log(`     - Cooldown: ${config.cooldown_minutes} minutes`);
          console.log(`     - Use List: ${config.use_list ? 'Yes' : 'No'}`);
          console.log(`     - Kill Before Teleport: ${config.kill_before_teleport ? 'Yes' : 'No'}`);
          console.log(`     - Use Kit: ${config.use_kit ? 'Yes' : 'No'}`);
          console.log(`     - Kit Name: ${config.kit_name || 'Not set'}`);
          
          // Check allowed users
          const [allowedUsers] = await pool.query(
            'SELECT COUNT(*) as count FROM teleport_allowed_users WHERE server_id = ? AND teleport_name = ?',
            [server.id, teleport]
          );
          console.log(`     👥 Allowed Users: ${allowedUsers[0].count}`);
          
          // Check banned users
          const [bannedUsers] = await pool.query(
            'SELECT COUNT(*) as count FROM teleport_banned_users WHERE server_id = ? AND teleport_name = ?',
            [server.id, teleport]
          );
          console.log(`     🚫 Banned Users: ${bannedUsers[0].count}`);
        }
      }
      
      if (!hasAnyConfig) {
        console.log(`  ❌ No teleport configs found`);
        console.log(`     Use /set config:TPN-USE option:on server:${server.nickname} to enable`);
        console.log(`     Use /set config:TPN-COORDINATES option:"100,50,200" server:${server.nickname} to set position`);
      }
      
      console.log(''); // Empty line between servers
    }

  } catch (error) {
    console.error('❌ Error checking teleport configs:', error);
  } finally {
    await pool.end();
    console.log('✅ Database connection closed');
  }
}

checkTeleportConfigs();
