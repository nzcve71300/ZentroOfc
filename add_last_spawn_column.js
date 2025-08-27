const pool = require('./src/db');

async function addLastSpawnColumn() {
  try {
    console.log('🔧 Adding last_spawn column to crate_event_configs table...');
    console.log('========================================================\n');

    // Add last_spawn column
    console.log('1. Adding last_spawn column...');
    await pool.query(`
      ALTER TABLE crate_event_configs 
      ADD COLUMN last_spawn TIMESTAMP NULL DEFAULT NULL
    `);

    console.log('✅ last_spawn column added successfully!');
    console.log('📝 Column details:');
    console.log('   - last_spawn: TIMESTAMP NULL DEFAULT NULL');
    console.log('   - Purpose: Track when the crate was last spawned');
    console.log('   - Used by: /trigger-event command to reset timers');

    console.log('\n🎯 Ready for manual crate triggering!');
    console.log('Use the following command:');
    console.log('   /trigger-event CRATE-1 <server>');

  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ last_spawn column already exists - skipping...');
    } else {
      console.error('❌ Error adding last_spawn column:', error);
    }
  } finally {
    await pool.end();
  }
}

// Run the column addition
addLastSpawnColumn();
