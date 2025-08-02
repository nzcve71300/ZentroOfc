const WebSocket = require('ws');
const pool = require('./src/db');

console.log('🔄 SYNCING EMPEROR 3X ZONES TO DATABASE');
console.log('=========================================');

async function syncEmperorZones() {
  try {
    // Get EMPEROR 3X server info
    const serverName = 'EMPEROR 3X';
    const guildId = '1342235198175182921';
    
    console.log(`\n📡 Getting server info for ${serverName}...`);
    const [serverResult] = await pool.query(
      'SELECT id, ip, port, password FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) {
      console.log(`❌ Server not found: ${serverName}`);
      return;
    }
    
    const server = serverResult[0];
    console.log(`✅ Server found: ${serverName} (${server.ip}:${server.port})`);
    
    // Get zones from game server
    console.log('\n📡 Fetching zones from game server...');
    const gameZoneNames = await getZonesFromGameServer(server);
    
    console.log(`\n🎯 Found ${gameZoneNames.length} zones in game:`);
    gameZoneNames.forEach(zone => {
      console.log(`   - ${zone}`);
    });
    
    if (gameZoneNames.length === 0) {
      console.log('❌ No zones found in game');
      return;
    }
    
    // Add missing zones to database
    console.log('\n📡 Adding zones to database...');
    let addedCount = 0;
    
    for (const zoneName of gameZoneNames) {
      // Check if zone already exists in database
      const [existingZone] = await pool.query(
        'SELECT id FROM zorp_zones WHERE name = ? AND server_id = ?',
        [zoneName, server.id]
      );
      
      if (existingZone.length === 0) {
        console.log(`   ➕ Adding zone: ${zoneName}`);
        await pool.query(
          'INSERT INTO zorp_zones (name, owner, server_id, created_at, expire) VALUES (?, ?, ?, NOW(), 86400)',
          [zoneName, 'Unknown', server.id]
        );
        console.log(`   ✅ Added zone: ${zoneName}`);
        addedCount++;
      } else {
        console.log(`   ⏭️ Zone already exists: ${zoneName}`);
      }
    }
    
    console.log(`\n🎉 SYNC COMPLETE: Added ${addedCount} zones to database`);
    console.log('✅ Goodbye emote deletion should now work!');
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
}

async function getZonesFromGameServer(server) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://${server.ip}:${server.port}/${server.password}`);
    
    ws.on('open', () => {
      console.log('   🔗 Connected to game server');
      ws.send(JSON.stringify({
        Identifier: 1,
        Message: 'zones.listcustomzones',
        Name: 'WebRcon'
      }));
    });
    
    ws.on('message', (data) => {
      try {
        const response = JSON.parse(data);
        console.log('   📥 Received response from game server');
        
        if (response.Message) {
          // Parse the zones list
          const zonesText = response.Message;
          console.log('   📋 Raw zones response:', zonesText);
          
          // Extract zone names (look for ZORP zones)
          const zoneNames = [];
          const lines = zonesText.split('\n');
          
          for (const line of lines) {
            if (line.includes('ZORP_')) {
              // Extract zone name from the line
              const match = line.match(/ZORP_\d+/);
              if (match) {
                zoneNames.push(match[0]);
              }
            }
          }
          
          console.log(`   🎯 Extracted ${zoneNames.length} ZORP zones`);
          ws.close();
          resolve(zoneNames);
        } else {
          console.log('   ⚠️ No message in response');
          ws.close();
          resolve([]);
        }
      } catch (error) {
        console.error('   ❌ Error parsing response:', error.message);
        ws.close();
        resolve([]);
      }
    });
    
    ws.on('error', (error) => {
      console.error(`   ❌ WebSocket error:`, error.message);
      resolve([]);
    });
    
    ws.on('close', () => {
      console.log('   🔌 Connection closed');
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      console.log('   ⏰ Connection timeout');
      ws.close();
      resolve([]);
    }, 10000);
  });
}

// Run the sync
syncEmperorZones().then(() => {
  console.log('\n✅ Sync completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Sync failed:', error);
  process.exit(1);
}); 