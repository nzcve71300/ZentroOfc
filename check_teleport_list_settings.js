const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkTeleportListSettings() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('🔍 Checking Teleport List Settings...\n');

    // Get all servers
    const [servers] = await connection.execute(`
      SELECT rs.id, rs.nickname, g.discord_id 
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id
      ORDER BY rs.nickname
    `);

    console.log(`📋 Found ${servers.length} servers:\n`);

    const teleportNames = ['default', 'tpne', 'tpe', 'tpse', 'tps', 'tpsw', 'tpw', 'tpnw'];

    for (const server of servers) {
      console.log(`🏠 Server: ${server.nickname} (ID: ${server.id})`);
      
      for (const teleportName of teleportNames) {
        // Check teleport config
        const [configResult] = await connection.execute(
          'SELECT use_list, enabled FROM teleport_configs WHERE server_id = ? AND teleport_name = ?',
          [server.id.toString(), teleportName]
        );

        if (configResult.length > 0) {
          const config = configResult[0];
          console.log(`  📋 ${teleportName.toUpperCase()}:`);
          console.log(`     - Enabled: ${config.enabled ? 'Yes' : 'No'}`);
          console.log(`     - Use List: ${config.use_list ? 'Yes' : 'No'}`);
          
          // Check if there are any banned users
          const [bannedResult] = await connection.execute(
            'SELECT COUNT(*) as count FROM teleport_banned_users WHERE server_id = ? AND teleport_name = ?',
            [server.id.toString(), teleportName]
          );
          
          // Check if there are any allowed users
          const [allowedResult] = await connection.execute(
            'SELECT COUNT(*) as count FROM teleport_allowed_users WHERE server_id = ? AND teleport_name = ?',
            [server.id.toString(), teleportName]
          );
          
          console.log(`     - Banned Users: ${bannedResult[0].count}`);
          console.log(`     - Allowed Users: ${allowedResult[0].count}`);
          
          if (config.use_list && config.enabled) {
            console.log(`     ⚠️  LIST SYSTEM ACTIVE - Ban list will be checked`);
          } else if (!config.use_list && config.enabled) {
            console.log(`     ❌ LIST SYSTEM DISABLED - Ban list will be ignored`);
          }
        }
      }
      console.log('');
    }

    console.log('✅ Teleport list settings check completed!');
    console.log('\n📝 To enable list system (ban/allowed lists):');
    console.log('/set config:TPE-USELIST option:on server:[SERVER]');

  } catch (error) {
    console.error('❌ Error checking teleport list settings:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

checkTeleportListSettings();
