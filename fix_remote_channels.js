const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixRemoteChannels() {
  console.log('🔧 Fixing Remote Server Channel IDs\n');
  
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
    
    // Correct channel IDs
    const correctIds = {
      adminfeed: '1400098668123783268',    // #cmd
      playercount: '1400098489311953007',  // #Player Count
      playerfeed: '1396872848748052581',   // #player-feed
      notefeed: '1397975202184429618'      // #note-feed
    };
    
    // Update each channel
    for (const [channelType, correctId] of Object.entries(correctIds)) {
      console.log(`📝 Updating ${channelType} to ${correctId}...`);
      
      const [result] = await connection.execute(
        'UPDATE channel_settings SET channel_id = ?, updated_at = CURRENT_TIMESTAMP WHERE channel_type = ?',
        [correctId, channelType]
      );
      
      if (result.affectedRows > 0) {
        console.log(`✅ Updated ${channelType}`);
      } else {
        console.log(`⚠️  No ${channelType} found to update`);
      }
    }
    
    // Verify the updates
    console.log('\n📋 Verifying updates:');
    const [settings] = await connection.execute('SELECT * FROM channel_settings ORDER BY channel_type');
    settings.forEach(setting => {
      console.log(`   - ${setting.channel_type}: ${setting.channel_id}`);
    });
    
    console.log('\n✅ Channel IDs fixed! Restart your bot now.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixRemoteChannels(); 