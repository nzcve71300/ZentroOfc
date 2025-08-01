const pool = require('./src/db');

console.log('🔍 Testing category autocomplete...');

async function testCategoryAutocomplete() {
  try {
    // Test 1: Check if we have any servers
    console.log('\n📡 Checking servers...');
    const [servers] = await pool.query('SELECT id, nickname, guild_id FROM rust_servers');
    console.log(`Found ${servers.length} servers:`, servers.map(s => s.nickname));
    
    if (servers.length === 0) {
      console.log('❌ No servers found!');
      return;
    }
    
    // Test 2: Check if we have any categories
    console.log('\n🏷️ Checking categories...');
    const [categories] = await pool.query(`
      SELECT sc.id, sc.name, sc.type, rs.nickname as server_name, rs.guild_id
      FROM shop_categories sc 
      JOIN rust_servers rs ON sc.server_id = rs.id
    `);
    console.log(`Found ${categories.length} categories:`, categories.map(c => `${c.name} (${c.type}) in ${c.server_name}`));
    
    if (categories.length === 0) {
      console.log('❌ No categories found!');
      return;
    }
    
    // Test 3: Test the exact query that addShopItem uses for each category
    console.log('\n🔧 Testing category autocomplete query...');
    
    for (const category of categories) {
      console.log(`\nTesting for category: ${category.name} in server: ${category.server_name}`);
      
      const [result] = await pool.query(
        `SELECT sc.id, sc.name FROM shop_categories sc 
         JOIN rust_servers rs ON sc.server_id = rs.id 
         WHERE rs.guild_id = ? AND rs.nickname = ? 
         AND (sc.type = 'items' OR sc.type = 'both')
         AND sc.name LIKE ? LIMIT 25`,
        [category.guild_id, category.server_name, '%']
      );
      
      console.log(`Query returned ${result.length} categories:`, result.map(r => r.name));
      
      if (result.length > 0) {
        console.log('✅ Category autocomplete should work for this server!');
      } else {
        console.log('❌ Category autocomplete query returned no results for this server');
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing category autocomplete:', error);
  } finally {
    process.exit(0);
  }
}

testCategoryAutocomplete(); 