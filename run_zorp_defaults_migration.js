const fs = require('fs');
const pool = require('./src/db');

async function runMigration() {
  try {
    console.log('🔄 Running ZORP defaults table migration...');
    
    // Read the migration SQL
    const migrationSQL = fs.readFileSync('./add_zorp_defaults_table.sql', 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ ZORP defaults table migration completed successfully!');
    
    // Verify the table was created
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'zorp_defaults'
      );
    `);
    
    if (result.rows[0].exists) {
      console.log('✅ Zorp defaults table verified successfully!');
    } else {
      console.log('❌ Zorp defaults table not found after migration');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration(); 