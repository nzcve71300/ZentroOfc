const pool = require('./src/db');

async function cleanAllChannels() {
  try {
    console.log('🧹 Cleaning up ALL channel settings...');
    
    // Check if channel_settings table exists
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
      console.log('✅ channel_settings table exists');
    }
    
    // Show current channel settings
    const [currentChannels] = await pool.query(`
      SELECT cs.*, rs.nickname 
      FROM channel_settings cs 
      JOIN rust_servers rs ON cs.server_id = rs.id 
      ORDER BY rs.nickname, cs.channel_type
    `);
    
    if (currentChannels.length > 0) {
      console.log(`\n📋 Found ${currentChannels.length} current channel settings:`);
      currentChannels.forEach(channel => {
        console.log(`  - Server: ${channel.nickname}, Type: ${channel.channel_type}, Channel ID: ${channel.channel_id}`);
      });
      
      // Delete ALL channel settings
      await pool.query('DELETE FROM channel_settings');
      console.log('\n✅ Deleted ALL channel settings');
    } else {
      console.log('\n✅ No channel settings found to clean up');
    }
    
    // Verify cleanup
    const [remainingChannels] = await pool.query('SELECT COUNT(*) as count FROM channel_settings');
    console.log(`\n✅ Verification: ${remainingChannels[0].count} channel settings remaining`);
    
    console.log('\n🎉 All channel settings have been cleaned up!');
    console.log('💡 Use /channel-set to configure new channels');
    console.log('💡 Restart the bot: pm2 restart zentro-bot');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await pool.end();
  }
}

cleanAllChannels(); 