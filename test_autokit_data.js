const mysql = require('mysql2/promise');
require('dotenv').config();

async function testAutokitData() {
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
    console.log('🔍 Testing autokit database data...');
    
    // Test parameters (from the logs)
    const guildId = '1391149977434329230';
    const serverName = 'RISE 3X';
    const kitKey = 'FREEkit1';
    
    console.log('📋 Test Parameters:');
    console.log('- Guild ID:', guildId);
    console.log('- Server Name:', serverName);
    console.log('- Kit Key:', kitKey);
    
    // Step 1: Get server ID
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    console.log('\n📊 Server Result:', serverResult);
    
    if (serverResult.length === 0) {
      console.log('❌ Server not found!');
      return;
    }
    
    const serverId = serverResult[0].id;
    console.log('✅ Server ID:', serverId);
    
    // Step 2: Check autokit configuration
    const [autokitResult] = await pool.query(
      'SELECT enabled, cooldown, game_name FROM autokits WHERE server_id = ? AND kit_name = ?',
      [serverId, kitKey]
    );
    
    console.log('\n📦 Autokit Result:', autokitResult);
    
    if (autokitResult.length === 0) {
      console.log('❌ No autokit configuration found!');
      
      // Let's check what autokits exist for this server
      const [allAutokits] = await pool.query(
        'SELECT kit_name, enabled, cooldown, game_name FROM autokits WHERE server_id = ?',
        [serverId]
      );
      
      console.log('\n📋 All autokits for this server:', allAutokits);
      
      // Let's also check what servers exist
      const [allServers] = await pool.query(
        'SELECT id, nickname, guild_id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)',
        [guildId]
      );
      
      console.log('\n🏠 All servers for this guild:', allServers);
      
    } else {
      console.log('✅ Autokit configuration found!');
      console.log('- Enabled:', autokitResult[0].enabled);
      console.log('- Cooldown:', autokitResult[0].cooldown);
      console.log('- Game Name:', autokitResult[0].game_name);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testAutokitData(); 