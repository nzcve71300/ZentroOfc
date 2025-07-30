require('dotenv').config();
const mysql = require('mysql2/promise');

async function testFixes() {
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
    console.log('🧪 Testing MySQL compatibility fixes...');
    
    // Test 1: Channel settings query (the one that was failing)
    console.log('\n📺 Test 1: Channel settings query...');
    const [channelResult] = await pool.query(
      `SELECT cs.channel_id 
       FROM channel_settings cs 
       JOIN rust_servers rs ON cs.server_id = rs.id 
       JOIN guilds g ON rs.guild_id = g.id 
       WHERE g.discord_id = '1391149977434329230' AND rs.nickname = 'RISE 3X' AND cs.channel_type = 'admin_feed'`
    );
    
    console.log(`- Rows returned: ${channelResult.length}`);
    if (channelResult.length > 0) {
      console.log(`- Channel ID: ${channelResult[0].channel_id}`);
      console.log(`- Channel ID length: ${channelResult[0].channel_id.toString().length}`);
    }
    
    // Test 2: Autokits query
    console.log('\n📦 Test 2: Autokits query...');
    const [autokitResult] = await pool.query(
      'SELECT enabled, cooldown, game_name FROM autokits WHERE server_id = ? AND kit_name = ?',
      ['1753872071391_i24dewly', 'FREEkit1']
    );
    
    console.log(`- Rows returned: ${autokitResult.length}`);
    if (autokitResult.length > 0) {
      console.log(`- Kit enabled: ${autokitResult[0].enabled}`);
      console.log(`- Kit name: ${autokitResult[0].game_name}`);
    }
    
    // Test 3: Killfeed query
    console.log('\n💀 Test 3: Killfeed query...');
    const [killfeedResult] = await pool.query(
      'SELECT enabled, format_string FROM killfeed_configs WHERE server_id = ?',
      ['1753872071391_i24dewly']
    );
    
    console.log(`- Rows returned: ${killfeedResult.length}`);
    if (killfeedResult.length > 0) {
      console.log(`- Killfeed enabled: ${killfeedResult[0].enabled}`);
      console.log(`- Format string: ${killfeedResult[0].format_string}`);
    }
    
    // Test 4: Position config query
    console.log('\n📍 Test 4: Position config query...');
    const [positionResult] = await pool.query(
      'SELECT enabled, delay_seconds, cooldown_minutes FROM position_configs WHERE server_id = ? AND position_type = ?',
      ['1753872071391_i24dewly', 'outpost']
    );
    
    console.log(`- Rows returned: ${positionResult.length}`);
    if (positionResult.length > 0) {
      console.log(`- Position enabled: ${positionResult[0].enabled}`);
      console.log(`- Delay seconds: ${positionResult[0].delay_seconds}`);
    }
    
    // Test 5: Position coordinates query
    console.log('\n🎯 Test 5: Position coordinates query...');
    const [coordsResult] = await pool.query(
      'SELECT x_pos, y_pos, z_pos FROM position_coordinates WHERE server_id = ? AND position_type = ?',
      ['1753872071391_i24dewly', 'outpost']
    );
    
    console.log(`- Rows returned: ${coordsResult.length}`);
    if (coordsResult.length > 0) {
      console.log(`- Coordinates: ${coordsResult[0].x_pos}, ${coordsResult[0].y_pos}, ${coordsResult[0].z_pos}`);
    }
    
    console.log('\n✅ All MySQL compatibility tests passed!');
    console.log('\n📋 Next steps:');
    console.log('1. Run the SQL fix script on your remote server');
    console.log('2. Restart your bot: pm2 restart zentro-bot');
    console.log('3. Test autokits, killfeed, and positions in game');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testFixes(); 