const WebSocket = require('ws');
const pool = require('./src/db');

async function testRconSimple() {
  try {
    console.log('🧪 Testing Simple RCON Connection...\n');

    // Get first server
    const [servers] = await pool.query(
      'SELECT id, nickname, ip, port, password FROM rust_servers LIMIT 1'
    );

    if (servers.length === 0) {
      console.log('❌ No servers found');
      return;
    }

    const server = servers[0];
    console.log(`📡 Testing server: ${server.nickname} (${server.ip}:${server.port})`);

    // Test basic WebSocket connection
    console.log('\n🔍 Testing WebSocket connection...');
    
    const ws = new WebSocket(`ws://${server.ip}:${server.port}/${server.password}`);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected successfully');
      
      // Send a simple command
      const command = JSON.stringify({ Identifier: 1, Message: 'echo "Test"', Name: 'WebRcon' });
      console.log(`📤 Sending command: ${command}`);
      ws.send(command);
    });
    
    ws.on('message', (data) => {
      console.log('📥 Received message:', data.toString());
      try {
        const parsed = JSON.parse(data.toString());
        console.log('📋 Parsed response:', parsed);
        ws.close();
      } catch (err) {
        console.log('❌ Failed to parse response:', err.message);
        ws.close();
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      console.log('⏰ Connection timeout');
      ws.close();
    }, 10000);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testRconSimple(); 