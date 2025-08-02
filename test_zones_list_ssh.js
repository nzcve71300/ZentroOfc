const WebSocket = require('ws');
const pool = require('./src/db');

async function testZonesList() {
  try {
    console.log('🧪 Testing Zones List in SSH...\n');

    // Get all servers
    const [servers] = await pool.query(
      'SELECT id, nickname, ip, port, password FROM rust_servers'
    );

    console.log(`📡 Found ${servers.length} servers:`);
    servers.forEach(server => {
      console.log(`   - ${server.nickname} (${server.ip}:${server.port})`);
    });

    for (const server of servers) {
      console.log(`\n🔍 Testing server: ${server.nickname}`);
      
      const ws = new WebSocket(`ws://${server.ip}:${server.port}/${server.password}`);
      
      ws.on('open', () => {
        console.log(`   ✅ Connected to ${server.nickname}`);
        
        // Test 1: Basic echo command
        console.log(`   📤 Testing echo command...`);
        const echoCommand = JSON.stringify({ Identifier: 1, Message: 'echo "RCON Test"', Name: 'WebRcon' });
        ws.send(echoCommand);
        
        // Test 2: List zones command after 2 seconds
        setTimeout(() => {
          console.log(`   📤 Testing zones.listcustomzones...`);
          const zonesCommand = JSON.stringify({ Identifier: 2, Message: 'zones.listcustomzones', Name: 'WebRcon' });
          ws.send(zonesCommand);
        }, 2000);
        
        // Test 3: List all zones command after 4 seconds
        setTimeout(() => {
          console.log(`   📤 Testing zones.list...`);
          const allZonesCommand = JSON.stringify({ Identifier: 3, Message: 'zones.list', Name: 'WebRcon' });
          ws.send(allZonesCommand);
        }, 4000);
        
        // Test 4: Players command after 6 seconds
        setTimeout(() => {
          console.log(`   📤 Testing players...`);
          const playersCommand = JSON.stringify({ Identifier: 4, Message: 'players', Name: 'WebRcon' });
          ws.send(playersCommand);
        }, 6000);
        
        // Close after 8 seconds
        setTimeout(() => {
          console.log(`   🔌 Closing connection to ${server.nickname}`);
          ws.close();
        }, 8000);
      });
      
      ws.on('message', (data) => {
        console.log(`   📥 Received from ${server.nickname}:`, data.toString());
        try {
          const parsed = JSON.parse(data.toString());
          console.log(`   📋 Parsed response:`, parsed);
        } catch (err) {
          console.log(`   ❌ Failed to parse response:`, err.message);
        }
      });
      
      ws.on('error', (error) => {
        console.error(`   ❌ WebSocket error for ${server.nickname}:`, error.message);
      });
      
      ws.on('close', () => {
        console.log(`   🔌 Connection closed for ${server.nickname}`);
      });
      
      // Wait for this server to complete before testing next
      await new Promise(resolve => {
        setTimeout(resolve, 10000);
      });
    }

    console.log('\n✅ All servers tested!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testZonesList(); 