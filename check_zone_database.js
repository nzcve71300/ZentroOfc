const pool = require('./src/db');

async function checkZoneDatabase() {
  try {
    console.log('🔍 Checking Zone Database...');
    
    // Check for the specific zone
    console.log('\n1. Checking for zone ZORP_1754011367156...');
    const [zoneResult] = await pool.query(`
      SELECT * FROM zorp_zones WHERE name = 'ZORP_1754011367156'
    `);
    
    if (zoneResult.length === 0) {
      console.log('❌ Zone ZORP_1754011367156 not found in database');
      
      // Check for any zones for this player
      console.log('\n2. Checking for any zones owned by nzcve7130...');
      const [playerZones] = await pool.query(`
        SELECT * FROM zorp_zones WHERE owner = 'nzcve7130'
      `);
      
      if (playerZones.length === 0) {
        console.log('❌ No zones found for player nzcve7130');
      } else {
        console.log(`✅ Found ${playerZones.length} zone(s) for nzcve7130:`);
        playerZones.forEach((zone, index) => {
          console.log(`   Zone ${index + 1}: ${zone.name}`);
          console.log(`   Position: ${zone.position}`);
          console.log(`   Created: ${zone.created_at}`);
          console.log(`   Expires: ${new Date(new Date(zone.created_at).getTime() + zone.expire * 1000)}`);
        });
      }
    } else {
      const zone = zoneResult[0];
      console.log('✅ Zone found in database:');
      console.log(`   Name: ${zone.name}`);
      console.log(`   Owner: ${zone.owner}`);
      console.log(`   Position: ${zone.position}`);
      console.log(`   Created: ${zone.created_at}`);
      console.log(`   Expires: ${new Date(new Date(zone.created_at).getTime() + zone.expire * 1000)}`);
      
      // Test the query used by handlePlayerOffline
      console.log('\n3. Testing handlePlayerOffline query...');
      const [offlineQuery] = await pool.query(
        'SELECT name FROM zorp_zones WHERE owner = ? AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
        ['nzcve7130']
      );
      
      if (offlineQuery.length > 0) {
        console.log('✅ handlePlayerOffline query would find this zone');
      } else {
        console.log('❌ handlePlayerOffline query would NOT find this zone');
      }
    }
    
    // Check all zones in database
    console.log('\n4. All zones in database:');
    const [allZones] = await pool.query('SELECT name, owner, position, created_at FROM zorp_zones');
    console.log(`Total zones: ${allZones.length}`);
    allZones.forEach((zone, index) => {
      console.log(`   ${index + 1}. ${zone.name} (${zone.owner}) - ${zone.position}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking zone database:', error);
  } finally {
    await pool.end();
  }
}

checkZoneDatabase(); 