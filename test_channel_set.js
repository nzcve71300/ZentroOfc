require('dotenv').config();
const mysql = require('mysql2/promise');

async function testChannelSet() {
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
    console.log('🔍 Testing channel-set storage...');
    
    // Test parameters (simulate what /channel-set would use)
    const serverId = '1753872071391_i24dewly';
    const channelType = 'adminfeed';
    const channelId = 1400098668123783268; // Full Discord channel ID
    
    console.log(`📋 Test Parameters:`);
    console.log(`- Server ID: ${serverId}`);
    console.log(`- Channel Type: ${channelType}`);
    console.log(`- Channel ID: ${channelId}`);
    
    // First, clear any existing entry
    await pool.query(
      'DELETE FROM channel_settings WHERE server_id = ? AND channel_type = ?',
      [serverId, channelType]
    );
    
    // Insert using the same method as /channel-set
    await pool.query(
      'INSERT INTO channel_settings (server_id, channel_type, channel_id, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [serverId, channelType, channelId]
    );
    
    console.log(`✅ Inserted channel setting`);
    
    // Now retrieve it to see what was actually stored
    const [result] = await pool.query(
      'SELECT * FROM channel_settings WHERE server_id = ? AND channel_type = ?',
      [serverId, channelType]
    );
    
    console.log(`\n📊 Retrieved from database:`);
    console.log(`- Channel ID stored: ${result[0].channel_id}`);
    console.log(`- Channel ID type: ${typeof result[0].channel_id}`);
    console.log(`- Full row:`, result[0]);
    
    // Test the exact query the bot uses
    const [botQueryResult] = await pool.query(
      `SELECT cs.channel_id 
       FROM channel_settings cs 
       JOIN rust_servers rs ON cs.server_id = rs.id 
       JOIN guilds g ON rs.guild_id = g.id 
       WHERE g.discord_id = '1391149977434329230' AND rs.nickname = 'RISE 3X' AND cs.channel_type = 'adminfeed'`
    );
    
    console.log(`\n🤖 Bot query result:`);
    console.log(`- Rows returned: ${botQueryResult.length}`);
    if (botQueryResult.length > 0) {
      console.log(`- Channel ID: ${botQueryResult[0].channel_id}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testChannelSet(); 