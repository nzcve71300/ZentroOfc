const pool = require('./src/db');

async function debugServerIds() {
  try {
    console.log('🔍 Debugging Server IDs...');
    
    // Check guilds
    const [guilds] = await pool.query('SELECT * FROM guilds');
    console.log('\n📋 Guilds:');
    guilds.forEach(guild => {
      console.log(`- ID: ${guild.id}, Discord ID: ${guild.discord_id}, Name: ${guild.name}`);
    });

    // Check rust_servers
    const [servers] = await pool.query('SELECT * FROM rust_servers');
    console.log('\n🖥️ Rust Servers:');
    servers.forEach(server => {
      console.log(`- ID: ${server.id}, Guild ID: ${server.guild_id}, Nickname: ${server.nickname}, IP: ${server.ip}:${server.port}`);
    });

    // Check if position_coordinates table exists
    const [tables] = await pool.query("SHOW TABLES LIKE 'position_coordinates'");
    if (tables.length > 0) {
      console.log('\n📍 Position Coordinates:');
      const [coords] = await pool.query('SELECT * FROM position_coordinates');
      coords.forEach(coord => {
        console.log(`- Server ID: ${coord.server_id}, Type: ${coord.position_type}, Coords: ${coord.x_pos},${coord.y_pos},${coord.z_pos}`);
      });
    } else {
      console.log('\n❌ position_coordinates table does not exist');
    }

    // Check if position_configs table exists
    const [configTables] = await pool.query("SHOW TABLES LIKE 'position_configs'");
    if (configTables.length > 0) {
      console.log('\n⚙️ Position Configs:');
      const [configs] = await pool.query('SELECT * FROM position_configs');
      configs.forEach(config => {
        console.log(`- Server ID: ${config.server_id}, Type: ${config.position_type}, Enabled: ${config.enabled}, Delay: ${config.delay_seconds}s, Cooldown: ${config.cooldown_minutes}m`);
      });
    } else {
      console.log('\n❌ position_configs table does not exist');
    }

    console.log('\n🎉 Debug complete!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

debugServerIds(); 