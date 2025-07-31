const mysql = require('mysql2/promise');
const config = require('./src/config');

async function fixIssues() {
  let connection;
  
  try {
    console.log('🔧 Fixing events and channel issues...');
    
    // Connect to database
    connection = await mysql.createConnection({
      host: config.db.host,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      port: config.db.port
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
      
      // Add some default event configurations
      const [servers] = await connection.execute('SELECT id FROM rust_servers');
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
    
    console.log('\n🎉 Events and channels should now work properly!');
    console.log('💡 Use /set-events to configure events and /channel-set to configure channels');
    
  } catch (error) {
    console.error('❌ Error during fixes:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixIssues(); 