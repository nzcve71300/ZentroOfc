const pool = require('./src/db');

async function fixEventsAndChannels() {
  try {
    console.log('🔧 Quick fix for events and channels...');
    
    // Check if event_configs table exists
    console.log('\n📋 Checking event_configs table...');
    const [eventTables] = await pool.query("SHOW TABLES LIKE 'event_configs'");
    if (eventTables.length === 0) {
      console.log('❌ event_configs table does not exist! Creating it...');
      
      // Create event_configs table
      await pool.query(`
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
      const [servers] = await pool.query('SELECT id FROM rust_servers');
      console.log(`📊 Found ${servers.length} servers, adding default event configs...`);
      
      for (const server of servers) {
        await pool.query(`
          INSERT INTO event_configs (server_id, event_type, enabled, kill_message, respawn_message) 
          VALUES (?, 'bradley', false, 'Bradley APC has spawned!', 'Bradley APC has respawned!')
        `, [server.id]);
        
        await pool.query(`
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
    const [channelTables] = await pool.query("SHOW TABLES LIKE 'channel_settings'");
    if (channelTables.length === 0) {
      console.log('❌ channel_settings table does not exist! Creating it...');
      
      // Create channel_settings table
      await pool.query(`
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
    const [invalidChannels] = await pool.query(`
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
      await pool.query(`
        DELETE FROM channel_settings 
        WHERE channel_id = '1400098668123783200'
      `);
      
      console.log('✅ Cleaned up invalid channel IDs');
    } else {
      console.log('✅ No invalid channel IDs found');
    }
    
    // Verify fixes
    console.log('\n✅ Verification:');
    const [eventConfigs] = await pool.query('SELECT COUNT(*) as count FROM event_configs');
    console.log(`  - Event configurations: ${eventConfigs[0].count}`);
    
    const [channelSettings] = await pool.query('SELECT COUNT(*) as count FROM channel_settings');
    console.log(`  - Channel settings: ${channelSettings[0].count}`);
    
    // Show current servers
    const [servers] = await pool.query('SELECT id, nickname FROM rust_servers');
    console.log(`  - Servers: ${servers.length}`);
    servers.forEach(server => {
      console.log(`    - ${server.nickname} (ID: ${server.id})`);
    });
    
    console.log('\n🎉 Events and channels should now work properly!');
    console.log('💡 Use /set-events to configure events and /channel-set to configure channels');
    console.log('💡 Restart the bot: pm2 restart zentro-bot');
    
  } catch (error) {
    console.error('❌ Error during fixes:', error);
  } finally {
    await pool.end();
  }
}

fixEventsAndChannels(); 