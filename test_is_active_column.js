const pool = require('./src/db');

async function testIsActiveColumn() {
  try {
    console.log('🔍 Testing is_active column...');
    
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
      
      // Check what guilds exist
      const guilds = await pool.query('SELECT id, discord_id FROM guilds LIMIT 5');
      console.log('📋 Available guilds:', guilds.rows);
      
      // Check what players exist
      const players = await pool.query('SELECT id, guild_id, discord_id, ign, is_active FROM players LIMIT 5');
      console.log('📋 Sample players:', players.rows);
      
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

testIsActiveColumn();