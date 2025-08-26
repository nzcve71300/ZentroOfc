const mysql = require('mysql2/promise');
require('dotenv').config();

async function deployEventSystem() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('🚀 Deploying Event System...\n');

    // Create event_configs table
    console.log('📋 Creating event_configs table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS event_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        event_type ENUM('bradley', 'helicopter') NOT NULL,
        enabled BOOLEAN DEFAULT FALSE,
        kill_message TEXT,
        respawn_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (server_id) REFERENCES rust_servers(id) ON DELETE CASCADE,
        UNIQUE KEY unique_server_event (server_id, event_type)
      )
    `);

    // Create indexes
    console.log('🔍 Creating indexes...');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_event_configs_server ON event_configs(server_id)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_event_configs_type ON event_configs(event_type)');
    await connection.execute('CREATE INDEX IF NOT EXISTS idx_event_configs_enabled ON event_configs(enabled)');

    // Get all servers
    console.log('🏠 Setting up event configs for all servers...');
    const [servers] = await connection.execute(`
      SELECT rs.id, rs.nickname 
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id
      ORDER BY rs.nickname
    `);

    for (const server of servers) {
      console.log(`  📋 Setting up ${server.nickname}...`);
      
      // Create Bradley config
      await connection.execute(`
        INSERT IGNORE INTO event_configs (server_id, event_type, enabled, kill_message, respawn_message)
        VALUES (?, 'bradley', false, '<color=#00ffff>Brad got taken</color>', '<color=#00ffff>Bradley APC has respawned</color>')
      `, [server.id.toString()]);

      // Create Helicopter config
      await connection.execute(`
        INSERT IGNORE INTO event_configs (server_id, event_type, enabled, kill_message, respawn_message)
        VALUES (?, 'helicopter', false, '<color=#00ffff>Heli got taken</color>', '<color=#00ffff>Patrol Helicopter has respawned</color>')
      `, [server.id.toString()]);
    }

    console.log('\n✅ Event system deployed successfully!');
    console.log('\n📝 Usage:');
    console.log('/set config:BRADLEY-SCOUT option:on server:[SERVER] - Enable Bradley detection');
    console.log('/set config:HELICOPTER-SCOUT option:on server:[SERVER] - Enable Helicopter detection');
    console.log('/set config:BRADLEY-KILLMSG option:"[MESSAGE]" server:[SERVER] - Set Bradley kill message');
    console.log('/set config:BRADLEY-RESPAWNMSG option:"[MESSAGE]" server:[SERVER] - Set Bradley respawn message');
    console.log('/set config:HELICOPTER-KILLMSG option:"[MESSAGE]" server:[SERVER] - Set Helicopter kill message');
    console.log('/set config:HELICOPTER-RESPAWNMSG option:"[MESSAGE]" server:[SERVER] - Set Helicopter respawn message');

  } catch (error) {
    console.error('❌ Error deploying event system:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

deployEventSystem();
