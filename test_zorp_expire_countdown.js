he const pool = require('./src/db');

async function testZorpExpireCountdown() {
  try {
    console.log('🔍 Testing Zorp Expire Countdown System...\n');

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
      const expireHours = zone.expire / 3600;
      console.log(`  - ${zone.owner} on ${zone.nickname}: ${zone.name}`);
      console.log(`    Created: ${zone.created_at}`);
      console.log(`    Expire setting: ${zone.expire} seconds (${expireHours} hours)`);
      console.log(`    Current state: ${zone.current_state || 'unknown'}`);
      console.log('');
    });

    console.log('2. New Expire Countdown System:');
    console.log('✅ SEPARATE EXPIRE TIMER: Now uses a dedicated expire countdown timer');
    console.log('✅ OFFLINE COUNTDOWN: When player goes offline, expire timer starts counting down');
    console.log('✅ ONLINE PAUSE: When player comes back online, expire timer pauses');
    console.log('✅ OFFLINE RESTART: When player goes offline again, expire timer restarts from beginning');
    console.log('✅ ZONE DELETION: If player stays offline longer than expire time, zone is deleted');

    console.log('\n3. Timeline Example:');
    console.log('   Player creates Zorp → Zone is white for delay period');
    console.log('   After delay → Zone turns green (online protection)');
    console.log('   Player goes offline → Zone turns yellow, then red');
    console.log('   Expire timer starts → Counting down from expire setting (e.g., 35 hours)');
    console.log('   Player comes back online → Zone turns green, expire timer pauses');
    console.log('   Player goes offline again → Zone turns red, expire timer restarts from beginning');
    console.log('   Player stays offline > expire time → Zone is deleted');

    console.log('\n4. Key Changes:');
    console.log('   - Expire timer is now SEPARATE from total lifetime');
    console.log('   - Expire timer RESETS when player comes back online');
    console.log('   - Expire timer RESTARTS when player goes offline again');
    console.log('   - Zone is deleted when expire countdown reaches zero');
    console.log('   - Total lifetime is still tracked for overall zone expiration');

    console.log('\n5. Admin Control:');
    console.log('   - Use /edit-zorp expire:35 to set 35-hour expire countdown');
    console.log('   - Use /edit-zorp delay:5 to set 5-minute delay before red');
    console.log('   - Expire countdown is independent of total zone lifetime');

  } catch (error) {
    console.error('❌ Error testing Zorp expire countdown:', error);
  } finally {
    await pool.end();
  }
}

testZorpExpireCountdown();
