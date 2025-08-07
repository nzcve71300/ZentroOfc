const pool = require('./src/db');

async function testZorpStatus() {
  try {
    console.log('🔍 Testing Zorp Status...\n');

    // Get a test server
    const [servers] = await pool.query('SELECT * FROM rust_servers LIMIT 1');
    if (servers.length === 0) {
      console.log('❌ No servers found in database');
      return;
    }

    const server = servers[0];
    console.log(`📋 Server: ${server.nickname}`);
    console.log(`🌐 IP: ${server.ip}:${server.port}\n`);

    // Check Zorp zones
    const [zones] = await pool.query('SELECT * FROM zorp_zones LIMIT 10');
    console.log(`🏠 Found ${zones.length} Zorp zones:`);
    
    zones.forEach(zone => {
      const isExpired = new Date() > new Date(zone.created_at.getTime() + zone.expire * 1000);
      console.log(`  - ${zone.name} (owner: ${zone.owner}) ${isExpired ? '❌ EXPIRED' : '✅ ACTIVE'}`);
    });

    console.log('\n📊 To test offline detection:');
    console.log('1. Go to your Zorp zone in-game');
    console.log('2. Disconnect from the server');
    console.log('3. Wait 30 seconds');
    console.log('4. Check if zone turned red');
    console.log('5. Reconnect and wait 30 seconds');
    console.log('6. Check if zone turned green');

    console.log('\n🔍 To monitor logs:');
    console.log('pm2 logs zentro-bot --lines 50');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testZorpStatus(); 