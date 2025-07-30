const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

// Correct channel IDs provided by user
const correctChannelIds = {
  playercount: '1400098489311953007',
  playerfeed: '1396872848748052581', 
  adminfeed: '1400098668123783268',
  notefeed: '1397975202184429618'
};

async function updateChannelIds() {
  let connection;
  
  try {
    console.log('🔧 Updating channel IDs with correct Discord channel IDs...');
    
    // Create database connection
    connection = await mysql.createConnection(dbConfig);
    
    // Update each channel type with the correct ID
    for (const [channelType, correctId] of Object.entries(correctChannelIds)) {
      console.log(`📝 Updating ${channelType} channel ID to: ${correctId}`);
      
      const [result] = await connection.execute(
        'UPDATE channel_settings SET channel_id = ?, updated_at = CURRENT_TIMESTAMP WHERE channel_type = ?',
        [correctId, channelType]
      );
      
      if (result.affectedRows > 0) {
        console.log(`✅ Successfully updated ${channelType} channel`);
      } else {
        console.log(`⚠️  No ${channelType} channel found to update`);
      }
    }
    
    // Verify the updates
    console.log('\n📋 Verifying updated channel settings:');
    const [settings] = await connection.execute('SELECT * FROM channel_settings ORDER BY channel_type');
    
    settings.forEach(setting => {
      console.log(`- ${setting.channel_type}: ${setting.channel_id}`);
    });
    
    console.log('\n✅ Channel ID update completed successfully!');
    
  } catch (error) {
    console.error('❌ Error updating channel IDs:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the update
updateChannelIds(); 