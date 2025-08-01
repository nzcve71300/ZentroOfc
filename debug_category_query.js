const pool = require('./src/db');

console.log('🔍 Debugging category autocomplete query...');

async function debugCategoryQuery() {
  try {
    // Get the category details
    console.log('\n📋 Getting category details...');
    const [categoryDetails] = await pool.query(`
      SELECT sc.id, sc.name, sc.type, rs.nickname as server_name, rs.guild_id, rs.id as server_id
      FROM shop_categories sc 
      JOIN rust_servers rs ON sc.server_id = rs.id
    `);
    
    if (categoryDetails.length === 0) {
      console.log('❌ No categories found!');
      return;
    }
    
    const category = categoryDetails[0];
    console.log('Category details:', category);
    
    // Test each part of the query separately
    console.log('\n🔧 Testing query parts...');
    
    // Test 1: Check if server exists with this guild_id
    console.log('\n1. Testing server lookup...');
    const [serverTest] = await pool.query(
      'SELECT id, nickname, guild_id FROM rust_servers WHERE guild_id = ? AND nickname = ?',
      [category.guild_id, category.server_name]
    );
    console.log('Server lookup result:', serverTest);
    
    // Test 2: Check if category exists for this server
    console.log('\n2. Testing category lookup...');
    const [categoryTest] = await pool.query(
      'SELECT id, name, type FROM shop_categories WHERE server_id = ?',
      [category.server_id]
    );
    console.log('Category lookup result:', categoryTest);
    
    // Test 3: Test the full query with exact values
    console.log('\n3. Testing full query...');
    const [fullQueryTest] = await pool.query(
      `SELECT sc.id, sc.name FROM shop_categories sc 
       JOIN rust_servers rs ON sc.server_id = rs.id 
       WHERE rs.guild_id = ? AND rs.nickname = ? 
       AND (sc.type = 'items' OR sc.type = 'both')
       AND sc.name LIKE ? LIMIT 25`,
      [category.guild_id, category.server_name, '%']
    );
    console.log('Full query result:', fullQueryTest);
    
    // Test 4: Test without the type filter
    console.log('\n4. Testing without type filter...');
    const [noTypeFilter] = await pool.query(
      `SELECT sc.id, sc.name FROM shop_categories sc 
       JOIN rust_servers rs ON sc.server_id = rs.id 
       WHERE rs.guild_id = ? AND rs.nickname = ? 
       AND sc.name LIKE ? LIMIT 25`,
      [category.guild_id, category.server_name, '%']
    );
    console.log('No type filter result:', noTypeFilter);
    
    // Test 5: Test with just the server lookup
    console.log('\n5. Testing just server lookup...');
    const [justServer] = await pool.query(
      `SELECT sc.id, sc.name FROM shop_categories sc 
       JOIN rust_servers rs ON sc.server_id = rs.id 
       WHERE rs.nickname = ? 
       AND sc.name LIKE ? LIMIT 25`,
      [category.server_name, '%']
    );
    console.log('Just server lookup result:', justServer);
    
  } catch (error) {
    console.error('❌ Error debugging category query:', error);
  } finally {
    process.exit(0);
  }
}

debugCategoryQuery(); 