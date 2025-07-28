const fs = require('fs');
const pool = require('./src/db');

async function runMigration() {
  try {
    console.log('Running ZORP zones table migration...');
    
    // Read the migration SQL
    const migrationSQL = fs.readFileSync('./add_zones_table.sql', 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ ZORP zones table migration completed successfully!');
    
    // Verify the table was created
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'zones'
      );
    `);
    
    if (result.rows[0].exists) {
      console.log('✅ Zones table verified successfully!');
    } else {
      console.log('❌ Zones table not found after migration');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration(); 