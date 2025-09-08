const pool = require('./src/db');

async function fixHomeTeleportConfigsEnabledColumn() {
  try {
    console.log('🔧 Fixing home_teleport_configs table - adding missing enabled column...');
    
    // Check if home_teleport_configs table exists
    const [tables] = await pool.query("SHOW TABLES LIKE 'home_teleport_configs'");
    if (tables.length === 0) {
      console.log('❌ home_teleport_configs table does not exist');
      return;
    }
    
    console.log('✅ home_teleport_configs table exists');
    
    // Check current table structure
    const [currentColumns] = await pool.query("SHOW COLUMNS FROM home_teleport_configs");
    console.log('\n📋 Current home_teleport_configs table structure:');
    currentColumns.forEach(col => {
      console.log(`   - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    // Check if enabled column already exists
    const [enabledColumn] = await pool.query("SHOW COLUMNS FROM home_teleport_configs LIKE 'enabled'");
    if (enabledColumn.length > 0) {
      console.log('\n✅ enabled column already exists in home_teleport_configs table');
      return;
    }
    
    console.log('\n❌ enabled column missing from home_teleport_configs table');
    console.log('🔧 Adding enabled column...');
    
    // Add enabled column to home_teleport_configs table
    await pool.query('ALTER TABLE home_teleport_configs ADD COLUMN enabled BOOLEAN DEFAULT TRUE');
    console.log('✅ Added enabled column to home_teleport_configs table');
    
    // Update existing records to be enabled by default
    await pool.query('UPDATE home_teleport_configs SET enabled = TRUE WHERE enabled IS NULL');
    console.log('✅ Updated existing records to be enabled by default');
    
    // Verify the fix
    const [verifyColumns] = await pool.query("SHOW COLUMNS FROM home_teleport_configs");
    console.log('\n📋 Updated home_teleport_configs table structure:');
    verifyColumns.forEach(col => {
      console.log(`   - ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });
    
    // Check existing records
    const [records] = await pool.query('SELECT server_id, enabled, use_list, cooldown_minutes FROM home_teleport_configs LIMIT 5');
    console.log('\n📋 Sample records:');
    records.forEach(record => {
      console.log(`   Server: ${record.server_id} | Enabled: ${record.enabled} | Use List: ${record.use_list} | Cooldown: ${record.cooldown_minutes}min`);
    });
    
    console.log('\n🎉 home_teleport_configs table fix completed successfully!');
    console.log('✅ The /set HOMETP-USE command should now work without the "Unknown column enabled" error');
    
  } catch (error) {
    console.error('❌ Error fixing home_teleport_configs table:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixHomeTeleportConfigsEnabledColumn();
