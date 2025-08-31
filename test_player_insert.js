const pool = require('./src/db');

async function testPlayerInsert() {
  try {
    console.log('🔍 Testing player insert with explicit NULL...');
    
    // Test the exact values from the error
    const testValues = [609, '1756598716651_wmh0kflng', 'coldseasurfer'];
    console.log('Test values:', testValues);
    
    // Check if the server_id exists
    const [serverCheck] = await pool.query(
      'SELECT id, nickname FROM rust_servers WHERE id = ?',
      ['1756598716651_wmh0kflng']
    );
    console.log('Server check result:', serverCheck);
    
    // Check if guild_id exists
    const [guildCheck] = await pool.query(
      'SELECT id, discord_id FROM guilds WHERE id = ?',
      [609]
    );
    console.log('Guild check result:', guildCheck);
    
    // Try the insert with explicit NULL in SQL
    const [result] = await pool.query(
      'INSERT INTO players (guild_id, server_id, discord_id, ign) VALUES (?, ?, NULL, ?)',
      [609, '1756598716651_wmh0kflng', 'coldseasurfer']
    );
    
    console.log('✅ Insert successful:', result);
    
    // Clean up the test record
    await pool.query(
      'DELETE FROM players WHERE guild_id = ? AND server_id = ? AND ign = ?',
      [609, '1756598716651_wmh0kflng', 'coldseasurfer']
    );
    console.log('🧹 Test record cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testPlayerInsert();
