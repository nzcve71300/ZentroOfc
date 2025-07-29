const pool = require('./src/db');

async function forceDatabaseRefresh() {
  try {
    console.log('🔍 Force refreshing database connection...');
    
    // Close and recreate the pool
    await pool.end();
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Recreate the pool
    const { Pool } = require('pg');
    const { db } = require('./src/config');
    const newPool = new Pool(db);
    
    console.log('📋 Database config:', db);
    
    // Test connection
    const result = await newPool.query('SELECT current_database() as db_name, current_user as user');
    console.log('🗄️  Connected to database:', result.rows[0].db_name);
    console.log('👤 Connected as user:', result.rows[0].user);
    
    // Check if players table exists
    const tableExists = await newPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'players'
      ) as exists
    `);
    console.log('📋 Players table exists:', tableExists.rows[0].exists);
    
    if (tableExists.rows[0].exists) {
      // Check columns
      const columns = await newPool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'players' 
        ORDER BY ordinal_position
      `);
      
      console.log('📋 Players table columns:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
      
      // Check specifically for is_active
      const hasIsActive = columns.rows.some(col => col.column_name === 'is_active');
      console.log('🔍 Has is_active column:', hasIsActive);
      
      if (hasIsActive) {
        console.log('✅ is_active column exists! Testing query...');
        
        // Test the exact query that's failing
        const testQuery = await newPool.query(`
          SELECT * FROM players 
          WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = $1)
          AND discord_id = $2
          AND LOWER(ign) != LOWER($3)
          AND is_active = true
        `, [123456789, '987654321', 'test']);
        
        console.log('✅ Test query executed successfully!');
        console.log('📊 Test query returned', testQuery.rows.length, 'rows');
        
      } else {
        console.log('❌ is_active column does NOT exist!');
        
        // Try to add it
        try {
          await newPool.query(`
            ALTER TABLE players 
            ADD COLUMN is_active BOOLEAN DEFAULT true
          `);
          console.log('✅ Added is_active column!');
          
          await newPool.query(`
            UPDATE players SET is_active = true WHERE is_active IS NULL
          `);
          console.log('✅ Updated existing players!');
          
        } catch (addError) {
          console.error('❌ Could not add is_active column:', addError.message);
        }
      }
    }
    
    await newPool.end();
    
  } catch (error) {
    console.error('❌ Database refresh failed:', error.message);
    console.error('Error details:', error);
  }
}

forceDatabaseRefresh();