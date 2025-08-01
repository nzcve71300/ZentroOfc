const pool = require('./src/db');

async function testPositionConfig() {
  try {
    console.log('🔍 Testing Position Configuration...');

    // Get all servers
    const [servers] = await pool.query('SELECT id, nickname FROM rust_servers');
    console.log(`Found ${servers.length} servers:`);
    
    for (const server of servers) {
      console.log(`\n📡 Server: ${server.nickname} (ID: ${server.id})`);
      
      // Check position configs
      const [configs] = await pool.query(
        'SELECT position_type, enabled, delay_seconds, cooldown_minutes FROM position_configs WHERE server_id = ?',
        [server.id.toString()]
      );
      
      console.log(`  Configs: ${configs.length} found`);
      configs.forEach(config => {
        console.log(`    ${config.position_type}: enabled=${config.enabled}, delay=${config.delay_seconds}s, cooldown=${config.cooldown_minutes}m`);
      });
      
      // Check position coordinates
      const [coords] = await pool.query(
        'SELECT position_type, x_pos, y_pos, z_pos FROM position_coordinates WHERE server_id = ?',
        [server.id.toString()]
      );
      
      console.log(`  Coordinates: ${coords.length} found`);
      coords.forEach(coord => {
        console.log(`    ${coord.position_type}: X=${coord.x_pos}, Y=${coord.y_pos}, Z=${coord.z_pos}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testPositionConfig(); 