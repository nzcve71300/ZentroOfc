const pool = require('./src/db');
const { WebSocket } = require('ws');

async function checkRconConnection() {
  try {
    console.log('🔍 Checking current server data in database...');
    
    // Check what's in the database
    const [servers] = await pool.query('SELECT * FROM rust_servers');
    console.log('📋 Current servers in database:');
    servers.forEach((server, index) => {
      console.log(`${index + 1}. ID: ${server.id}, Nickname: ${server.nickname}, IP: ${server.ip}, Port: ${server.port}, Password: ${server.password}`);
    });

    if (servers.length === 0) {
      console.log('❌ No servers found in database');
      return;
    }

    const server = servers[0];
    console.log('\n🔧 Testing RCON connection...');
    console.log(`Server: ${server.nickname}`);
    console.log(`IP: ${server.ip}:${server.port}`);
    console.log(`Password: ${server.password}`);

    // Test RCON connection
    const ws = new WebSocket(`ws://${server.ip}:${server.port}/${server.password}`);

    ws.on('open', () => {
      console.log('✅ RCON connection successful!');
      ws.close();
    });

    ws.on('error', (error) => {
      console.log('❌ RCON connection failed:', error.message);
    });

    ws.on('close', () => {
      console.log('🔌 RCON connection closed');
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.log('⏰ RCON connection timeout');
        ws.close();
      }
    }, 10000);

  } catch (error) {
    console.error('❌ Error checking RCON connection:', error);
  }
}

checkRconConnection(); 