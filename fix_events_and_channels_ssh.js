const mysql = require('mysql2/promise');

async function fixEventsAndChannels() {
  let connection;
  
  try {
    console.log('🔧 Fixing events and channel issues via SSH...');
    
    // Connect to database using default MariaDB settings
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'zentro_user',
      password: 'zentro_password',
      database: 'zentro_bot',
      port: 3306
    });
    
    console.log('✅ Database connection successful');
    
    // Check if event_configs table exists
    console.log('\n📋 Checking event_configs table...');
    const [eventTables] = await connection.execute("SHOW TABLES LIKE 'event_configs'");
    if (eventTables.length === 0) {
      console.log('❌ event_configs table does not exist! Creating it...');
      
      // Create event_configs table
      await connection.execute(`
        CREATE TABLE event_configs (
          id SERIAL PRIMARY KEY,
          server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          enabled BOOLEAN DEFAULT false,
          kill_message TEXT,
          respawn_message TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(server_id, event_type)
        )
      `);
      
      console.log('✅ event_configs table created successfully');
      
      // Add default event configurations for all servers
      const [servers] = await connection.execute('SELECT id FROM rust_servers');
      console.log(`📊 Found ${servers.length} servers, adding default event configs...`);
      
      for (const server of servers) {
        await connection.execute(`
          INSERT INTO event_configs (server_id, event_type, enabled, kill_message, respawn_message) 
          VALUES (?, 'bradley', false, 'Bradley APC has spawned!', 'Bradley APC has respawned!')
        `, [server.id]);
        
        await connection.execute(`
          INSERT INTO event_configs (server_id, event_type, enabled, kill_message, respawn_message) 
          VALUES (?, 'helicopter', false, 'Helicopter has spawned!', 'Helicopter has respawned!')
        `, [server.id]);
      }
      
      console.log(`✅ Added default event configurations for ${servers.length} servers`);
    } else {
      console.log('✅ event_configs table already exists');
    }
    
    // Check if channel_settings table exists
    console.log('\n📋 Checking channel_settings table...');
    const [channelTables] = await connection.execute("SHOW TABLES LIKE 'channel_settings'");
    if (channelTables.length === 0) {
      console.log('❌ channel_settings table does not exist! Creating it...');
      
      // Create channel_settings table
      await connection.execute(`
        CREATE TABLE channel_settings (
          id SERIAL PRIMARY KEY,
          server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
          channel_type TEXT NOT NULL,
          channel_id VARCHAR(32) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(server_id, channel_type)
        )
      `);
      
      console.log('✅ channel_settings table created successfully');
    } else {
      console.log('✅ channel_settings table already exists');
    }
    
    // Clean up invalid channel IDs
    console.log('\n🧹 Cleaning up invalid channel IDs...');
    const [invalidChannels] = await connection.execute(`
      SELECT cs.*, rs.nickname 
      FROM channel_settings cs 
      JOIN rust_servers rs ON cs.server_id = rs.id 
      WHERE cs.channel_id = '1400098668123783200'
    `);
    
    if (invalidChannels.length > 0) {
      console.log(`❌ Found ${invalidChannels.length} invalid channel IDs to clean up:`);
      invalidChannels.forEach(channel => {
        console.log(`  - Server: ${channel.nickname}, Type: ${channel.channel_type}, Channel ID: ${channel.channel_id}`);
      });
      
      // Delete invalid channel settings
      await connection.execute(`
        DELETE FROM channel_settings 
        WHERE channel_id = '1400098668123783200'
      `);
      
      console.log('✅ Cleaned up invalid channel IDs');
    } else {
      console.log('✅ No invalid channel IDs found');
    }
    
    // Verify fixes
    console.log('\n✅ Verification:');
    const [eventConfigs] = await connection.execute('SELECT COUNT(*) as count FROM event_configs');
    console.log(`  - Event configurations: ${eventConfigs[0].count}`);
    
    const [channelSettings] = await connection.execute('SELECT COUNT(*) as count FROM channel_settings');
    console.log(`  - Channel settings: ${channelSettings[0].count}`);
    
    // Show current servers
    const [servers] = await connection.execute('SELECT id, nickname FROM rust_servers');
    console.log(`  - Servers: ${servers.length}`);
    servers.forEach(server => {
      console.log(`    - ${server.nickname} (ID: ${server.id})`);
    });
    
    console.log('\n🎉 Events and channels should now work properly!');
    console.log('💡 Use /set-events to configure events and /channel-set to configure channels');
    console.log('💡 Restart the bot to apply changes');
    
  } catch (error) {
    console.error('❌ Error during fixes:', error);
    console.log('\n💡 If connection failed, make sure:');
    console.log('1. MariaDB is running: sudo systemctl status mariadb');
    console.log('2. Database exists: mysql -u zentro_user -p zentro_bot');
    console.log('3. User has permissions: GRANT ALL ON zentro_bot.* TO zentro_user@localhost');
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixEventsAndChannels(); 