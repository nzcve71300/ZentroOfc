const pool = require('./src/db');

async function fixZorpDuplicates() {
  console.log('🔧 Fixing ZORP Duplicates...\n');
  
  try {
    // Connect to database
    console.log('✅ Connected to database');
    
    // Get all servers
    const [servers] = await pool.query(
      'SELECT id, nickname, ip, port, password FROM rust_servers'
    );
    
    console.log(`📡 Found ${servers.length} servers to check\n`);
    
    let totalDuplicatesRemoved = 0;
    let totalZonesSynced = 0;
    
    for (const server of servers) {
      console.log(`🔍 Processing server: ${server.nickname}`);
      
      try {
        // Get zones from game server
        const gameZones = await getZonesFromGameServer(server);
        console.log(`   🎮 Found ${gameZones.length} zones in game`);
        
        // Get zones from database
        const [dbZones] = await pool.query(
          'SELECT id, name, owner FROM zorp_zones WHERE server_id = ?',
          [server.id]
        );
        console.log(`   📊 Found ${dbZones.length} zones in database`);
        
        // Find duplicates in database (same name)
        const zoneCounts = {};
        const duplicates = [];
        
        for (const zone of dbZones) {
          if (zoneCounts[zone.name]) {
            zoneCounts[zone.name].push(zone);
            if (zoneCounts[zone.name].length === 2) {
              duplicates.push(zoneCounts[zone.name]);
            }
          } else {
            zoneCounts[zone.name] = [zone];
          }
        }
        
        console.log(`   🔍 Found ${duplicates.length} duplicate zone names`);
        
        // Remove duplicates (keep the most recent one)
        for (const duplicateGroup of duplicates) {
          console.log(`   🗑️  Removing duplicates for zone: ${duplicateGroup[0].name}`);
          
          // Sort by ID (assuming higher ID = more recent)
          duplicateGroup.sort((a, b) => a.id - b.id);
          
          // Keep the last one, delete the rest
          const toKeep = duplicateGroup.pop();
          const toDelete = duplicateGroup;
          
          for (const zone of toDelete) {
            await pool.query('DELETE FROM zorp_zones WHERE id = ?', [zone.id]);
            console.log(`      ❌ Deleted duplicate zone ID: ${zone.id}`);
            totalDuplicatesRemoved++;
          }
          
          console.log(`      ✅ Kept zone ID: ${toKeep.id}`);
        }
        
        // Remove zones from database that don't exist in game
        const gameZoneNames = new Set(gameZones);
        const zonesToRemove = [];
        
        for (const zone of dbZones) {
          if (!gameZoneNames.has(zone.name)) {
            zonesToRemove.push(zone);
          }
        }
        
        console.log(`   🧹 Found ${zonesToRemove.length} zones in database but not in game`);
        
        for (const zone of zonesToRemove) {
          await pool.query('DELETE FROM zorp_zones WHERE id = ?', [zone.id]);
          console.log(`      🗑️  Removed orphaned zone: ${zone.name} (ID: ${zone.id})`);
          totalDuplicatesRemoved++;
        }
        
        // Add zones to database that exist in game but not in database
        const dbZoneNames = new Set(dbZones.map(z => z.name));
        const zonesToAdd = [];
        
        for (const zoneName of gameZones) {
          if (!dbZoneNames.has(zoneName)) {
            zonesToAdd.push(zoneName);
          }
        }
        
        console.log(`   ➕ Found ${zonesToAdd.length} zones in game but not in database`);
        
        for (const zoneName of zonesToAdd) {
          // Extract owner from zone name (assuming format: ZORP_PlayerName)
          const owner = zoneName.replace('ZORP_', '') || 'Unknown';
          
          await pool.query(
            'INSERT INTO zorp_zones (name, owner, server_id, created_at, expire) VALUES (?, ?, ?, NOW(), 86400)',
            [zoneName, owner, server.id]
          );
          console.log(`      ➕ Added missing zone: ${zoneName} (owner: ${owner})`);
          totalZonesSynced++;
        }
        
        console.log(`   ✅ Server ${server.nickname} processed successfully\n`);
        
      } catch (error) {
        console.error(`   ❌ Error processing server ${server.nickname}:`, error.message);
        console.log('');
      }
    }
    
    console.log('🎉 ZORP Duplicate Fix Complete!');
    console.log(`📊 Summary:`);
    console.log(`   • Duplicates removed: ${totalDuplicatesRemoved}`);
    console.log(`   • Missing zones added: ${totalZonesSynced}`);
    console.log(`   • Total operations: ${totalDuplicatesRemoved + totalZonesSynced}`);
    
  } catch (error) {
    console.error('❌ Error in fixZorpDuplicates:', error);
  } finally {
    await pool.end();
    console.log('🔌 Database connection closed');
  }
}

async function getZonesFromGameServer(server) {
  return new Promise((resolve, reject) => {
    const WebSocket = require('ws');
    const ws = new WebSocket(`ws://${server.ip}:${server.port}/${server.password}`);
    
    const timeout = setTimeout(() => {
      ws.close();
      resolve([]); // Return empty array on timeout
    }, 10000); // 10 second timeout
    
    ws.on('open', () => {
      const zonesCommand = JSON.stringify({ 
        Identifier: 1, 
        Message: 'zones.listcustomzones', 
        Name: 'WebRcon' 
      });
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
          
          clearTimeout(timeout);
          ws.close();
          resolve(gameZoneNames);
        }
      } catch (err) {
        clearTimeout(timeout);
        ws.close();
        resolve([]); // Return empty array on error
      }
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      ws.close();
      resolve([]); // Return empty array on error
    });
    
    ws.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

// Run the fix
fixZorpDuplicates();
