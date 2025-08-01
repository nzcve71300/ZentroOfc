const pool = require('./src/db');

async function debugZoneQuery() {
  try {
    console.log('🔍 Debugging Zone Query (MariaDB)...');

    // Check all zones for nzcve7130
    console.log('\n1. Checking all zones for nzcve7130...');
    const [zoneResult] = await pool.query(
      'SELECT * FROM zones WHERE owner = ?',
      ['nzcve7130']
    );

    console.log(`Found ${zoneResult.length} zones for nzcve7130:`);
    zoneResult.forEach((zone, index) => {
      console.log(`   ${index + 1}. ${zone.name}`);
      console.log(`      Created: ${zone.created_at}`);
      console.log(`      Expire: ${zone.expire} seconds`);
      console.log(`      Position: ${zone.position}`);
    });

    // Test the exact query used by handlePlayerOffline (MariaDB syntax)
    console.log('\n2. Testing handlePlayerOffline query...');
    const [offlineQuery] = await pool.query(
      'SELECT name FROM zones WHERE owner = ? AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
      ['nzcve7130']
    );

    console.log(`Query result: ${offlineQuery.length} zones found`);
    offlineQuery.forEach((zone, index) => {
      console.log(`   ${index + 1}. ${zone.name}`);
    });

    // Check all zones in database
    console.log('\n3. All zones in database:');
    const [allZones] = await pool.query('SELECT name, owner, created_at, expire FROM zones');
    console.log(`Total zones: ${allZones.length}`);
    allZones.forEach((zone, index) => {
      console.log(`   ${index + 1}. ${zone.name} (${zone.owner}) - Created: ${zone.created_at}, Expire: ${zone.expire}s`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

debugZoneQuery(); 