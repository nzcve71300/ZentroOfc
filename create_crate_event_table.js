const pool = require('./src/db');

async function createCrateEventTable() {
  try {
    console.log('🔧 Creating Crate Event Configuration Table...');
    console.log('=============================================\n');
    
    // Create crate_event_configs table
    console.log('1. Creating crate_event_configs table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crate_event_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        crate_type VARCHAR(50) NOT NULL,
        enabled BOOLEAN DEFAULT FALSE,
        spawn_interval_minutes INT DEFAULT 60,
        spawn_amount INT DEFAULT 1,
        spawn_message TEXT DEFAULT '<b><size=45><color=#00FF00>CRATE EVENT SPAWNED</color></size></b>',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_server_crate (server_id, crate_type)
      )
    `);
    
    console.log('✅ Crate event configuration table created successfully!');
    console.log('📝 Table structure:');
    console.log('   - server_id: Server identifier');
    console.log('   - crate_type: Type of crate (crate-1, crate-2, crate-3, crate-4)');
    console.log('   - enabled: Whether crate spawning is enabled');
    console.log('   - spawn_interval_minutes: Time between spawns in minutes');
    console.log('   - spawn_amount: Number of crates to spawn (1-2)');
    console.log('   - spawn_message: Custom message to display when crate spawns');
    console.log('   - created_at/updated_at: Timestamps');
    
    console.log('\n🎯 Ready for crate event configuration!');
    console.log('Use the following commands:');
    console.log('   /set CRATE-1-ON on <server>');
    console.log('   /set CRATE-1-TIME 30 <server>');
    console.log('   /set CRATE-1-AMOUNT 2 <server>');
    console.log('   /set CRATE-1-MSG "Custom message" <server>');
    
  } catch (error) {
    console.error('❌ Error creating crate event table:', error);
  } finally {
    await pool.end();
  }
}

// Run the table creation
createCrateEventTable();
