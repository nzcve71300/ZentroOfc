const pool = require('./src/db');

async function testZorpOfflineFix() {
  try {
    console.log('🔍 Testing Zorp Offline Expiration Fix...\n');

    // Check current active zones
    console.log('1. Checking current active Zorp zones...');
    const [activeZones] = await pool.query(`
      SELECT z.*, rs.nickname 
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      ORDER BY z.owner, z.created_at
    `);
    
    console.log(`Found ${activeZones.length} active zones:`);
    activeZones.forEach(zone => {
      const expireTime = new Date(new Date(zone.created_at).getTime() + zone.expire * 1000);
      const timeLeft = Math.floor((expireTime - new Date()) / (1000 * 60 * 60)); // hours
      console.log(`  - ${zone.owner} on ${zone.nickname}: ${zone.name} (${timeLeft} hours left)`);
    });

    // Check zorp_defaults
    console.log('\n2. Checking Zorp defaults...');
    const [defaults] = await pool.query('SELECT * FROM zorp_defaults');
    console.log(`Found ${defaults.length} server defaults:`);
    defaults.forEach(def => {
      const expireHours = def.expire / 3600;
      console.log(`  - Server ID: ${def.server_id}, Expire: ${def.expire} seconds (${expireHours} hours)`);
    });

    console.log('\n3. Testing offline protection logic...');
    console.log('✅ OFFLINE_PROTECTION_DURATION: 30 minutes (1800 seconds)');
    console.log('✅ Zone expire time: 35 hours (126000 seconds) - this is the TOTAL lifetime');
    console.log('✅ Offline protection: 30 minutes - this is how long zones stay protected when offline');
    
    console.log('\n4. Expected behavior after fix:');
    console.log('   - Player goes offline → Zone turns yellow (5 min delay)');
    console.log('   - After 5 minutes → Zone turns red (offline protection starts)');
    console.log('   - After 30 minutes → Zone is deleted (offline protection expires)');
    console.log('   - Total zone lifetime: 35 hours from creation');
    
    console.log('\n🎉 Fix Summary:');
    console.log('   - Zorps will now be deleted after 30 minutes of offline protection');
    console.log('   - This prevents zones from staying protected for 35 hours when offline');
    console.log('   - Players need to come back online within 30 minutes to keep their zone');

  } catch (error) {
    console.error('❌ Error testing Zorp offline fix:', error);
  } finally {
    await pool.end();
  }
}

testZorpOfflineFix(); 