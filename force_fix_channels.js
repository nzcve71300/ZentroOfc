const mysql = require('mysql2/promise');
require('dotenv').config();

async function forceFixChannels() {
  console.log('🔧 Force Fixing Channel IDs\n');
  
  let connection;
  try {
    // Connect to database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    console.log('✅ Database connected');
    
    // First, let's see what we have
    console.log('\n📋 Current channel settings:');
    const [currentSettings] = await connection.execute('SELECT * FROM channel_settings ORDER BY channel_type');
    currentSettings.forEach(setting => {
      console.log(`   - ${setting.channel_type}: ${setting.channel_id} (Server: ${setting.server_id})`);
    });
    
    // Delete all existing channel settings
    console.log('\n🗑️  Deleting all channel settings...');
    await connection.execute('DELETE FROM channel_settings');
    console.log('✅ All channel settings deleted');
    
    // Correct channel IDs
    const correctIds = {
      adminfeed: '1400098668123783268',    // #cmd
      playercount: '1400098489311953007',  // #Player Count
      playerfeed: '1396872848748052581',   // #player-feed
      notefeed: '1397975202184429618'      // #note-feed
    };
    
    // Insert new channel settings
    console.log('\n📝 Creating new channel settings...');
    for (const [channelType, correctId] of Object.entries(correctIds)) {
      console.log(`   - Creating ${channelType}: ${correctId}`);
      
      await connection.execute(
        'INSERT INTO channel_settings (server_id, channel_type, channel_id, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        ['1753872071391_i24dewly', channelType, correctId]
      );
    }
    
    // Verify the new settings
    console.log('\n📋 New channel settings:');
    const [newSettings] = await connection.execute('SELECT * FROM channel_settings ORDER BY channel_type');
    newSettings.forEach(setting => {
      console.log(`   - ${setting.channel_type}: ${setting.channel_id}`);
    });
    
    console.log('\n✅ Channel IDs force fixed! Restart your bot now.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

forceFixChannels(); 