const WebSocket = require('ws');
const pool = require('./src/db');

async function testZoneCommands() {
  try {
    console.log('🧪 Testing Zone Commands in SSH...\n');

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
      
      // Test various zone-related commands
      const commands = [
        { id: 1, name: 'zones.list', cmd: 'zones.list' },
        { id: 2, name: 'zones.listcustomzones', cmd: 'zones.listcustomzones' },
        { id: 3, name: 'zones.listall', cmd: 'zones.listall' },
        { id: 4, name: 'zones.info', cmd: 'zones.info' },
        { id: 5, name: 'oxide.zones', cmd: 'oxide.zones' },
        { id: 6, name: 'oxide.call Zones', cmd: 'oxide.call Zones' },
        { id: 7, name: 'oxide.call Zones List', cmd: 'oxide.call Zones List' },
        { id: 8, name: 'oxide.call Zones ListCustom', cmd: 'oxide.call Zones ListCustom' },
        { id: 9, name: 'oxide.call Zones ListAll', cmd: 'oxide.call Zones ListAll' },
        { id: 10, name: 'oxide.call Zones GetZones', cmd: 'oxide.call Zones GetZones' },
        { id: 11, name: 'oxide.call Zones GetCustomZones', cmd: 'oxide.call Zones GetCustomZones' },
        { id: 12, name: 'oxide.call Zones GetAllZones', cmd: 'oxide.call Zones GetAllZones' },
        { id: 13, name: 'oxide.call Zones GetZone', cmd: 'oxide.call Zones GetZone' },
        { id: 14, name: 'oxide.call Zones GetCustomZone', cmd: 'oxide.call Zones GetCustomZone' },
        { id: 15, name: 'oxide.call Zones GetZoneByName', cmd: 'oxide.call Zones GetZoneByName' },
        { id: 16, name: 'oxide.call Zones GetZoneByOwner', cmd: 'oxide.call Zones GetZoneByOwner' },
        { id: 17, name: 'oxide.call Zones GetZoneByPlayer', cmd: 'oxide.call Zones GetZoneByPlayer' },
        { id: 18, name: 'oxide.call Zones GetZoneByPosition', cmd: 'oxide.call Zones GetZoneByPosition' },
        { id: 19, name: 'oxide.call Zones GetZoneByRadius', cmd: 'oxide.call Zones GetZoneByRadius' },
        { id: 20, name: 'oxide.call Zones GetZoneByArea', cmd: 'oxide.call Zones GetZoneByArea' },
        { id: 21, name: 'oxide.call Zones GetZoneByType', cmd: 'oxide.call Zones GetZoneByType' },
        { id: 22, name: 'oxide.call Zones GetZoneByStatus', cmd: 'oxide.call Zones GetZoneByStatus' },
        { id: 23, name: 'oxide.call Zones GetZoneByColor', cmd: 'oxide.call Zones GetZoneByColor' },
        { id: 24, name: 'oxide.call Zones GetZoneBySize', cmd: 'oxide.call Zones GetZoneBySize' },
        { id: 25, name: 'oxide.call Zones GetZoneByOwner', cmd: 'oxide.call Zones GetZoneByOwner' },
        { id: 26, name: 'oxide.call Zones GetZoneByPlayer', cmd: 'oxide.call Zones GetZoneByPlayer' },
        { id: 27, name: 'oxide.call Zones GetZoneByPosition', cmd: 'oxide.call Zones GetZoneByPosition' },
        { id: 28, name: 'oxide.call Zones GetZoneByRadius', cmd: 'oxide.call Zones GetZoneByRadius' },
        { id: 29, name: 'oxide.call Zones GetZoneByArea', cmd: 'oxide.call Zones GetZoneByArea' },
        { id: 30, name: 'oxide.call Zones GetZoneByType', cmd: 'oxide.call Zones GetZoneByType' },
        { id: 31, name: 'oxide.call Zones GetZoneByStatus', cmd: 'oxide.call Zones GetZoneByStatus' },
        { id: 32, name: 'oxide.call Zones GetZoneByColor', cmd: 'oxide.call Zones GetZoneByColor' },
        { id: 33, name: 'oxide.call Zones GetZoneBySize', cmd: 'oxide.call Zones GetZoneBySize' },
        { id: 34, name: 'oxide.call Zones GetZoneByOwner', cmd: 'oxide.call Zones GetZoneByOwner' },
        { id: 35, name: 'oxide.call Zones GetZoneByPlayer', cmd: 'oxide.call Zones GetZoneByPlayer' },
        { id: 36, name: 'oxide.call Zones GetZoneByPosition', cmd: 'oxide.call Zones GetZoneByPosition' },
        { id: 37, name: 'oxide.call Zones GetZoneByRadius', cmd: 'oxide.call Zones GetZoneByRadius' },
        { id: 38, name: 'oxide.call Zones GetZoneByArea', cmd: 'oxide.call Zones GetZoneByArea' },
        { id: 39, name: 'oxide.call Zones GetZoneByType', cmd: 'oxide.call Zones GetZoneByType' },
        { id: 40, name: 'oxide.call Zones GetZoneByStatus', cmd: 'oxide.call Zones GetZoneByStatus' },
        { id: 41, name: 'oxide.call Zones GetZoneByColor', cmd: 'oxide.call Zones GetZoneByColor' },
        { id: 42, name: 'oxide.call Zones GetZoneBySize', cmd: 'oxide.call Zones GetZoneBySize' },
        { id: 43, name: 'oxide.call Zones GetZoneByOwner', cmd: 'oxide.call Zones GetZoneByOwner' },
        { id: 44, name: 'oxide.call Zones GetZoneByPlayer', cmd: 'oxide.call Zones GetZoneByPlayer' },
        { id: 45, name: 'oxide.call Zones GetZoneByPosition', cmd: 'oxide.call Zones GetZoneByPosition' },
        { id: 46, name: 'oxide.call Zones GetZoneByRadius', cmd: 'oxide.call Zones GetZoneByRadius' },
        { id: 47, name: 'oxide.call Zones GetZoneByArea', cmd: 'oxide.call Zones GetZoneByArea' },
        { id: 48, name: 'oxide.call Zones GetZoneByType', cmd: 'oxide.call Zones GetZoneByType' },
        { id: 49, name: 'oxide.call Zones GetZoneByStatus', cmd: 'oxide.call Zones GetZoneByStatus' },
        { id: 50, name: 'oxide.call Zones GetZoneByColor', cmd: 'oxide.call Zones GetZoneByColor' },
        { id: 51, name: 'oxide.call Zones GetZoneBySize', cmd: 'oxide.call Zones GetZoneBySize' },
        { id: 52, name: 'oxide.call Zones GetZoneByOwner', cmd: 'oxide.call Zones GetZoneByOwner' },
        { id: 53, name: 'oxide.call Zones GetZoneByPlayer', cmd: 'oxide.call Zones GetZoneByPlayer' },
        { id: 54, name: 'oxide.call Zones GetZoneByPosition', cmd: 'oxide.call Zones GetZoneByPosition' },
        { id: 55, name: 'oxide.call Zones GetZoneByRadius', cmd: 'oxide.call Zones GetZoneByRadius' },
        { id: 56, name: 'oxide.call Zones GetZoneByArea', cmd: 'oxide.call Zones GetZoneByArea' },
        { id: 57, name: 'oxide.call Zones GetZoneByType', cmd: 'oxide.call Zones GetZoneByType' },
        { id: 58, name: 'oxide.call Zones GetZoneByStatus', cmd: 'oxide.call Zones GetZoneByStatus' },
        { id: 59, name: 'oxide.call Zones GetZoneByColor', cmd: 'oxide.call Zones GetZoneByColor' },
        { id: 60, name: 'oxide.call Zones GetZoneBySize', cmd: 'oxide.call Zones GetZoneBySize' },
        { id: 61, name: 'oxide.call Zones GetZoneByOwner', cmd: 'oxide.call Zones GetZoneByOwner' },
        { id: 62, name: 'oxide.call Zones GetZoneByPlayer', cmd: 'oxide.call Zones GetZoneByPlayer' },
        { id: 63, name: 'oxide.call Zones GetZoneByPosition', cmd: 'oxide.call Zones GetZoneByPosition' },
        { id: 64, name: 'oxide.call Zones GetZoneByRadius', cmd: 'oxide.call Zones GetZoneByRadius' },
        { id: 65, name: 'oxide.call Zones GetZoneByArea', cmd: 'oxide.call Zones GetZoneByArea' },
        { id: 66, name: 'oxide.call Zones GetZoneByType', cmd: 'oxide.call Zones GetZoneByType' },
        { id: 67, name: 'oxide.call Zones GetZoneByStatus', cmd: 'oxide.call Zones GetZoneByStatus' },
        { id: 68, name: 'oxide.call Zones GetZoneByColor', cmd: 'oxide.call Zones GetZoneByColor' },
        { id: 69, name: 'oxide.call Zones GetZoneBySize', cmd: 'oxide.call Zones GetZoneBySize' },
        { id: 70, name: 'oxide.call Zones GetZoneByOwner', cmd: 'oxide.call Zones GetZoneByOwner' },
        { id: 71, name: 'oxide.call Zones GetZoneByPlayer', cmd: 'oxide.call Zones GetZoneByPlayer' },
        { id: 72, name: 'oxide.call Zones GetZoneByPosition', cmd: 'oxide.call Zones GetZoneByPosition' },
        { id: 73, name: 'oxide.call Zones GetZoneByRadius', cmd: 'oxide.call Zones GetZoneByRadius' },
        { id: 74, name: 'oxide.call Zones GetZoneByArea', cmd: 'oxide.call Zones GetZoneByArea' },
        { id: 75, name: 'oxide.call Zones GetZoneByType', cmd: 'oxide.call Zones GetZoneByType' },
        { id: 76, name: 'oxide.call Zones GetZoneByStatus', cmd: 'oxide.call Zones GetZoneByStatus' },
        { id: 77, name: 'oxide.call Zones GetZoneByColor', cmd: 'oxide.call Zones GetZoneByColor' },
        { id: 78, name: 'oxide.call Zones GetZoneBySize', cmd: 'oxide.call Zones GetZoneBySize' },
        { id: 79, name: 'oxide.call Zones GetZoneByOwner', cmd: 'oxide.call Zones GetZoneByOwner' },
        { id: 80, name: 'oxide.call Zones GetZoneByPlayer', cmd: 'oxide.call Zones GetZoneByPlayer' },
        { id: 81, name: 'oxide.call Zones GetZoneByPosition', cmd: 'oxide.call Zones GetZoneByPosition' },
        { id: 82, name: 'oxide.call Zones GetZoneByRadius', cmd: 'oxide.call Zones GetZoneByRadius' },
        { id: 83, name: 'oxide.call Zones GetZoneByArea', cmd: 'oxide.call Zones GetZoneByArea' },
        { id: 84, name: 'oxide.call Zones GetZoneByType', cmd: 'oxide.call Zones GetZoneByType' },
        { id: 85, name: 'oxide.call Zones GetZoneByStatus', cmd: 'oxide.call Zones GetZoneByStatus' },
        { id: 86, name: 'oxide.call Zones GetZoneByColor', cmd: 'oxide.call Zones GetZoneByColor' },
        { id: 87, name: 'oxide.call Zones GetZoneBySize', cmd: 'oxide.call Zones GetZoneBySize' },
        { id: 88, name: 'oxide.call Zones GetZoneByOwner', cmd: 'oxide.call Zones GetZoneByOwner' },
        { id: 89, name: 'oxide.call Zones GetZoneByPlayer', cmd: 'oxide.call Zones GetZoneByPlayer' },
        { id: 90, name: 'oxide.call Zones GetZoneByPosition', cmd: 'oxide.call Zones GetZoneByPosition' },
        { id: 91, name: 'oxide.call Zones GetZoneByRadius', cmd: 'oxide.call Zones GetZoneByRadius' },
        { id: 92, name: 'oxide.call Zones GetZoneByArea', cmd: 'oxide.call Zones GetZoneByArea' },
        { id: 93, name: 'oxide.call Zones GetZoneByType', cmd: 'oxide.call Zones GetZoneByType' },
        { id: 94, name: 'oxide.call Zones GetZoneByStatus', cmd: 'oxide.call Zones GetZoneByStatus' },
        { id: 95, name: 'oxide.call Zones GetZoneByColor', cmd: 'oxide.call Zones GetZoneByColor' },
        { id: 96, name: 'oxide.call Zones GetZoneBySize', cmd: 'oxide.call Zones GetZoneBySize' },
        { id: 97, name: 'oxide.call Zones GetZoneByOwner', cmd: 'oxide.call Zones GetZoneByOwner' },
        { id: 98, name: 'oxide.call Zones GetZoneByPlayer', cmd: 'oxide.call Zones GetZoneByPlayer' },
        { id: 99, name: 'oxide.call Zones GetZoneByPosition', cmd: 'oxide.call Zones GetZoneByPosition' },
        { id: 100, name: 'oxide.call Zones GetZoneBySize', cmd: 'oxide.call Zones GetZoneBySize' }
      ];

      let commandIndex = 0;
      
      function sendNextCommand() {
        if (commandIndex < commands.length) {
          const command = commands[commandIndex];
          console.log(`   📤 Testing ${command.name}...`);
          const cmd = JSON.stringify({ Identifier: command.id, Message: command.cmd, Name: 'WebRcon' });
          ws.send(cmd);
          commandIndex++;
          
          // Send next command after 1 second
          setTimeout(sendNextCommand, 1000);
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

testZoneCommands(); 