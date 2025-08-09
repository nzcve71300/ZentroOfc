const pool = require('./src/db');

async function setupRiderConfig() {
  try {
    console.log('🔧 SSH: Setting up Book-a-Ride configuration tables...');

    // Create rider_config table
    console.log('\n📋 Creating rider_config table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rider_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        cooldown INT NOT NULL DEFAULT 300,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_server_rider (server_id),
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ rider_config table created/verified');

    // Create rider_cooldowns table
    console.log('\n📋 Creating rider_cooldowns table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rider_cooldowns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(255) NOT NULL,
        player_name VARCHAR(255) NOT NULL,
        vehicle_type ENUM('horse', 'rhib') NOT NULL,
        last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_server_player_vehicle (server_id, player_name, vehicle_type),
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ rider_cooldowns table created/verified');

    // Check current servers
    console.log('\n📊 Current servers:');
    const [servers] = await pool.query(`
      SELECT rs.id, rs.nickname, g.discord_id 
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id
    `);

    if (servers.length === 0) {
      console.log('   ❌ No servers found');
    } else {
      servers.forEach((server, index) => {
        console.log(`   ${index + 1}. ${server.nickname} (ID: ${server.id}, Guild: ${server.discord_id})`);
      });

      // Add default config for all servers
      console.log('\n⚙️ Adding default configurations for all servers...');
      for (const server of servers) {
        try {
          await pool.query(`
            INSERT IGNORE INTO rider_config (server_id, enabled, cooldown) 
            VALUES (?, 1, 300)
          `, [server.id]);
          console.log(`   ✅ Default config added for ${server.nickname}`);
        } catch (configError) {
          console.log(`   ⚠️ Config already exists for ${server.nickname}`);
        }
      }
    }

    // Verify configurations
    console.log('\n✅ Current Book-a-Ride configurations:');
    const [configs] = await pool.query(`
      SELECT rc.*, rs.nickname 
      FROM rider_config rc 
      JOIN rust_servers rs ON rc.server_id = rs.id
    `);

    if (configs.length === 0) {
      console.log('   ❌ No configurations found');
    } else {
      configs.forEach((config, index) => {
        console.log(`   ${index + 1}. ${config.nickname}: ${config.enabled ? 'Enabled' : 'Disabled'}, ${config.cooldown}s cooldown`);
      });
    }

    console.log('\n🎉 Book-a-Ride setup completed!');
    console.log('\n💡 Usage:');
    console.log('   1. Use /rider-setup to configure servers');
    console.log('   2. Players use the orders emote (d11_quick_chat_orders_slot_5) to request rides');
    console.log('   3. Players use yes/no emotes to choose Horse or Rhib');

  } catch (error) {
    console.error('❌ Setup error:', error);
  } finally {
    await pool.end();
  }
}

// Run the setup
setupRiderConfig().catch(console.error);