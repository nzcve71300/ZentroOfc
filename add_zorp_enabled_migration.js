const pool = require('./src/db');
const fs = require('fs');

async function addZorpEnabledColumn() {
  try {
    console.log('🔧 Adding enabled column to zorp_defaults table...');
    
    // Check if zorp_defaults table exists
    const [tables] = await pool.query("SHOW TABLES LIKE 'zorp_defaults'");
    if (tables.length === 0) {
      console.log('❌ zorp_defaults table does not exist');
      return;
    }
    
    console.log('✅ zorp_defaults table exists');
    
    // Check if enabled column already exists
    const [columns] = await pool.query("SHOW COLUMNS FROM zorp_defaults LIKE 'enabled'");
    if (columns.length > 0) {
      console.log('✅ enabled column already exists');
      return;
    }
    
    // Add enabled column
    await pool.query('ALTER TABLE zorp_defaults ADD COLUMN enabled BOOLEAN DEFAULT TRUE');
    console.log('✅ Added enabled column to zorp_defaults table');
    
    // Update existing records
    await pool.query('UPDATE zorp_defaults SET enabled = TRUE WHERE enabled IS NULL');
    console.log('✅ Updated existing records to be enabled by default');
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
  } finally {
    await pool.end();
  }
}

addZorpEnabledColumn(); 