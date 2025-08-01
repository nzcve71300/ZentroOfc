const pool = require('./src/db');

console.log('🔍 Testing autocomplete after fix...');

async function testAutocomplete() {
  try {
    // Check current server setup
    console.log('\n📡 Current servers:');
    const [servers] = await pool.query('SELECT id, nickname, guild_id FROM rust_servers');
    servers.forEach(server => {
      console.log(`Server: ${server.nickname}, Guild ID: ${server.guild_id}`);
    });
    
    // Test server autocomplete query
    console.log('\n🔧 Testing server autocomplete...');
    const testGuildId = servers[0].guild_id;
    const [serverResults] = await pool.query(
      'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25',
      [testGuildId, '%']
    );
    console.log(`Server autocomplete returned ${serverResults.length} results:`, serverResults.map(r => r.nickname));
    
    // Test category autocomplete query
    console.log('\n🔧 Testing category autocomplete...');
    const testServer = servers[0].nickname;
    const [categoryResults] = await pool.query(
      `SELECT sc.id, sc.name FROM shop_categories sc 
       JOIN rust_servers rs ON sc.server_id = rs.id 
       WHERE rs.guild_id = ? AND rs.nickname = ? 
       AND (sc.type = 'items' OR sc.type = 'both')
       AND sc.name LIKE ? LIMIT 25`,
      [testGuildId, testServer, '%']
    );
    console.log(`Category autocomplete returned ${categoryResults.length} results:`, categoryResults.map(r => r.name));
    
    if (serverResults.length > 0) {
      console.log('✅ Server autocomplete should work!');
    } else {
      console.log('❌ Server autocomplete not working');
    }
    
    if (categoryResults.length > 0) {
      console.log('✅ Category autocomplete should work!');
    } else {
      console.log('❌ Category autocomplete not working');
    }
    
  } catch (error) {
    console.error('❌ Error testing autocomplete:', error);
  } finally {
    process.exit(0);
  }
}

testAutocomplete(); 