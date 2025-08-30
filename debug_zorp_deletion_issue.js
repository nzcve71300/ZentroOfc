const pool = require('./src/db');

async function debugZorpDeletionIssue() {
  try {
    console.log('🔍 Debugging Zorp Deletion Issue...\n');

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
      const minutesLeft = Math.floor((expireTime - new Date()) / (1000 * 60)); // minutes
      console.log(`  - ${zone.owner} on ${zone.nickname}: ${zone.name}`);
      console.log(`    Created: ${zone.created_at}`);
      console.log(`    Expire: ${zone.expire} seconds (${zone.expire/3600} hours)`);
      console.log(`    Time left: ${timeLeft} hours (${minutesLeft} minutes)`);
      console.log(`    Current state: ${zone.current_state || 'unknown'}`);
      console.log('');
    });

    // Check if there are any zones that should be active but aren't
    console.log('2. Checking for recently deleted zones...');
    const [recentZones] = await pool.query(`
      SELECT z.*, rs.nickname 
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY z.created_at DESC
      LIMIT 10
    `);
    
    console.log(`Found ${recentZones.length} zones created in last 24 hours:`);
    recentZones.forEach(zone => {
      const expireTime = new Date(new Date(zone.created_at).getTime() + zone.expire * 1000);
      const isExpired = new Date() > expireTime;
      const timeLeft = Math.floor((expireTime - new Date()) / (1000 * 60 * 60)); // hours
      console.log(`  - ${zone.owner} on ${zone.nickname}: ${zone.name}`);
      console.log(`    Created: ${zone.created_at}`);
      console.log(`    Expire: ${zone.expire} seconds (${zone.expire/3600} hours)`);
      console.log(`    Status: ${isExpired ? 'EXPIRED' : 'ACTIVE'} (${timeLeft} hours left)`);
      console.log(`    Current state: ${zone.current_state || 'unknown'}`);
      console.log('');
    });

    // Check the initialization logic
    console.log('3. Testing initialization query...');
    const [redZones] = await pool.query(`
      SELECT z.*, rs.nickname
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.current_state = 'red' AND z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
    `);
    
    console.log(`Found ${redZones.length} red zones that would be initialized:`);
    redZones.forEach(zone => {
      const expireTime = new Date(new Date(zone.created_at).getTime() + zone.expire * 1000);
      const timeLeft = Math.floor((expireTime - new Date()) / (1000 * 60 * 60)); // hours
      console.log(`  - ${zone.owner} on ${zone.nickname}: ${zone.name} (${timeLeft} hours left)`);
    });

    console.log('\n4. Analysis of the issue:');
    console.log('   The problem might be in the initializeOfflineTimers function.');
    console.log('   When the bot starts up, it finds red zones and starts offline timers.');
    console.log('   But it\'s using the full expire time instead of calculating remaining time.');
    console.log('   This means if a zone was created 30 hours ago and has 5 hours left,');
    console.log('   it would set a timer for 35 hours instead of 5 hours.');

    console.log('\n5. Expected behavior:');
    console.log('   - Zone created → 35 hours total lifetime');
    console.log('   - Player goes offline → Zone turns red');
    console.log('   - Zone should stay protected for the remaining time (not full 35 hours)');
    console.log('   - If zone was created 30 hours ago, it should only stay protected for 5 more hours');

  } catch (error) {
    console.error('❌ Error debugging Zorp deletion issue:', error);
  } finally {
    await pool.end();
  }
}

debugZorpDeletionIssue();
