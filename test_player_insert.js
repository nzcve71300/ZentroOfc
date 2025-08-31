const pool = require('./src/db');

async function testPlayerInsert() {
  try {
    console.log('🔍 Testing player insert with placeholder Discord ID...');
    
    // Test with placeholder Discord ID '0'
    const [result] = await pool.query(
      'INSERT INTO players (guild_id, server_id, discord_id, ign) VALUES (?, ?, ?, ?)',
      [609, '1756598716651_wmh0kflng', '0', 'testplayer_placeholder']
    );
    console.log('✅ Insert with placeholder Discord ID successful:', result);
    
    // Clean up
    await pool.query(
      'DELETE FROM players WHERE guild_id = ? AND server_id = ? AND ign = ?',
      [609, '1756598716651_wmh0kflng', 'testplayer_placeholder']
    );
    console.log('🧹 Test record cleaned up');
    
    console.log('✅ Placeholder approach works!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testPlayerInsert();
