const pool = require('./src/db');

async function testFinalFix() {
  try {
    console.log('🔍 Testing final fix...');
    
    // Check if the column exists
    const columnCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'players' AND column_name = 'is_active'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✅ is_active column exists:', columnCheck.rows[0]);
      
      // Test the exact query that's failing in the bot
      console.log('📋 Testing the exact query that fails...');
      
      const testQuery = await pool.query(`
        SELECT * FROM players 
        WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1)
        AND discord_id = $2
        AND LOWER(ign) != LOWER($3)
        AND is_active = true
      `, [123456789, '987654321', 'test']);
      
      console.log('✅ Query executed successfully!');
      console.log('📊 Result rows:', testQuery.rows.length);
      
      // Test with real data
      const realData = await pool.query('SELECT id, guild_id, discord_id, ign, is_active FROM players LIMIT 3');
      console.log('📋 Real data with is_active:', realData.rows);
      
      // Test a simpler query
      const simpleQuery = await pool.query('SELECT COUNT(*) as count FROM players WHERE is_active = true');
      console.log('📊 Players with is_active = true:', simpleQuery.rows[0].count);
      
    } else {
      console.log('❌ is_active column does not exist');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

testFinalFix();