const pool = require('./src/db');

async function testZoneColorSetting() {
  try {
    console.log('🔍 Testing Zone Color Setting...');
    
    const playerName = 'nzcve7130';
    
    // 1. Check current zone details
    console.log(`\n1. Checking zone details for ${playerName}...`);
    const [zoneResult] = await pool.query(`
      SELECT z.*, rs.nickname, rs.ip, rs.port, rs.password
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.owner = ? AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
    `, [playerName]);
    
    if (zoneResult.length === 0) {
      console.log('❌ No active zone found for player');
      return;
    }
    
    const zone = zoneResult[0];
    console.log(`✅ Found zone: ${zone.name}`);
    console.log(`📍 Server: ${zone.nickname} (${zone.ip}:${zone.port})`);
    console.log(`🎨 Online color: ${zone.color_online}`);
    console.log(`🔴 Offline color: ${zone.color_offline}`);
    
    // 2. Test the setZoneToRed function logic
    console.log(`\n2. Testing setZoneToRed logic...`);
    
    // Simulate the exact query from setZoneToRed
    const [redZoneResult] = await pool.query(
      'SELECT name, color_offline FROM zorp_zones WHERE owner = ? AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
      [playerName]
    );
    
    if (redZoneResult.length > 0) {
      const redZone = redZoneResult[0];
      console.log(`✅ setZoneToRed query found zone: ${redZone.name}`);
      console.log(`🎨 Offline color: ${redZone.color_offline}`);
      
      // Show what RCON commands would be sent
      console.log(`\n📡 RCON commands that would be sent:`);
      console.log(`zones.editcustomzone "${redZone.name}" allowbuilding 1`);
      console.log(`zones.editcustomzone "${redZone.name}" allowbuildingdamage 0`);
      console.log(`zones.editcustomzone "${redZone.name}" allowpvpdamage 0`);
      console.log(`zones.editcustomzone "${redZone.name}" color (${redZone.color_offline})`);
      
    } else {
      console.log('❌ setZoneToRed query found no zones');
    }
    
    // 3. Test the setZoneToGreen function logic
    console.log(`\n3. Testing setZoneToGreen logic...`);
    
    const [greenZoneResult] = await pool.query(
      'SELECT name, color_online FROM zorp_zones WHERE owner = ? AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
      [playerName]
    );
    
    if (greenZoneResult.length > 0) {
      const greenZone = greenZoneResult[0];
      console.log(`✅ setZoneToGreen query found zone: ${greenZone.name}`);
      console.log(`🎨 Online color: ${greenZone.color_online}`);
      
      // Show what RCON commands would be sent
      console.log(`\n📡 RCON commands that would be sent:`);
      console.log(`zones.editcustomzone "${greenZone.name}" allowbuilding 1`);
      console.log(`zones.editcustomzone "${greenZone.name}" allowbuildingdamage 1`);
      console.log(`zones.editcustomzone "${greenZone.name}" allowpvpdamage 1`);
      console.log(`zones.editcustomzone "${greenZone.name}" color (${greenZone.color_online})`);
      
    } else {
      console.log('❌ setZoneToGreen query found no zones');
    }
    
    // 4. Check if there are any issues with the zone data
    console.log(`\n4. Checking zone data integrity...`);
    console.log(`Zone name: ${zone.name}`);
    console.log(`Owner: ${zone.owner}`);
    console.log(`Created: ${zone.created_at}`);
    console.log(`Expire: ${zone.expire} seconds`);
    console.log(`Size: ${zone.size}`);
    console.log(`Position: ${zone.position}`);
    
    // 5. Test the exact query from handlePlayerOffline
    console.log(`\n5. Testing handlePlayerOffline query...`);
    const [offlineQuery] = await pool.query(
      'SELECT name FROM zorp_zones WHERE owner = ? AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
      [playerName]
    );
    
    console.log(`handlePlayerOffline query result: ${offlineQuery.length} zones found`);
    offlineQuery.forEach(z => {
      console.log(`  - ${z.name}`);
    });
    
    console.log('\n🎉 Zone color setting test completed!');
    
    if (offlineQuery.length > 0) {
      console.log('\n✅ The zone should be found and set to red when offline');
      console.log('⚠️  If the zone is not turning red, the issue might be:');
      console.log('   - RCON connection problems');
      console.log('   - Zone plugin not responding');
      console.log('   - Zone name mismatch');
    } else {
      console.log('\n❌ No zones found - this explains why zone doesn\'t turn red');
    }
    
  } catch (error) {
    console.error('❌ Error testing zone color setting:', error);
  } finally {
    await pool.end();
  }
}

testZoneColorSetting(); 