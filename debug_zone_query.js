const pool = require('./src/db');

async function debugZoneQuery() {
  try {
    console.log('🔍 Debugging Zone Query...');
    
    // Check the exact zone
    console.log('\n1. Checking zone ZORP_1754011367156...');
    const [zoneResult] = await pool.query(`
      SELECT * FROM zorp_zones WHERE name = 'ZORP_1754011367156'
    `);
    
    if (zoneResult.length > 0) {
      const zone = zoneResult[0];
      console.log('✅ Zone found:');
      console.log(`   Name: ${zone.name}`);
      console.log(`   Owner: ${zone.owner}`);
      console.log(`   Position: ${zone.position}`);
      console.log(`   Created: ${zone.created_at}`);
      console.log(`   Expire: ${zone.expire} seconds`);
      
      // Test the exact query used by handlePlayerOffline
      console.log('\n2. Testing handlePlayerOffline query...');
      const [offlineQuery] = await pool.query(
        'SELECT name FROM zorp_zones WHERE owner = ? AND created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP',
        ['nzcve7130']
      );
      
      console.log(`Query result: ${offlineQuery.length} zones found`);
      offlineQuery.forEach((zone, index) => {
        console.log(`   ${index + 1}. ${zone.name}`);
      });
      
      // Test the query step by step
      console.log('\n3. Testing query parts...');
      
      // Check owner
      const [ownerQuery] = await pool.query(
        'SELECT name FROM zorp_zones WHERE owner = ?',
        ['nzcve7130']
      );
      console.log(`Zones for nzcve7130: ${ownerQuery.length}`);
      
      // Check expiration
      const [expireQuery] = await pool.query(
        'SELECT name, created_at, expire, created_at + INTERVAL expire SECOND as expires_at, NOW() as current_timestamp FROM zorp_zones WHERE owner = ?',
        ['nzcve7130']
      );
      expireQuery.forEach((zone, index) => {
        console.log(`   Zone ${index + 1}: ${zone.name}`);
        console.log(`     Created: ${zone.created_at}`);
        console.log(`     Expires: ${zone.expires_at}`);
        console.log(`     Current: ${zone.current_timestamp}`);
        console.log(`     Is expired: ${new Date(zone.expires_at) < new Date(zone.current_timestamp)}`);
      });
      
    } else {
      console.log('❌ Zone not found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

debugZoneQuery(); 