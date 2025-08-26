const mysql = require('mysql2/promise');
require('dotenv').config();

async function enableTeleportListSystem() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('🔧 Enabling Teleport List System...\n');

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
        // Check current use_list setting
        const [configResult] = await connection.execute(
          'SELECT use_list FROM teleport_configs WHERE server_id = ? AND teleport_name = ?',
          [server.id.toString(), teleportName]
        );

        if (configResult.length > 0) {
          const currentUseList = configResult[0].use_list;
          
          if (!currentUseList) {
            // Enable use_list
            console.log(`  ➕ Enabling list system for ${teleportName.toUpperCase()}`);
            await connection.execute(
              'UPDATE teleport_configs SET use_list = true WHERE server_id = ? AND teleport_name = ?',
              [server.id.toString(), teleportName]
            );
          } else {
            console.log(`  ✅ List system already enabled for ${teleportName.toUpperCase()}`);
          }
        }
      }
      console.log('');
    }

    console.log('✅ Teleport list system has been enabled for all teleports!');
    console.log('\n📝 Now ban lists and allowed lists will work properly:');
    console.log('- /add-to-list TPE-BANLIST [PLAYER] [SERVER] - Add to ban list');
    console.log('- /add-to-list TPE-LIST [PLAYER] [SERVER] - Add to allowed list');
    console.log('- /remove-from-list TPE-BANLIST [PLAYER] [SERVER] - Remove from ban list');
    console.log('- /remove-from-list TPE-LIST [PLAYER] [SERVER] - Remove from allowed list');

  } catch (error) {
    console.error('❌ Error enabling teleport list system:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

enableTeleportListSystem();
