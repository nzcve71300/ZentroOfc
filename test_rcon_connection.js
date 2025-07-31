const mysql = require('mysql2/promise');
const WebRCON = require('webrcon');
require('dotenv').config();

async function testRconConnection() {
  console.log('🔧 Test RCON Connection');
  console.log('=======================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 Step 1: Getting server details...');
    const [serverResult] = await connection.execute('SELECT * FROM rust_servers WHERE guild_id = 176');
    const server = serverResult[0];
    
    console.log('Server details:');
    console.log(`- Nickname: ${server.nickname}`);
    console.log(`- IP: ${server.ip}`);
    console.log(`- Port: ${server.port}`);
    console.log(`- Password: ${server.password}`);

    console.log('\n📋 Step 2: Testing RCON connection...');
    
    const rcon = new WebRCON(server.ip, server.port, server.password);
    
    rcon.on('connected', () => {
      console.log('✅ RCON connected successfully!');
      
      // Test a simple command
      rcon.command('echo "RCON test successful"').then(response => {
        console.log('✅ Command response:', response);
        rcon.disconnect();
      }).catch(err => {
        console.log('❌ Command failed:', err.message);
        rcon.disconnect();
      });
    });

    rcon.on('disconnected', () => {
      console.log('❌ RCON disconnected');
    });

    rcon.on('error', (error) => {
      console.log('❌ RCON error:', error.message);
    });

    // Connect with timeout
    rcon.connect();
    
    setTimeout(() => {
      if (rcon.connected) {
        console.log('✅ Connection test completed');
      } else {
        console.log('❌ Connection failed - check password and server status');
      }
    }, 5000);

    await connection.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testRconConnection(); 