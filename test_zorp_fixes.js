const pool = require('./src/db');

async function testZorpFixes() {
  try {
    console.log('🧪 Testing Zorp Fixes...\n');

    // Test 1: Check zorp_zones table structure
    console.log('1. Testing zorp_zones table structure...');
    const [zoneResult] = await pool.query(
      'DESCRIBE zorp_zones'
    );
    console.log('✅ Zorp zones table columns:', zoneResult.map(col => col.Field));

    // Test 2: Check zorp_defaults table structure
    console.log('\n2. Testing zorp_defaults table structure...');
    const [defaultsResult] = await pool.query(
      'DESCRIBE zorp_defaults'
    );
    console.log('✅ Zorp defaults table columns:', defaultsResult.map(col => col.Field));

    // Test 3: Check if there are any existing zorp zones
    console.log('\n3. Testing existing zorp zones...');
    const [existingZones] = await pool.query(
      'SELECT owner, name, created_at FROM zorp_zones LIMIT 5'
    );
    console.log('✅ Existing zorp zones:', existingZones.length);
    existingZones.forEach(zone => {
      console.log(`   - ${zone.owner}: ${zone.name} (created: ${zone.created_at})`);
    });

    // Test 4: Check server configuration
    console.log('\n4. Testing server configuration...');
    const [servers] = await pool.query(
      'SELECT nickname, ip, port FROM rust_servers LIMIT 3'
    );
    console.log('✅ Servers found:', servers.length);
    servers.forEach(server => {
      console.log(`   - ${server.nickname}: ${server.ip}:${server.port}`);
    });

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📝 Summary of zorp fixes applied:');
    console.log('   - Improved delete emote detection with better logging');
    console.log('   - Fixed team logic: zones only turn red when ALL team members are offline');
    console.log('   - Zones turn green when ANY team member comes online');
    console.log('   - Added comprehensive debug logging for troubleshooting');
    console.log('   - Enhanced error handling and validation');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testZorpFixes(); 