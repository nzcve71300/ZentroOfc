const pool = require('./src/db');

console.log('🔧 Fixing EMPEROR 3X server guild_id...');

async function fixEmperorServer() {
  try {
    // Get the correct guild_id from the guilds table
    console.log('\n📋 Getting correct guild_id...');
    const [guilds] = await pool.query('SELECT id, discord_id FROM guilds');
    console.log('Available guilds:', guilds);
    
    // Use the first available guild_id (or you can specify which one)
    const correctGuildId = guilds[0].id;
    console.log(`Using guild_id: ${correctGuildId} (Discord ID: ${guilds[0].discord_id})`);
    
    // Update the EMPEROR 3X server to use the correct guild_id
    console.log('\n🔧 Updating EMPEROR 3X server...');
    const [updateResult] = await pool.query(
      'UPDATE rust_servers SET guild_id = ? WHERE nickname = ?',
      [correctGuildId, 'EMPEROR 3X']
    );
    
    console.log(`Updated ${updateResult.affectedRows} server(s)`);
    
    // Verify the update
    console.log('\n✅ Verifying update...');
    const [verifyResult] = await pool.query(
      'SELECT id, nickname, guild_id FROM rust_servers WHERE nickname = ?',
      ['EMPEROR 3X']
    );
    console.log('Updated server:', verifyResult[0]);
    
    // Test the category autocomplete query again
    console.log('\n🔧 Testing category autocomplete query...');
    const [categoryTest] = await pool.query(
      `SELECT sc.id, sc.name FROM shop_categories sc 
       JOIN rust_servers rs ON sc.server_id = rs.id 
       WHERE rs.guild_id = ? AND rs.nickname = ? 
       AND (sc.type = 'items' OR sc.type = 'both')
       AND sc.name LIKE ? LIMIT 25`,
      [correctGuildId, 'EMPEROR 3X', '%']
    );
    
    console.log(`Category query returned ${categoryTest.length} results:`, categoryTest);
    
    if (categoryTest.length > 0) {
      console.log('✅ Category autocomplete should now work!');
    } else {
      console.log('❌ Category autocomplete still not working');
    }
    
  } catch (error) {
    console.error('❌ Error fixing EMPEROR server:', error);
  } finally {
    process.exit(0);
  }
}

fixEmperorServer(); 