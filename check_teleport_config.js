const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkTeleportConfig() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('🔍 Checking Teleport Configurations...\n');

    // Get all servers
    const [servers] = await connection.execute(`
      SELECT rs.id, rs.nickname, g.discord_id as guild_discord_id
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
      ORDER BY rs.nickname
    `);

    console.log(`📋 Found ${servers.length} servers:\n`);

    for (const server of servers) {
      console.log(`🏠 Server: ${server.nickname} (ID: ${server.id})`);
      
      // Check teleport config
      const [configs] = await connection.execute(`
        SELECT * FROM teleport_configs 
        WHERE server_id = ? AND teleport_name = 'default'
      `, [server.id.toString()]);

      if (configs.length > 0) {
        const config = configs[0];
        console.log(`  ✅ Teleport config found:`);
        console.log(`     - Enabled: ${config.enabled ? 'Yes' : 'No'}`);
        console.log(`     - Position: ${config.position_x}, ${config.position_y}, ${config.position_z}`);
        console.log(`     - Display Name: ${config.display_name || 'Teleport'}`);
        console.log(`     - Cooldown: ${config.cooldown_minutes} minutes`);
        console.log(`     - Use List: ${config.use_list ? 'Yes' : 'No'}`);
        console.log(`     - Kill Before Teleport: ${config.kill_before_teleport ? 'Yes' : 'No'}`);
        console.log(`     - Use Kit: ${config.use_kit ? 'Yes' : 'No'}`);
        if (config.use_kit) {
          console.log(`     - Kit Name: ${config.kit_name || 'Not set'}`);
        }
      } else {
        console.log(`  ❌ No teleport config found`);
        console.log(`     Use /set config:TPN-USE option:on server:${server.nickname} to enable`);
        console.log(`     Use /set config:TPN-COORDINATES option:"100,50,200" server:${server.nickname} to set position`);
      }

      // Check allowed users
      const [allowedUsers] = await connection.execute(`
        SELECT * FROM teleport_allowed_users 
        WHERE server_id = ? AND teleport_name = 'default'
      `, [server.id.toString()]);

      if (allowedUsers.length > 0) {
        console.log(`  👥 Allowed Users: ${allowedUsers.length}`);
      }

      // Check banned users
      const [bannedUsers] = await connection.execute(`
        SELECT * FROM teleport_banned_users 
        WHERE server_id = ? AND teleport_name = 'default'
      `, [server.id.toString()]);

      if (bannedUsers.length > 0) {
        console.log(`  🚫 Banned Users: ${bannedUsers.length}`);
      }

      console.log('');
    }

    await connection.end();
    console.log('✅ Database connection closed');

  } catch (error) {
    console.error('❌ Error checking teleport config:', error);
  }
}

checkTeleportConfig();
