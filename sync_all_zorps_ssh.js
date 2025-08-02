const WebSocket = require('ws');
const pool = require('./src/db');

async function syncAllZorps() {
  try {
    console.log('🧪 SYNCING ALL ZORPS TO DATABASE IN SSH...\n');

    // Get all servers
    const [servers] = await pool.query(
      'SELECT id, nickname, ip, port, password FROM rust_servers'
    );

    console.log(`📡 Found ${servers.length} servers to sync:`);
    servers.forEach(server => {
      console.log(`   - ${server.nickname} (${server.ip}:${server.port})`);
    });

    let totalZonesFound = 0;
    let totalZonesAdded = 0;

    for (const server of servers) {
      console.log(`\n🔍 Processing server: ${server.nickname}`);
      
      try {
        // Get zones from this server
        const gameZoneNames = await getZonesFromServer(server);
        console.log(`   🎯 Found ${gameZoneNames.length} ZORP zones in game for ${server.nickname}:`);
        gameZoneNames.forEach(zone => {
          console.log(`      - ${zone}`);
        });
        
        totalZonesFound += gameZoneNames.length;
        
        // Add missing zones to database
        console.log(`   💾 Adding zones to database for ${server.nickname}...`);
        
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
              totalZonesAdded++;
            } else {
              console.log(`   ✅ Zone already in database: ${zoneName}`);
            }
          } catch (error) {
            console.log(`   ❌ Failed to add zone ${zoneName}:`, error.message);
          }
        }
        
        // Check final count for this server
        const [finalZones] = await pool.query(
          'SELECT name, owner FROM zorp_zones WHERE server_id = ?',
          [server.id]
        );
        
        console.log(`   📊 ${server.nickname} final count: ${finalZones.length} zones in database`);
        
      } catch (error) {
        console.log(`   ❌ Failed to process ${server.nickname}:`, error.message);
      }
    }

    // Final summary
    console.log(`\n📊 SYNC SUMMARY:`);
    console.log(`   🎯 Total zones found in games: ${totalZonesFound}`);
    console.log(`   ➕ Total zones added to database: ${totalZonesAdded}`);
    console.log(`   ✅ All zorps should now be properly tracked!`);

    // Final database check
    console.log(`\n🔍 FINAL DATABASE CHECK:`);
    const [allZones] = await pool.query(
      'SELECT rs.nickname, COUNT(zz.id) as zone_count FROM rust_servers rs LEFT JOIN zorp_zones zz ON rs.id = zz.server_id GROUP BY rs.id, rs.nickname'
    );
    
    allZones.forEach(server => {
      console.log(`   📋 ${server.nickname}: ${server.zone_count} zones`);
    });

  } catch (error) {
    console.error('❌ Sync failed:', error);
  } finally {
    await pool.end();
  }
}

async function getZonesFromServer(server) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${server.ip}:${server.port}/${server.password}`);
    
    ws.on('open', () => {
      console.log(`   ✅ Connected to ${server.nickname}`);
      
      // Get zones from game
      const zonesCommand = JSON.stringify({ Identifier: 1, Message: 'zones.listcustomzones', Name: 'WebRcon' });
      ws.send(zonesCommand);
    });
    
    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        
        if (parsed.Message) {
          const zones = parsed.Message.split('\n').filter(line => line.trim());
          
          // Extract ZORP zones
          const zorpZones = zones.filter(zone => zone.includes('ZORP_'));
          
          // Extract zone names
          const gameZoneNames = zorpZones.map(zone => {
            const match = zone.match(/Name \[([^\]]+)\]/);
            return match ? match[1] : null;
          }).filter(name => name);
          
          ws.close();
          resolve(gameZoneNames);
        }
      } catch (err) {
        console.log(`   ❌ Failed to parse response from ${server.nickname}:`, err.message);
        ws.close();
        resolve([]); // Return empty array on error
      }
    });
    
    ws.on('error', (error) => {
      console.error(`   ❌ WebSocket error for ${server.nickname}:`, error.message);
      resolve([]); // Return empty array on error
    });
    
    ws.on('close', () => {
      console.log(`   🔌 Connection closed for ${server.nickname}`);
    });
  });
}

syncAllZorps(); 