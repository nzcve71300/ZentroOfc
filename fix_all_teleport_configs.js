const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixTeleportConfigs() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('🔧 Fixing Teleport Configurations...\n');

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
        // Check if config exists
        const [existingConfig] = await connection.execute(
          'SELECT * FROM teleport_configs WHERE server_id = ? AND teleport_name = ?',
          [server.id.toString(), teleportName]
        );

        if (existingConfig.length === 0) {
          // Create default config
          console.log(`  ➕ Creating config for ${teleportName.toUpperCase()}`);
          await connection.execute(`
            INSERT INTO teleport_configs (
              server_id, teleport_name, enabled, cooldown_minutes, delay_minutes, 
              display_name, use_list, use_delay, use_kit, kit_name, 
              position_x, position_y, position_z
            ) VALUES (?, ?, false, 60, 0, ?, false, false, false, '', 0, 0, 0)
          `, [server.id.toString(), teleportName, teleportName.toUpperCase()]);
        } else {
          const config = existingConfig[0];
          console.log(`  ✅ ${teleportName.toUpperCase()} config exists:`);
          console.log(`     - Enabled: ${config.enabled ? 'Yes' : 'No'}`);
          console.log(`     - Position: ${config.position_x}, ${config.position_y}, ${config.position_z}`);
          console.log(`     - Display Name: ${config.display_name}`);
          console.log(`     - Cooldown: ${config.cooldown_minutes} minutes`);
          console.log(`     - Use Kit: ${config.use_kit ? 'Yes' : 'No'}`);
          console.log(`     - Kit Name: ${config.kit_name || 'Not set'}`);
        }
      }
      console.log('');
    }

    console.log('✅ All teleport configurations have been checked and created if missing!');
    console.log('\n📝 Next steps:');
    console.log('1. Use /set config:TPE-USE option:on server:[SERVER] to enable each teleport');
    console.log('2. Use /set config:TPE-COORDINATES option:"x,y,z" server:[SERVER] to set positions');
    console.log('3. Use /set config:TPE-USE-KIT option:on server:[SERVER] to enable kits');
    console.log('4. Use /set config:TPE-KITNAME option:[KITNAME] server:[SERVER] to set kit names');

  } catch (error) {
    console.error('❌ Error fixing teleport configs:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

fixTeleportConfigs();
