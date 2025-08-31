const pool = require('./src/db');
const crypto = require('crypto');

async function testUniquePlaceholder() {
  try {
    console.log('🔍 Testing unique placeholder Discord ID generation...');
    
    const playerName1 = 'IceCold8123';
    const playerName2 = 'TestPlayer456';
    const serverId = '1756598716651_wmh0kflng';
    const guildId = 609;
    
    // Generate unique placeholders
    const hash1 = crypto.createHash('md5').update(playerName1 + serverId).digest('hex');
    const uniquePlaceholder1 = hash1.substring(0, 18).padStart(18, '0');
    
    const hash2 = crypto.createHash('md5').update(playerName2 + serverId).digest('hex');
    const uniquePlaceholder2 = hash2.substring(0, 18).padStart(18, '0');
    
    console.log(`Player 1: ${playerName1} -> ${uniquePlaceholder1}`);
    console.log(`Player 2: ${playerName2} -> ${uniquePlaceholder2}`);
    console.log(`Are they different? ${uniquePlaceholder1 !== uniquePlaceholder2}`);
    
    // Test insert for first player
    const [result1] = await pool.query(
      'INSERT INTO players (guild_id, server_id, discord_id, ign) VALUES (?, ?, ?, ?)',
      [guildId, serverId, uniquePlaceholder1, playerName1]
    );
    console.log('✅ Insert 1 successful:', result1.insertId);
    
    // Test insert for second player
    const [result2] = await pool.query(
      'INSERT INTO players (guild_id, server_id, discord_id, ign) VALUES (?, ?, ?, ?)',
      [guildId, serverId, uniquePlaceholder2, playerName2]
    );
    console.log('✅ Insert 2 successful:', result2.insertId);
    
    // Clean up
    await pool.query(
      'DELETE FROM players WHERE guild_id = ? AND server_id = ? AND ign IN (?, ?)',
      [guildId, serverId, playerName1, playerName2]
    );
    console.log('🧹 Test records cleaned up');
    
    console.log('✅ Unique placeholder approach works!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testUniquePlaceholder();
