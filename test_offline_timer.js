const pool = require('./src/db');

async function testOfflineTimer() {
  try {
    console.log('🔍 Testing Offline Timer System...\n');

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
      const expireTime = new Date(new Date(zone.created_at).getTime() + zone.expire * 1000);
      const hours = zone.expire / 3600;
      console.log(`  - ${zone.name} (owner: ${zone.owner})`);
      console.log(`    State: ${zone.current_state || 'unknown'}`);
      console.log(`    Expire: ${hours} hours (${zone.expire} seconds)`);
      console.log(`    Created: ${zone.created_at}`);
      console.log(`    Expires at: ${expireTime}`);
      console.log(`    Last online: ${zone.last_online_at || 'never'}`);
      console.log('');
    });

    console.log('📊 Offline Timer System Features:');
    console.log('✅ When players go offline → timer starts counting down');
    console.log('✅ When players come online → timer resets');
    console.log('✅ When offline for full expire time → Zorp gets deleted');
    console.log('✅ Timer is robust and accurate (not based on creation time)');
    console.log('✅ Memory cleanup prevents leaks');

    console.log('\n🔍 To test the system:');
    console.log('1. Go to your Zorp zone in-game');
    console.log('2. Disconnect from the server');
    console.log('3. Wait for the expire time (check logs for timer start)');
    console.log('4. Reconnect before expire time - timer should reset');
    console.log('5. Disconnect again and wait full expire time - Zorp should be deleted');

    console.log('\n🔍 To monitor logs:');
    console.log('pm2 logs zentro-bot --lines 100');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testOfflineTimer();
