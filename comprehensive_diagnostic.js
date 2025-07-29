const pool = require('./src/db');

async function comprehensiveDiagnostic() {
  try {
    console.log('🔍 Comprehensive Database Diagnostic...');
    
    // Check connection details
    const connectionInfo = await pool.query('SELECT current_database() as db_name, current_user as user, current_schema() as schema');
    console.log('📋 Connection Info:', connectionInfo.rows[0]);
    
    // Check all schemas
    const schemas = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      ORDER BY schema_name
    `);
    console.log('📋 Available schemas:', schemas.rows.map(s => s.schema_name));
    
    // Check if players table exists in any schema
    const playersTables = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name = 'players'
      ORDER BY table_schema
    `);
    console.log('📋 Players tables found:', playersTables.rows);
    
    // Check current schema's players table
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'players'
      ) as exists
    `);
    console.log('📋 Players table exists in current schema:', tableExists.rows[0].exists);
    
    if (tableExists.rows[0].exists) {
      // Check all columns in players table
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'players' 
        ORDER BY ordinal_position
      `);
      
      console.log('📋 Players table columns:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
      
      // Check specifically for is_active
      const hasIsActive = columns.rows.some(col => col.column_name === 'is_active');
      console.log('🔍 Has is_active column:', hasIsActive);
      
      if (!hasIsActive) {
        console.log('⚠️  is_active column missing! Trying to add it...');
        
        try {
          await pool.query(`
            ALTER TABLE players 
            ADD COLUMN is_active BOOLEAN DEFAULT true
          `);
          console.log('✅ Added is_active column!');
          
          await pool.query(`
            UPDATE players SET is_active = true WHERE is_active IS NULL
          `);
          console.log('✅ Updated existing players!');
          
        } catch (addError) {
          console.error('❌ Could not add is_active column:', addError.message);
          console.error('Error code:', addError.code);
        }
      }
      
      // Check sample data
      const sampleData = await pool.query('SELECT * FROM players LIMIT 3');
      console.log('📋 Sample players data:', sampleData.rows);
      
    } else {
      console.log('❌ Players table does not exist in current schema');
    }
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

comprehensiveDiagnostic();