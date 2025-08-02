const pool = require('./src/db');
const { sendRconCommand } = require('./src/rcon');

async function testAllZorps() {
  try {
    console.log('🧪 Testing All Zorps in SSH...\n');

    // Get all servers
    const [servers] = await pool.query(
      'SELECT id, nickname, ip, port, password FROM rust_servers'
    );

    console.log(`📡 Found ${servers.length} servers:`);
    servers.forEach(server => {
      console.log(`   - ${server.nickname} (${server.ip}:${server.port})`);
    });

    // Check zorp zones in database for all servers
    console.log('\n📋 Checking zorp zones in database:');
    const [allZones] = await pool.query(
      'SELECT zz.name, zz.owner, rs.nickname as server_name FROM zorp_zones zz JOIN rust_servers rs ON zz.server_id = rs.id'
    );

    console.log(`📊 Total zorp zones in database: ${allZones.length}`);
    allZones.forEach(zone => {
      console.log(`   - ${zone.name} (${zone.owner}) on ${zone.server_name}`);
    });

    if (allZones.length === 0) {
      console.log('\n⚠️ No zorp zones found in database!');
    }

    // Test each server for zones in game
    console.log('\n🎮 Testing zones in game for each server:');
    
    for (const server of servers) {
      console.log(`\n🔍 Testing server: ${server.nickname}`);
      
      try {
        // Test RCON connection
        console.log(`   📡 Connecting to ${server.ip}:${server.port}...`);
        const echoResult = await sendRconCommand(server.ip, server.port, server.password, 'echo "RCON Test"');
        console.log(`   ✅ RCON connection successful`);
        
        // Test zones.listcustomzones
        console.log(`   📋 Checking zones in game...`);
        const zonesList = await sendRconCommand(server.ip, server.port, server.password, 'zones.listcustomzones');
        console.log(`   📝 Zones in game: ${zonesList}`);
        
        // Check if there are any zones for this server in database
        const [serverZones] = await pool.query(
          'SELECT name, owner FROM zorp_zones WHERE server_id = ?',
          [server.id]
        );
        
        console.log(`   📊 Zones in database for ${server.nickname}: ${serverZones.length}`);
        serverZones.forEach(zone => {
          console.log(`      - ${zone.name} (${zone.owner})`);
        });
        
        // If there are zones in database but not in game, try to delete them
        if (serverZones.length > 0) {
          console.log(`   🗑️ Attempting to delete zones from database...`);
          
          for (const zone of serverZones) {
            try {
              console.log(`      🗑️ Deleting zone: ${zone.name}`);
              
              // Try to delete from game first
              const deleteCommand = `zones.deletecustomzone "${zone.name}"`;
              const deleteResult = await sendRconCommand(server.ip, server.port, server.password, deleteCommand);
              console.log(`      ✅ Game delete command sent: ${deleteResult}`);
              
              // Delete from database
              await pool.query('DELETE FROM zorp_zones WHERE name = ?', [zone.name]);
              console.log(`      ✅ Deleted from database: ${zone.name}`);
              
            } catch (error) {
              console.log(`      ❌ Failed to delete ${zone.name}: ${error.message}`);
            }
          }
        }
        
      } catch (error) {
        console.log(`   ❌ Failed to connect to ${server.nickname}: ${error.message}`);
      }
    }

    // Final check - see what's left in database
    console.log('\n📊 Final database check:');
    const [finalZones] = await pool.query(
      'SELECT zz.name, zz.owner, rs.nickname as server_name FROM zorp_zones zz JOIN rust_servers rs ON zz.server_id = rs.id'
    );

    console.log(`📋 Remaining zorp zones in database: ${finalZones.length}`);
    finalZones.forEach(zone => {
      console.log(`   - ${zone.name} (${zone.owner}) on ${zone.server_name}`);
    });

    console.log('\n✅ All zorp testing completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testAllZorps(); 