const pool = require('./src/db');

console.log('🔍 Debugging category autocomplete...');

async function debugCategories() {
  try {
    // Check all categories
    console.log('\n📋 All categories:');
    const [categories] = await pool.query('SELECT * FROM shop_categories');
    categories.forEach(cat => {
      console.log(`Category: ${cat.name}, Server ID: ${cat.server_id}, Type: ${cat.type}`);
    });
    
    // Check servers
    console.log('\n📡 All servers:');
    const [servers] = await pool.query('SELECT * FROM rust_servers');
    servers.forEach(server => {
      console.log(`Server: ${server.nickname}, ID: ${server.id}, Guild ID: ${server.guild_id}`);
    });
    
    // Test the specific query that's failing
    console.log('\n🔧 Testing category query for Rise 3x...');
    const [testResults] = await pool.query(
      `SELECT sc.id, sc.name FROM shop_categories sc 
       JOIN rust_servers rs ON sc.server_id = rs.id 
       WHERE rs.guild_id = ? AND rs.nickname = ? 
       AND (sc.type = 'items' OR sc.type = 'both')
       AND sc.name LIKE ? LIMIT 25`,
      [176, 'Rise 3x', '%']
    );
    console.log(`Query returned ${testResults.length} results:`, testResults);
    
    // Test without the type filter
    console.log('\n🔧 Testing without type filter...');
    const [testResults2] = await pool.query(
      `SELECT sc.id, sc.name FROM shop_categories sc 
       JOIN rust_servers rs ON sc.server_id = rs.id 
       WHERE rs.guild_id = ? AND rs.nickname = ? 
       AND sc.name LIKE ? LIMIT 25`,
      [176, 'Rise 3x', '%']
    );
    console.log(`Query without type filter returned ${testResults2.length} results:`, testResults2);
    
    // Test just the server lookup
    console.log('\n🔧 Testing just server lookup...');
    const [serverLookup] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = ? AND nickname = ?',
      [176, 'Rise 3x']
    );
    console.log(`Server lookup returned:`, serverLookup);
    
    if (serverLookup.length > 0) {
      const serverId = serverLookup[0].id;
      console.log(`\n🔧 Testing categories for server ID: ${serverId}`);
      const [categoriesForServer] = await pool.query(
        'SELECT * FROM shop_categories WHERE server_id = ?',
        [serverId]
      );
      console.log(`Categories for server ${serverId}:`, categoriesForServer);
    }
    
  } catch (error) {
    console.error('❌ Error debugging categories:', error);
  } finally {
    process.exit(0);
  }
}

debugCategories(); 