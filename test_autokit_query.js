const mysql = require('mysql2/promise');
require('dotenv').config();

async function testAutokitQuery() {
  console.log('🔧 Testing autokit database query...');
  
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
    // Test the exact query from the RCON handler
    console.log('📋 Testing autokit query from RCON handler...');
    
    const guildId = '1391149977434329230';
    const serverName = 'RISE 3X';
    const kitKey = 'FREEkit1';
    
    // First get server ID (like the RCON handler does)
    const serverResult = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    console.log('✅ Server query executed successfully');
    console.log('📊 Server result:', serverResult);
    
    if (serverResult.length === 0) {
      console.log('❌ Server not found');
      return;
    }
    
    const serverId = serverResult[0].id;
    console.log('📋 Server ID:', serverId);
    
    // Now test the autokit query (like the RCON handler does)
    const autokitResult = await pool.query(
      'SELECT enabled, cooldown, game_name FROM autokits WHERE server_id = ? AND kit_name = ?',
      [serverId, kitKey]
    );
    
    console.log('✅ Autokit query executed successfully');
    console.log('📊 Autokit result:', autokitResult);
    
    if (autokitResult.length > 0) {
      console.log('✅ Found autokit configuration');
      console.log('📋 Details:', autokitResult[0]);
      console.log('🔧 Enabled:', autokitResult[0].enabled);
      console.log('⏱️ Cooldown:', autokitResult[0].cooldown);
      console.log('🎮 Game Name:', autokitResult[0].game_name);
    } else {
      console.log('⚠️ No autokit configuration found');
    }
    
  } catch (error) {
    console.error('❌ Error testing autokit query:', error);
  } finally {
    await pool.end();
  }
}

testAutokitQuery(); 