require('dotenv').config();
const mysql = require('mysql2/promise');

async function debugQuery() {
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
    console.log('🔍 Debugging the exact query the bot uses...');
    
    // Test with the exact parameters the bot uses
    const guildId = '1391149977434329230';
    const serverName = 'RISE 3X';
    const channelType = 'admin_feed';
    
    console.log(`📋 Parameters:`);
    console.log(`- Guild ID: ${guildId}`);
    console.log(`- Server Name: ${serverName}`);
    console.log(`- Channel Type: ${channelType}`);
    
    // Run the exact query the bot uses
    const [result] = await pool.query(
      `SELECT cs.channel_id 
       FROM channel_settings cs 
       JOIN rust_servers rs ON cs.server_id = rs.id 
       JOIN guilds g ON rs.guild_id = g.id 
       WHERE g.discord_id = ? AND rs.nickname = ? AND cs.channel_type = ?`,
      [guildId, serverName, channelType]
    );
    
    console.log(`\n📊 Query Result:`);
    console.log(`- Rows returned: ${result.length}`);
    
    if (result.length > 0) {
      console.log(`- Channel ID: ${result[0].channel_id}`);
    } else {
      console.log(`❌ No results found!`);
      
      // Let's debug each part of the query
      console.log(`\n🔍 Debugging each table:`);
      
      // Check guilds table
      const [guildsResult] = await pool.query(
        'SELECT * FROM guilds WHERE discord_id = ?',
        [guildId]
      );
      console.log(`- Guilds with discord_id ${guildId}: ${guildsResult.length} rows`);
      
      // Check rust_servers table
      const [serversResult] = await pool.query(
        'SELECT * FROM rust_servers WHERE nickname = ?',
        [serverName]
      );
      console.log(`- Rust servers with nickname "${serverName}": ${serversResult.length} rows`);
      
      // Check channel_settings table
      const [channelsResult] = await pool.query(
        'SELECT * FROM channel_settings WHERE channel_type = ?',
        [channelType]
      );
      console.log(`- Channel settings with type "${channelType}": ${channelsResult.length} rows`);
      
      // Show all channel types
      const [allTypes] = await pool.query(
        'SELECT DISTINCT channel_type FROM channel_settings'
      );
      console.log(`- All channel types in database: ${allTypes.map(r => r.channel_type).join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

debugQuery(); 