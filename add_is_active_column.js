const pool = require('./src/db');

async function addIsActiveColumn() {
  try {
    console.log('🔧 Adding is_active column to players table...');
    
    // Add the is_active column
    await pool.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true
    `);
    
    console.log('✅ Added is_active column!');
    
    // Update existing players to be active
    await pool.query(`
      UPDATE players SET is_active = true WHERE is_active IS NULL
    `);
    
    console.log('✅ Updated existing players to be active!');
    
    // Verify the column exists
    const columnCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'players' AND column_name = 'is_active'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✅ is_active column exists in database');
      
      // Test the exact query that's failing
      const testQuery = await pool.query(`
        SELECT * FROM players 
        WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1)
        AND discord_id = $2
        AND LOWER(ign) != LOWER($3)
        AND is_active = true
      `, [123456789, '987654321', 'test']);
      
      console.log('✅ Test query executed successfully!');
      console.log('📊 Test query returned', testQuery.rows.length, 'rows');
      
    } else {
      console.log('❌ is_active column still does not exist');
    }
    
  } catch (error) {
    console.error('❌ Failed to add is_active column:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

addIsActiveColumn();