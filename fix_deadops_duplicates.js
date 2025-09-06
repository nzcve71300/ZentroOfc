const pool = require('./src/db');
const WebSocket = require('ws');

async function fixDeadopsDuplicates() {
  console.log('🔧 Fixing Dead-ops ZORP Duplicates...\n');
  
  try {
    // Connect to database
    console.log('✅ Connected to database');
    
    // Get Dead-ops server info
    const [servers] = await pool.query(
      'SELECT id, nickname, ip, port, password FROM rust_servers WHERE nickname = ?',
      ['Dead-ops']
    );
    
    if (servers.length === 0) {
      console.log('❌ Dead-ops server not found');
      return;
    }
    
    const server = servers[0];
    console.log(`📡 Found server: ${server.nickname} (${server.ip}:${server.port})\n`);
    
    // Get zones from game server
    const gameZones = await getZonesFromGameServer(server);
    console.log(`🎮 Found ${gameZones.length} zones in game`);
    
    // Get zones from database
    const [dbZones] = await pool.query(
      'SELECT id, name, owner, created_at FROM zorp_zones WHERE server_id = ? ORDER BY owner, created_at',
      [server.id]
    );
    console.log(`📊 Found ${dbZones.length} zones in database\n`);
    
    // Group zones by owner to find duplicates
    const zonesByOwner = {};
    for (const zone of dbZones) {
      if (!zonesByOwner[zone.owner]) {
        zonesByOwner[zone.owner] = [];
      }
      zonesByOwner[zone.owner].push(zone);
    }
    
    console.log('🔍 Analyzing zones by owner:');
    let totalDuplicatesToRemove = 0;
    const duplicatesToRemove = [];
    
    for (const [owner, zones] of Object.entries(zonesByOwner)) {
      if (zones.length > 1) {
        console.log(`   👤 ${owner}: ${zones.length} zones`);
        
        // Sort by creation date (keep the most recent)
        zones.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        // Keep the first (most recent), mark others for deletion
        const toKeep = zones[0];
        const toDelete = zones.slice(1);
        
        console.log(`      ✅ Keeping: ${toKeep.name} (ID: ${toKeep.id}, Created: ${toKeep.created_at})`);
        
        for (const zone of toDelete) {
          console.log(`      ❌ Deleting: ${zone.name} (ID: ${zone.id}, Created: ${zone.created_at})`);
          duplicatesToRemove.push(zone);
          totalDuplicatesToRemove++;
        }
      } else {
        console.log(`   👤 ${owner}: ${zones.length} zone (no duplicates)`);
      }
    }
    
    console.log(`\n🗑️  Found ${totalDuplicatesToRemove} duplicate zones to remove\n`);
    
    if (totalDuplicatesToRemove > 0) {
      console.log('🧹 Removing duplicates...');
      
      for (const zone of duplicatesToRemove) {
        try {
          await pool.query('DELETE FROM zorp_zones WHERE id = ?', [zone.id]);
          console.log(`   ✅ Deleted zone ID: ${zone.id} (${zone.name})`);
        } catch (error) {
          console.error(`   ❌ Failed to delete zone ID: ${zone.id}:`, error.message);
        }
      }
      
      console.log(`\n🎉 Successfully removed ${totalDuplicatesToRemove} duplicate zones!`);
    } else {
      console.log('✅ No duplicates found to remove');
    }
    
    // Final verification
    console.log('\n📋 Final verification:');
    const [finalZones] = await pool.query(
      'SELECT owner, COUNT(*) as count FROM zorp_zones WHERE server_id = ? GROUP BY owner ORDER BY count DESC',
      [server.id]
    );
    
    for (const zone of finalZones) {
      if (zone.count > 1) {
        console.log(`   ⚠️  ${zone.owner}: ${zone.count} zones (still has duplicates)`);
      } else {
        console.log(`   ✅ ${zone.owner}: ${zone.count} zone`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error in fixDeadopsDuplicates:', error);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

async function getZonesFromGameServer(server) {
  return new Promise((resolve, reject) => {
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
fixDeadopsDuplicates();
