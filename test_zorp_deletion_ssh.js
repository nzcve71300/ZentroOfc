const pool = require('./src/db');
const { sendRconCommand } = require('./src/rcon');

async function testZorpDeletion() {
  try {
    console.log('🧪 Testing Zorp Deletion in SSH...\n');

    // Get a server from database
    const [servers] = await pool.query(
      'SELECT id, nickname, ip, port, password FROM rust_servers LIMIT 1'
    );

    if (servers.length === 0) {
      console.log('❌ No servers found in database');
      return;
    }

    const server = servers[0];
    console.log(`📡 Testing on server: ${server.nickname} (${server.ip}:${server.port})`);

    // Get existing zorp zones
    const [zonesResult] = await pool.query(
      'SELECT name, owner FROM zorp_zones WHERE server_id = ?',
      [server.id]
    );

    console.log(`📋 Found ${zonesResult.length} zorp zones on ${server.nickname}:`);
    zonesResult.forEach(zone => {
      console.log(`   - ${zone.name} (${zone.owner})`);
    });

    if (zonesResult.length === 0) {
      console.log('✅ No zorp zones to delete');
      return;
    }

    // Test RCON connection first
    try {
      console.log('\n🔍 Testing RCON connection...');
      const echoResult = await sendRconCommand(server.ip, server.port, server.password, 'echo "RCON Test"');
      console.log('✅ RCON connection successful');
      console.log('📝 Echo response:', echoResult);
    } catch (error) {
      console.error('❌ RCON connection failed:', error.message);
      return;
    }

    // Test zones.listcustomzones
    try {
      console.log('\n🔍 Testing zones.listcustomzones...');
      const zonesList = await sendRconCommand(server.ip, server.port, server.password, 'zones.listcustomzones');
      console.log('✅ Zones list command successful');
      console.log('📝 Zones in game:', zonesList);
    } catch (error) {
      console.error('❌ Zones list command failed:', error.message);
    }

    // Test deleting the first zone
    if (zonesResult.length > 0) {
      const testZone = zonesResult[0];
      console.log(`\n🗑️ Testing deletion of zone: ${testZone.name}`);
      
      try {
        const deleteCommand = `zones.deletecustomzone "${testZone.name}"`;
        console.log(`📤 Sending command: ${deleteCommand}`);
        
        const deleteResult = await sendRconCommand(server.ip, server.port, server.password, deleteCommand);
        console.log('✅ Delete command sent successfully');
        console.log('📝 Delete response:', deleteResult);
        
        // Check if zone was actually deleted from database
        const [checkResult] = await pool.query(
          'SELECT name FROM zorp_zones WHERE name = ?',
          [testZone.name]
        );
        
        if (checkResult.length === 0) {
          console.log('✅ Zone successfully deleted from database');
        } else {
          console.log('⚠️ Zone still exists in database');
        }
        
      } catch (error) {
        console.error('❌ Delete command failed:', error.message);
      }
    }

    console.log('\n✅ Zorp deletion test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testZorpDeletion(); 