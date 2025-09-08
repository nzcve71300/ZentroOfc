const pool = require('./src/db');

async function fixZorpConfigsEnabledColumn() {
  try {
    console.log('🔧 Fixing ZORP configs table - adding missing enabled column...');
    
    // Check if zorp_configs table exists
    const [tables] = await pool.query("SHOW TABLES LIKE 'zorp_configs'");
    if (tables.length === 0) {
      console.log('❌ zorp_configs table does not exist');
      return;
    }
    
    console.log('✅ zorp_configs table exists');
    
    // Check if enabled column already exists
    const [columns] = await pool.query("SHOW COLUMNS FROM zorp_configs LIKE 'enabled'");
    if (columns.length > 0) {
      console.log('✅ enabled column already exists in zorp_configs table');
      return;
    }
    
    console.log('❌ enabled column missing from zorp_configs table');
    console.log('🔧 Adding enabled column...');
    
    // Add enabled column to zorp_configs table
    await pool.query('ALTER TABLE zorp_configs ADD COLUMN enabled BOOLEAN DEFAULT TRUE');
    console.log('✅ Added enabled column to zorp_configs table');
    
    // Update existing records to be enabled by default
    await pool.query('UPDATE zorp_configs SET enabled = TRUE WHERE enabled IS NULL');
    console.log('✅ Updated existing records to be enabled by default');
    
    // Verify the fix
    const [verifyColumns] = await pool.query("SHOW COLUMNS FROM zorp_configs");
    console.log('\n📋 Current zorp_configs table structure:');
    verifyColumns.forEach(col => {
      console.log(`   - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    // Check existing records
    const [records] = await pool.query('SELECT server_id, enabled, use_list FROM zorp_configs LIMIT 5');
    console.log('\n📋 Sample records:');
    records.forEach(record => {
      console.log(`   Server: ${record.server_id} | Enabled: ${record.enabled} | Use List: ${record.use_list}`);
    });
    
    console.log('\n🎉 ZORP configs table fix completed successfully!');
    console.log('✅ The /set command should now work without the "Unknown column enabled" error');
    
  } catch (error) {
    console.error('❌ Error fixing zorp_configs table:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixZorpConfigsEnabledColumn();
