const WebSocket = require('ws');
const pool = require('./src/db');

async function syncZorpDatabase() {
  try {
    console.log('🧪 Syncing Zorp Database with Game Zones...\n');

    // Get all servers
    const [servers] = await pool.query(
      'SELECT id, nickname, ip, port, password FROM rust_servers'
    );

    console.log(`📡 Found ${servers.length} servers:`);
    servers.forEach(server => {
      console.log(`   - ${server.nickname} (${server.ip}:${server.port})`);
    });

    for (const server of servers) {
      console.log(`\n🔍 Processing server: ${server.nickname}`);
      
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
          console.log(`   📥 Received zones from ${server.nickname}:`);
          
          if (parsed.Message) {
            const zones = parsed.Message.split('\n').filter(line => line.trim());
            console.log(`   📋 Found ${zones.length} zones in game`);
            
            // Extract ZORP zones
            const zorpZones = zones.filter(zone => zone.includes('ZORP_'));
            console.log(`   🎯 Found ${zorpZones.length} ZORP zones in game`);
            
            zorpZones.forEach(zone => {
              console.log(`      - ${zone}`);
            });
            
            // Sync with database
            console.log(`   💾 Syncing with database...`);
            
            // First, get existing zones in database for this server
            const [existingZones] = await pool.query(
              'SELECT name FROM zorp_zones WHERE server_id = ?',
              [server.id]
            );
            
            console.log(`   📊 Found ${existingZones.length} zones in database for ${server.nickname}`);
            
            // Extract zone names from game response
            const gameZoneNames = zorpZones.map(zone => {
              const match = zone.match(/Name \[([^\]]+)\]/);
              return match ? match[1] : null;
            }).filter(name => name);
            
            console.log(`   🎯 ZORP zone names from game:`, gameZoneNames);
            
            // Add missing zones to database
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
            
            // Test deletion of one zone
            if (gameZoneNames.length > 0) {
              const testZone = gameZoneNames[0];
              console.log(`\n🗑️ Testing deletion of zone: ${testZone}`);
              
              try {
                // Delete from game
                const deleteCommand = `zones.deletecustomzone "${testZone}"`;
                console.log(`   📤 Sending delete command: ${deleteCommand}`);
                
                const deleteCmd = JSON.stringify({ Identifier: 2, Message: deleteCommand, Name: 'WebRcon' });
                ws.send(deleteCmd);
                
                // Wait a moment then delete from database
                setTimeout(async () => {
                  try {
                    await pool.query('DELETE FROM zorp_zones WHERE name = ? AND server_id = ?', [testZone, server.id]);
                    console.log(`   ✅ Deleted zone from database: ${testZone}`);
                  } catch (error) {
                    console.log(`   ❌ Failed to delete from database:`, error.message);
                  }
                }, 2000);
                
              } catch (error) {
                console.log(`   ❌ Failed to delete zone:`, error.message);
              }
            }
            
            ws.close();
          }
        } catch (err) {
          console.log(`   ❌ Failed to parse response:`, err.message);
          ws.close();
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

    // Final check - see what's in database now
    console.log('\n📊 Final database check:');
    const [finalZones] = await pool.query(
      'SELECT zz.name, zz.owner, rs.nickname as server_name FROM zorp_zones zz JOIN rust_servers rs ON zz.server_id = rs.id'
    );

    console.log(`📋 Zorp zones in database: ${finalZones.length}`);
    finalZones.forEach(zone => {
      console.log(`   - ${zone.name} (${zone.owner}) on ${zone.server_name}`);
    });

    console.log('\n✅ Database sync completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

syncZorpDatabase(); 