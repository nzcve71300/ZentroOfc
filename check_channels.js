const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkChannels() {
  let connection;
  
  try {
    console.log('🔍 Checking current channel settings...\n');
    
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    // Get all channel settings
    const [channelSettings] = await connection.execute(`
      SELECT cs.*, rs.nickname, g.discord_id, g.name as guild_name
      FROM channel_settings cs
      JOIN rust_servers rs ON cs.server_id = rs.id
      JOIN guilds g ON rs.guild_id = g.id
    `);

    if (channelSettings.length === 0) {
      console.log('❌ No channel settings found!');
      return;
    }

    console.log('✅ Current channel settings:');
    channelSettings.forEach(setting => {
      console.log(`   - ${setting.guild_name}: ${setting.nickname} -> ${setting.channel_type} (${setting.channel_id})`);
    });

    console.log('\n🔧 To fix the "Unknown Channel" error:');
    console.log('   1. Go to your Discord server');
    console.log('   2. Find the correct channel for each type');
    console.log('   3. Right-click the channel and "Copy ID"');
    console.log('   4. Use /channel-set to reconfigure with the correct channel ID');
    console.log('   5. Or update the database directly with the correct channel ID');

    console.log('\n📋 SQL to update a specific channel:');
    console.log('   UPDATE channel_settings SET channel_id = \'NEW_CHANNEL_ID\' WHERE channel_id = \'1400098668123783200\';');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkChannels(); 