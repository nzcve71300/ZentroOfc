const pool = require('./src/db');

async function testPlayerInsert() {
  try {
    console.log('🔍 Testing player insert with valid Discord ID...');
    
    // Test with a valid Discord ID first
    const [result1] = await pool.query(
      'INSERT INTO players (guild_id, server_id, discord_id, ign) VALUES (?, ?, ?, ?)',
      [609, '1756598716651_wmh0kflng', '123456789012345678', 'testplayer1']
    );
    console.log('✅ Insert with valid Discord ID successful:', result1);
    
    // Clean up
    await pool.query(
      'DELETE FROM players WHERE guild_id = ? AND server_id = ? AND ign = ?',
      [609, '1756598716651_wmh0kflng', 'testplayer1']
    );
    console.log('🧹 Test record 1 cleaned up');
    
    // Now try with NULL
    console.log('🔍 Testing player insert with explicit NULL...');
    const [result2] = await pool.query(
      'INSERT INTO players (guild_id, server_id, discord_id, ign) VALUES (?, ?, NULL, ?)',
      [609, '1756598716651_wmh0kflng', 'testplayer2']
    );
    console.log('✅ Insert with NULL successful:', result2);
    
    // Clean up
    await pool.query(
      'DELETE FROM players WHERE guild_id = ? AND server_id = ? AND ign = ?',
      [609, '1756598716651_wmh0kflng', 'testplayer2']
    );
    console.log('🧹 Test record 2 cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testPlayerInsert();
