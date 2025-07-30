require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkChannels() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    console.log('🔍 Checking current channel settings...');
    
    // Check the exact query the bot uses
    const [result] = await pool.query(
      `SELECT cs.channel_id 
       FROM channel_settings cs 
       JOIN rust_servers rs ON cs.server_id = rs.id 
       JOIN guilds g ON rs.guild_id = g.id 
       WHERE g.discord_id = '1391149977434329230' AND rs.nickname = 'RISE 3X' AND cs.channel_type = 'admin_feed'`
    );
    
    console.log(`📊 Bot query result for admin_feed:`);
    console.log(`- Rows returned: ${result.length}`);
    if (result.length > 0) {
      console.log(`- Channel ID: ${result[0].channel_id}`);
      console.log(`- Channel ID length: ${result[0].channel_id.toString().length}`);
      console.log(`- Expected: 1400098668123783268`);
      console.log(`- Match: ${result[0].channel_id === 1400098668123783268 ? '✅ YES' : '❌ NO'}`);
    }
    
    // Check all channel settings for this server
    const [allChannels] = await pool.query(
      `SELECT cs.channel_type, cs.channel_id 
       FROM channel_settings cs 
       JOIN rust_servers rs ON cs.server_id = rs.id 
       JOIN guilds g ON rs.guild_id = g.id 
       WHERE g.discord_id = '1391149977434329230' AND rs.nickname = 'RISE 3X'`
    );
    
    console.log(`\n📋 All channels for RISE 3X:`);
    allChannels.forEach(channel => {
      console.log(`- ${channel.channel_type}: ${channel.channel_id}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkChannels(); 