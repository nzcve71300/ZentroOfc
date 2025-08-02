const WebSocket = require('ws');
const pool = require('./src/db');

async function testSimpleZone() {
  try {
    console.log('🧪 Testing Simple Zone Commands in SSH...\n');

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

    const ws = new WebSocket(`ws://${server.ip}:${server.port}/${server.password}`);
    
    ws.on('open', () => {
      console.log(`   ✅ Connected to ${server.nickname}`);
      
      // Test a few key commands
      const commands = [
        { id: 1, name: 'echo test', cmd: 'echo "test"' },
        { id: 2, name: 'zones.list', cmd: 'zones.list' },
        { id: 3, name: 'zones.listcustomzones', cmd: 'zones.listcustomzones' },
        { id: 4, name: 'oxide.call Zones List', cmd: 'oxide.call Zones List' },
        { id: 5, name: 'oxide.call Zones ListCustom', cmd: 'oxide.call Zones ListCustom' },
        { id: 6, name: 'oxide.call Zones GetZones', cmd: 'oxide.call Zones GetZones' },
        { id: 7, name: 'oxide.call Zones GetCustomZones', cmd: 'oxide.call Zones GetCustomZones' },
        { id: 8, name: 'oxide.call Zones GetAllZones', cmd: 'oxide.call Zones GetAllZones' },
        { id: 9, name: 'oxide.call Zones GetZone', cmd: 'oxide.call Zones GetZone' },
        { id: 10, name: 'oxide.call Zones GetCustomZone', cmd: 'oxide.call Zones GetCustomZone' },
        { id: 11, name: 'oxide.call Zones GetZoneByName', cmd: 'oxide.call Zones GetZoneByName' },
        { id: 12, name: 'oxide.call Zones GetZoneByOwner', cmd: 'oxide.call Zones GetZoneByOwner' },
        { id: 13, name: 'oxide.call Zones GetZoneByPlayer', cmd: 'oxide.call Zones GetZoneByPlayer' },
        { id: 14, name: 'oxide.call Zones GetZoneByPosition', cmd: 'oxide.call Zones GetZoneByPosition' },
        { id: 15, name: 'oxide.call Zones GetZoneByRadius', cmd: 'oxide.call Zones GetZoneByRadius' },
        { id: 16, name: 'oxide.call Zones GetZoneByArea', cmd: 'oxide.call Zones GetZoneByArea' },
        { id: 17, name: 'oxide.call Zones GetZoneByType', cmd: 'oxide.call Zones GetZoneByType' },
        { id: 18, name: 'oxide.call Zones GetZoneByStatus', cmd: 'oxide.call Zones GetZoneByStatus' },
        { id: 19, name: 'oxide.call Zones GetZoneByColor', cmd: 'oxide.call Zones GetZoneByColor' },
        { id: 20, name: 'oxide.call Zones GetZoneBySize', cmd: 'oxide.call Zones GetZoneBySize' }
      ];

      let commandIndex = 0;
      
      function sendNextCommand() {
        if (commandIndex < commands.length) {
          const command = commands[commandIndex];
          console.log(`   📤 Testing ${command.name}...`);
          const cmd = JSON.stringify({ Identifier: command.id, Message: command.cmd, Name: 'WebRcon' });
          ws.send(cmd);
          commandIndex++;
          
          // Send next command after 2 seconds
          setTimeout(sendNextCommand, 2000);
        } else {
          console.log(`   🔌 All commands tested, closing connection`);
          ws.close();
        }
      }
      
      // Start sending commands
      sendNextCommand();
    });
    
    ws.on('message', (data) => {
      console.log(`   📥 Received:`, data.toString());
      try {
        const parsed = JSON.parse(data.toString());
        console.log(`   📋 Parsed response:`, parsed);
      } catch (err) {
        console.log(`   ❌ Failed to parse response:`, err.message);
      }
    });
    
    ws.on('error', (error) => {
      console.error(`   ❌ WebSocket error:`, error.message);
    });
    
    ws.on('close', () => {
      console.log(`   🔌 Connection closed`);
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testSimpleZone(); 