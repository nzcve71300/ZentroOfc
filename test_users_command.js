const WebSocket = require('ws');
const pool = require('./src/db');

async function testUsersCommand() {
  try {
    console.log('🔍 Testing RCON users command...\n');

    // Get a test server
    const [servers] = await pool.query('SELECT * FROM rust_servers LIMIT 1');
    if (servers.length === 0) {
      console.log('❌ No servers found in database');
      return;
    }

    const server = servers[0];
    console.log(`📋 Server: ${server.nickname}`);
    console.log(`🌐 IP: ${server.ip}:${server.port}\n`);

    const ws = new WebSocket(`ws://${server.ip}:${server.port}/${server.password}`);
    
    ws.on('open', () => {
      console.log('✅ Connected to RCON');
      
      // Test 1: users command (what Zorp uses)
      console.log('\n📤 Testing "users" command...');
      ws.send(JSON.stringify({ Identifier: 1, Message: 'users', Name: 'WebRcon' }));
      
      // Test 2: players command (alternative)
      setTimeout(() => {
        console.log('\n📤 Testing "players" command...');
        ws.send(JSON.stringify({ Identifier: 2, Message: 'players', Name: 'WebRcon' }));
      }, 2000);
      
      // Test 3: status command
      setTimeout(() => {
        console.log('\n📤 Testing "status" command...');
        ws.send(JSON.stringify({ Identifier: 3, Message: 'status', Name: 'WebRcon' }));
      }, 4000);
      
      // Test 4: echo test
      setTimeout(() => {
        console.log('\n📤 Testing "echo" command...');
        ws.send(JSON.stringify({ Identifier: 4, Message: 'echo "RCON Test"', Name: 'WebRcon' }));
      }, 6000);
      
      // Close after 8 seconds
      setTimeout(() => {
        console.log('\n🔚 Closing connection...');
        ws.close();
      }, 8000);
    });

    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data);
        console.log(`📥 Response (ID ${parsed.Identifier}):`);
        console.log(parsed.Message);
        console.log('---');
      } catch (err) {
        console.error('❌ Failed to parse response:', err);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });

    ws.on('close', () => {
      console.log('\n🎉 Test completed!');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testUsersCommand(); 