const pool = require('./src/db');

async function fixChannelIdLength() {
  try {
    console.log('🔧 Fixing channel_id column length for long Discord IDs...');
    
    // Check if channel_settings table exists
    const [channelTables] = await pool.query("SHOW TABLES LIKE 'channel_settings'");
    if (channelTables.length === 0) {
      console.log('❌ channel_settings table does not exist! Creating it with proper column length...');
      
      // Create channel_settings table with longer channel_id column
      await pool.query(`
        CREATE TABLE channel_settings (
          id SERIAL PRIMARY KEY,
          server_id VARCHAR(32) REFERENCES rust_servers(id) ON DELETE CASCADE,
          channel_type TEXT NOT NULL,
          channel_id VARCHAR(64) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(server_id, channel_type)
        )
      `);
      
      console.log('✅ channel_settings table created with VARCHAR(64) for channel_id');
    } else {
      console.log('✅ channel_settings table exists');
      
      // Check current column definition
      const [columns] = await pool.query(`
        SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'channel_settings' AND COLUMN_NAME = 'channel_id'
      `);
      
      if (columns.length > 0) {
        const column = columns[0];
        console.log(`📋 Current channel_id column: ${column.DATA_TYPE}(${column.CHARACTER_MAXIMUM_LENGTH})`);
        
        if (column.CHARACTER_MAXIMUM_LENGTH < 64) {
          console.log('🔧 Updating channel_id column to VARCHAR(64)...');
          
          // Alter the column to be longer
          await pool.query(`
            ALTER TABLE channel_settings 
            MODIFY COLUMN channel_id VARCHAR(64) NOT NULL
          `);
          
          console.log('✅ Updated channel_id column to VARCHAR(64)');
        } else {
          console.log('✅ channel_id column is already properly sized');
        }
      }
    }
    
    // Also check event_configs table
    console.log('\n📋 Checking event_configs table...');
    const [eventTables] = await pool.query("SHOW TABLES LIKE 'event_configs'");
    if (eventTables.length === 0) {
      console.log('❌ event_configs table does not exist! Creating it...');
      
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
    
    // Clean up any existing invalid channel settings
    console.log('\n🧹 Cleaning up existing channel settings...');
    const [currentChannels] = await pool.query(`
      SELECT cs.*, rs.nickname 
      FROM channel_settings cs 
      JOIN rust_servers rs ON cs.server_id = rs.id 
      ORDER BY rs.nickname, cs.channel_type
    `);
    
    if (currentChannels.length > 0) {
      console.log(`📋 Found ${currentChannels.length} current channel settings:`);
      currentChannels.forEach(channel => {
        console.log(`  - Server: ${channel.nickname}, Type: ${channel.channel_type}, Channel ID: ${channel.channel_id}`);
      });
      
      // Delete ALL channel settings to start fresh
      await pool.query('DELETE FROM channel_settings');
      console.log('\n✅ Deleted ALL channel settings to start fresh');
    } else {
      console.log('\n✅ No channel settings found to clean up');
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
    
    console.log('\n🎉 Channel ID length issue has been fixed!');
    console.log('💡 Events should now work - use /set-events to configure');
    console.log('💡 Channels are clean - use /channel-set to configure new channels');
    console.log('💡 Restart the bot: pm2 restart zentro-bot');
    
  } catch (error) {
    console.error('❌ Error during fixes:', error);
  } finally {
    await pool.end();
  }
}

fixChannelIdLength(); 