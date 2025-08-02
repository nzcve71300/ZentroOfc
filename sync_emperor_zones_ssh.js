const WebSocket = require('ws');
const pool = require('./src/db');

async function syncEmperorZones() {
  try {
    console.log('🧪 Syncing EMPEROR 3X Zones in SSH...\n');

    // Get EMPEROR 3X server
    const [servers] = await pool.query(
      'SELECT id, nickname, ip, port, password FROM rust_servers WHERE nickname = "EMPEROR 3X"'
    );

    if (servers.length === 0) {
      console.log('❌ EMPEROR 3X server not found');
      return;
    }

    const server = servers[0];
    console.log(`📡 Server: ${server.nickname} (${server.ip}:${server.port})`);

    const ws = new WebSocket(`ws://${server.ip}:${server.port}/${server.password}`);
    
    ws.on('open', () => {
      console.log(`   ✅ Connected to ${server.nickname}`);
      
      // Get zones from game
      console.log(`   📤 Requesting zones from game...`);
      const zonesCommand = JSON.stringify({ Identifier: 1, Message: 'zones.listcustomzones', Name: 'WebRcon' });
      ws.send(zonesCommand);
    });
    
    ws.on('message', async (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        
        if (parsed.Message) {
          console.log(`   📥 Received zones from ${server.nickname}:`);
          const zones = parsed.Message.split('\n').filter(line => line.trim());
          
          // Extract ZORP zones
          const zorpZones = zones.filter(zone => zone.includes('ZORP_'));
          console.log(`   🎯 Found ${zorpZones.length} ZORP zones in game:`);
          zorpZones.forEach(zone => {
            console.log(`      - ${zone}`);
          });
          
          // Extract zone names
          const gameZoneNames = zorpZones.map(zone => {
            const match = zone.match(/Name \[([^\]]+)\]/);
            return match ? match[1] : null;
          }).filter(name => name);
          
          console.log(`   🎯 ZORP zone names from game:`, gameZoneNames);
          
          // Add missing zones to database
          console.log(`   💾 Adding zones to database...`);
          
          for (const zoneName of gameZoneNames) {
            try {
              // Check if zone already exists in database
              const [existingZone] = await pool.query(
                'SELECT id FROM zorp_zones WHERE name = ? AND server_id = ?',
                [zoneName, server.id]
              );
              
              if (existingZone.length === 0) {
                // Add zone to database
                console.log(`   ➕ Adding zone to database: ${zoneName}`);
                await pool.query(
                  'INSERT INTO zorp_zones (name, owner, server_id, created_at, expire) VALUES (?, ?, ?, NOW(), 86400)',
                  [zoneName, 'Unknown', server.id]
                );
                console.log(`   ✅ Added zone: ${zoneName}`);
              } else {
                console.log(`   ✅ Zone already in database: ${zoneName}`);
              }
            } catch (error) {
              console.log(`   ❌ Failed to add zone ${zoneName}:`, error.message);
            }
          }
          
          // Final check
          console.log(`\n📊 Final check for ${server.nickname}:`);
          const [finalZones] = await pool.query(
            'SELECT name, owner FROM zorp_zones WHERE server_id = ?',
            [server.id]
          );
          
          console.log(`   📋 Zones in database: ${finalZones.length}`);
          finalZones.forEach(zone => {
            console.log(`      - ${zone.name} (${zone.owner})`);
          });
          
          ws.close();
        }
      } catch (err) {
        console.log(`   ❌ Failed to parse response:`, err.message);
        ws.close();
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

syncEmperorZones(); 