const { pool } = require('./src/db');

async function disconnectSpecificServer() {
  try {
    console.log('🔍 Looking for server with IP: 149.102.128.81:31616');
    
    // Find the server in the database
    const [servers] = await pool.query(
      'SELECT id, nickname, ip, port, password FROM rust_servers WHERE ip = ? AND port = ?',
      ['149.102.128.81', 31616]
    );
    
    if (servers.length === 0) {
      console.log('❌ Server not found in database');
      return;
    }
    
    const server = servers[0];
    console.log(`📡 Found server: ${server.nickname} (ID: ${server.id})`);
    console.log(`🔗 Server details: ${server.ip}:${server.port}`);
    
    // Get guild information
    const [guildInfo] = await pool.query(
      'SELECT g.discord_id, g.name FROM guilds g JOIN rust_servers rs ON g.id = rs.guild_id WHERE rs.id = ?',
      [server.id]
    );
    
    if (guildInfo.length === 0) {
      console.log('❌ Guild information not found');
      return;
    }
    
    const guild = guildInfo[0];
    console.log(`🏰 Guild: ${guild.name} (Discord ID: ${guild.discord_id})`);
    
    // Create the connection key that would be used in activeConnections
    const connectionKey = `${guild.discord_id}_${server.nickname}`;
    console.log(`🔑 Connection key: ${connectionKey}`);
    
    console.log('\n📋 Instructions to disconnect RCON:');
    console.log('1. The server is found in the database');
    console.log('2. To disconnect the RCON connection, you need to:');
    console.log('   - Stop the bot (pm2 stop zentro-bot)');
    console.log('   - Or restart the bot (pm2 restart zentro-bot)');
    console.log('   - Or manually close the WebSocket connection in the code');
    console.log('\n⚠️  Note: This will only disconnect the RCON, not delete any data');
    console.log('📊 Server data will remain intact in the database');
    
    // Check if we can find the connection in the activeConnections (if running)
    console.log('\n🔍 To manually disconnect while bot is running:');
    console.log('1. Access the bot console/logs');
    console.log('2. Look for the connection key in activeConnections');
    console.log('3. The WebSocket connection should be closed automatically on bot restart');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

disconnectSpecificServer();
