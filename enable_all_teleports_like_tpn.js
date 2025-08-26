const mysql = require('mysql2/promise');
require('dotenv').config();

async function enableAllTeleportsLikeTPN() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('🔧 Enabling All Teleports Like TPN...\n');

    // Get all servers
    const [servers] = await connection.execute(`
      SELECT rs.id, rs.nickname, g.discord_id 
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id
      ORDER BY rs.nickname
    `);

    console.log(`📋 Found ${servers.length} servers:\n`);

    const teleportNames = ['tpne', 'tpe', 'tpse', 'tps', 'tpsw', 'tpw', 'tpnw'];

    for (const server of servers) {
      console.log(`🏠 Server: ${server.nickname} (ID: ${server.id})`);
      
      // First, get the TPN (default) configuration to copy from
      const [tpnConfig] = await connection.execute(
        'SELECT * FROM teleport_configs WHERE server_id = ? AND teleport_name = ?',
        [server.id.toString(), 'default']
      );

      if (tpnConfig.length === 0) {
        console.log(`  ❌ No TPN config found - skipping ${server.nickname}`);
        continue;
      }

      const tpnSettings = tpnConfig[0];
      console.log(`  📋 TPN Settings to copy:`);
      console.log(`     - Enabled: ${tpnSettings.enabled}`);
      console.log(`     - Cooldown: ${tpnSettings.cooldown_minutes} minutes`);
      console.log(`     - Use Kit: ${tpnSettings.use_kit}`);
      console.log(`     - Kit Name: ${tpnSettings.kit_name || 'Not set'}`);
      console.log(`     - Use List: ${tpnSettings.use_list}`);
      
      for (const teleportName of teleportNames) {
        // Check if config exists
        const [existingConfig] = await connection.execute(
          'SELECT * FROM teleport_configs WHERE server_id = ? AND teleport_name = ?',
          [server.id.toString(), teleportName]
        );

        if (existingConfig.length === 0) {
          // Create config with TPN settings
          console.log(`  ➕ Creating ${teleportName.toUpperCase()} config with TPN settings`);
          await connection.execute(`
            INSERT INTO teleport_configs (
              server_id, teleport_name, enabled, cooldown_minutes, delay_minutes, 
              display_name, use_list, use_delay, use_kit, kit_name, 
              position_x, position_y, position_z
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            server.id.toString(), 
            teleportName, 
            tpnSettings.enabled, 
            tpnSettings.cooldown_minutes, 
            tpnSettings.delay_minutes || 0,
            `${teleportName.toUpperCase()} Teleport`,
            tpnSettings.use_list,
            tpnSettings.use_delay || false,
            tpnSettings.use_kit,
            tpnSettings.kit_name || '',
            tpnSettings.position_x,
            tpnSettings.position_y,
            tpnSettings.position_z
          ]);
        } else {
          // Update existing config with TPN settings
          console.log(`  🔄 Updating ${teleportName.toUpperCase()} config with TPN settings`);
          await connection.execute(`
            UPDATE teleport_configs SET
              enabled = ?,
              cooldown_minutes = ?,
              delay_minutes = ?,
              display_name = ?,
              use_list = ?,
              use_delay = ?,
              use_kit = ?,
              kit_name = ?,
              position_x = ?,
              position_y = ?,
              position_z = ?
            WHERE server_id = ? AND teleport_name = ?
          `, [
            tpnSettings.enabled,
            tpnSettings.cooldown_minutes,
            tpnSettings.delay_minutes || 0,
            `${teleportName.toUpperCase()} Teleport`,
            tpnSettings.use_list,
            tpnSettings.use_delay || false,
            tpnSettings.use_kit,
            tpnSettings.kit_name || '',
            tpnSettings.position_x,
            tpnSettings.position_y,
            tpnSettings.position_z,
            server.id.toString(),
            teleportName
          ]);
        }
      }
      console.log('');
    }

    console.log('✅ All teleports have been configured to work exactly like TPN!');
    console.log('\n📝 Note: All teleports now have the same settings as TPN:');
    console.log('- Same enabled/disabled status');
    console.log('- Same cooldown time');
    console.log('- Same kit settings');
    console.log('- Same position coordinates');
    console.log('- Same list settings');
    console.log('\n🔧 To customize individual teleports, use:');
    console.log('/set config:TPE-COORDINATES option:"x,y,z" server:[SERVER]');
    console.log('/set config:TPE-USE option:on/off server:[SERVER]');

  } catch (error) {
    console.error('❌ Error enabling teleports:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

enableAllTeleportsLikeTPN();
