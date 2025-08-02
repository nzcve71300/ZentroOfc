const pool = require('./src/db');

async function checkZorpDatabase() {
  try {
    console.log('🧪 Checking Zorp Database in SSH...\n');

    // Get all servers and their zones
    const [servers] = await pool.query(
      'SELECT id, nickname FROM rust_servers'
    );

    console.log(`📡 Found ${servers.length} servers:`);
    
    for (const server of servers) {
      console.log(`\n🔍 Server: ${server.nickname} (ID: ${server.id})`);
      
      const [zones] = await pool.query(
        'SELECT name, owner, created_at FROM zorp_zones WHERE server_id = ?',
        [server.id]
      );
      
      console.log(`   📋 Found ${zones.length} zones in database:`);
      zones.forEach(zone => {
        console.log(`      - ${zone.name} (Owner: ${zone.owner}, Created: ${zone.created_at})`);
      });
      
      if (zones.length === 0) {
        console.log(`   ❌ No zones found for this server`);
      }
    }

    console.log('\n✅ Database check completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

checkZorpDatabase(); 