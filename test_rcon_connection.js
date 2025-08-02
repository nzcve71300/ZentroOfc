const { sendRconCommand } = require('./src/rcon');
const pool = require('./src/db');

async function testRconConnection() {
  try {
    console.log('🧪 Testing RCON Connection...\n');

    // Get a server from database
    const [servers] = await pool.query(
      'SELECT nickname, ip, port, password FROM rust_servers LIMIT 1'
    );

    if (servers.length === 0) {
      console.log('❌ No servers found in database');
      return;
    }

    const server = servers[0];
    console.log(`📡 Testing connection to: ${server.nickname} (${server.ip}:${server.port})`);

    // Test basic RCON connection
    try {
      console.log('🔍 Testing basic RCON connection...');
      const result = await sendRconCommand(server.ip, server.port, server.password, 'echo "RCON Test"');
      console.log('✅ RCON connection successful');
      console.log('📝 Response:', result);
    } catch (error) {
      console.error('❌ RCON connection failed:', error.message);
      return;
    }

    // Test zones.listcustomzones command
    try {
      console.log('\n🔍 Testing zones.listcustomzones command...');
      const zonesResult = await sendRconCommand(server.ip, server.port, server.password, 'zones.listcustomzones');
      console.log('✅ Zones list command successful');
      console.log('📝 Zones response:', zonesResult);
    } catch (error) {
      console.error('❌ Zones list command failed:', error.message);
    }

    // Test zone deletion with a test zone
    try {
      console.log('\n🔍 Testing zone deletion command...');
      const testZoneName = 'TEST_ZONE_DELETE';
      const deleteResult = await sendRconCommand(server.ip, server.port, server.password, `zones.deletecustomzone "${testZoneName}"`);
      console.log('✅ Zone deletion command sent (test zone)');
      console.log('📝 Delete response:', deleteResult);
    } catch (error) {
      console.error('❌ Zone deletion command failed:', error.message);
    }

    console.log('\n✅ RCON connection test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testRconConnection(); 