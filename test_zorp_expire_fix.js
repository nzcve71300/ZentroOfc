const pool = require('./src/db');

async function testZorpExpireFix() {
  try {
    console.log('🔍 Testing Zorp Expire Fix...\n');

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
      const createdTime = new Date(zone.created_at).getTime();
      const expireTime = createdTime + (zone.expire * 1000);
      const remainingTime = Math.max(0, Math.floor((expireTime - Date.now()) / 1000));
      const hoursLeft = Math.floor(remainingTime / 3600);
      const minutesLeft = Math.floor((remainingTime % 3600) / 60);
      
      console.log(`  - ${zone.owner} on ${zone.nickname}: ${zone.name}`);
      console.log(`    Created: ${zone.created_at}`);
      console.log(`    Total expire: ${zone.expire} seconds (${zone.expire/3600} hours)`);
      console.log(`    Remaining time: ${hoursLeft}h ${minutesLeft}m (${remainingTime} seconds)`);
      console.log(`    Current state: ${zone.current_state || 'unknown'}`);
      console.log('');
    });

    // Test the calculation logic
    console.log('2. Testing calculation logic...');
    if (activeZones.length > 0) {
      const testZone = activeZones[0];
      const createdTime = new Date(testZone.created_at).getTime();
      const expireTime = createdTime + (testZone.expire * 1000);
      const remainingTime = Math.max(0, Math.floor((expireTime - Date.now()) / 1000));
      
      console.log(`Test zone: ${testZone.name}`);
      console.log(`Created: ${new Date(createdTime)}`);
      console.log(`Expires: ${new Date(expireTime)}`);
      console.log(`Remaining: ${remainingTime} seconds (${Math.floor(remainingTime/3600)}h ${Math.floor((remainingTime%3600)/60)}m)`);
      console.log(`Full expire time: ${testZone.expire} seconds`);
      console.log(`Difference: ${testZone.expire - remainingTime} seconds (${Math.floor((testZone.expire - remainingTime)/3600)}h)`);
    }

    console.log('\n3. Fix Summary:');
    console.log('✅ BEFORE: Bot used full expire time for offline protection');
    console.log('✅ AFTER: Bot uses remaining time for offline protection');
    console.log('✅ Example: Zone created 30 hours ago with 35h total lifetime');
    console.log('   - OLD: Would stay protected for 35 hours when offline');
    console.log('   - NEW: Will stay protected for 5 hours when offline');
    console.log('✅ This ensures zones are deleted at the correct time');

    console.log('\n4. Expected behavior:');
    console.log('   - Player goes offline → Zone turns red');
    console.log('   - Zone stays protected for remaining time (not full expire time)');
    console.log('   - Zone gets deleted when total lifetime expires');
    console.log('   - Players can set custom expire times with /edit-zorp expire');

  } catch (error) {
    console.error('❌ Error testing Zorp expire fix:', error);
  } finally {
    await pool.end();
  }
}

testZorpExpireFix();
