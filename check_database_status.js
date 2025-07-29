const pool = require('./src/db');

async function checkDatabaseStatus() {
  try {
    console.log('🔍 Checking database status...');
    
    // Check if players table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'players'
      ) as exists
    `);
    console.log('📋 Players table exists:', tableExists.rows[0].exists);
    
    if (tableExists.rows[0].exists) {
      // Check current columns
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'players' 
        ORDER BY ordinal_position
      `);
      
      console.log('📋 Current players table columns:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
      
      // Check if is_active column exists
      const hasIsActive = columns.rows.some(col => col.column_name === 'is_active');
      console.log('🔍 Has is_active column:', hasIsActive);
      
      if (!hasIsActive) {
        console.log('⚠️  Missing is_active column! Adding it now...');
        
        // Add the missing column
        await pool.query(`
          ALTER TABLE players 
          ADD COLUMN is_active BOOLEAN DEFAULT true
        `);
        
        console.log('✅ Added is_active column!');
        
        // Update existing records
        await pool.query(`
          UPDATE players SET is_active = true WHERE is_active IS NULL
        `);
        
        console.log('✅ Updated existing players to be active!');
      }
    }
    
    // Test a simple query
    const playerCount = await pool.query('SELECT COUNT(*) as count FROM players');
    console.log('👥 Total players:', playerCount.rows[0].count);
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

checkDatabaseStatus();