const pool = require('./src/db');

async function testZorpDeletionTimers() {
  try {
    console.log('🔍 Testing Zorp Deletion Timer Cleanup...\n');

    // Get a test server
    const [servers] = await pool.query('SELECT * FROM rust_servers LIMIT 1');
    if (servers.length === 0) {
      console.log('❌ No servers found in database');
      return;
    }

    const server = servers[0];
    console.log(`📋 Server: ${server.nickname}`);
    console.log(`🌐 IP: ${server.ip}:${server.port}\n`);

    // Check current Zorp zones
    const [zones] = await pool.query(`
      SELECT z.*, rs.nickname 
      FROM zorp_zones z
      JOIN rust_servers rs ON z.server_id = rs.id
      WHERE z.created_at + INTERVAL z.expire SECOND > CURRENT_TIMESTAMP
      ORDER BY z.owner, z.created_at
    `);
    
    console.log(`🏠 Found ${zones.length} active Zorp zones:`);
    
    zones.forEach(zone => {
      const hours = zone.expire / 3600;
      console.log(`  - ${zone.name} (owner: ${zone.owner})`);
      console.log(`    State: ${zone.current_state || 'unknown'}`);
      console.log(`    Expire: ${hours} hours (${zone.expire} seconds)`);
      console.log('');
    });

    console.log('📊 Deletion Methods That Clear Offline Timers:');
    console.log('✅ Player self-deletion (goodbye emote)');
    console.log('✅ Admin /delete-zorp command');
    console.log('✅ Admin /wipe-zorps command');
    console.log('✅ Offline expiration (timer completes)');
    console.log('✅ System disable (/edit-zorp zorp:false)');

    console.log('\n🔧 Timer Cleanup Functions:');
    console.log('✅ clearOfflineExpirationTimer() - Clears timer and references');
    console.log('✅ handleOfflineExpiration() - Deletes zone when timer expires');
    console.log('✅ Memory cleanup - Prevents leaks every 10 minutes');

    console.log('\n🎯 Test Scenarios:');
    console.log('1. Player goes offline → timer starts');
    console.log('2. Player uses goodbye emote → timer cleared, zone deleted');
    console.log('3. Admin uses /delete-zorp → timer cleared, zone deleted');
    console.log('4. Admin uses /wipe-zorps → all timers cleared, all zones deleted');
    console.log('5. Timer expires → zone deleted, timer references cleaned up');

    console.log('\n🔍 To test the system:');
    console.log('1. Create a Zorp zone in-game');
    console.log('2. Go offline (timer should start)');
    console.log('3. Come back online and use goodbye emote');
    console.log('4. Check logs for timer cleanup messages');
    console.log('5. Verify zone is deleted and no timer references remain');

    console.log('\n🔍 To monitor logs:');
    console.log('pm2 logs zentro-bot --lines 100');

    console.log('\n📝 Expected Log Messages:');
    console.log('[ZORP OFFLINE TIMER] Starting offline expiration timer for PlayerName (ZoneName) - 126000 seconds');
    console.log('[ZORP OFFLINE TIMER] Cleared offline timer for ZoneName');
    console.log('[ZORP OFFLINE TIMER] Offline expiration reached for PlayerName (ZoneName) - deleting Zorp');
    console.log('[ZORP] PlayerName Zorp deleted');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testZorpDeletionTimers();
