const pool = require('./src/db');

async function fixCrateTimerSystem() {
  try {
    console.log('🔧 Fixing Crate Timer System');
    console.log('============================\n');
    
    // Check if last_spawn column exists
    console.log('1. Checking if last_spawn column exists...');
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'crate_event_configs' 
      AND COLUMN_NAME = 'last_spawn'
    `);
    
    if (columns.length === 0) {
      console.log('❌ last_spawn column is missing! Adding it...');
      
      // Add the missing last_spawn column
      await pool.query(`
        ALTER TABLE crate_event_configs 
        ADD COLUMN last_spawn TIMESTAMP NULL DEFAULT NULL
      `);
      
      console.log('✅ last_spawn column added successfully!');
    } else {
      console.log('✅ last_spawn column already exists');
    }
    
    // Check if position_coordinates table exists for crate events
    console.log('\n2. Checking position_coordinates table...');
    const [tables] = await pool.query(`
      SHOW TABLES LIKE 'position_coordinates'
    `);
    
    if (tables.length === 0) {
      console.log('❌ position_coordinates table is missing! Creating it...');
      
      // Create the position_coordinates table
      await pool.query(`
        CREATE TABLE position_coordinates (
          id INT AUTO_INCREMENT PRIMARY KEY,
          server_id VARCHAR(32) NOT NULL,
          position_type VARCHAR(100) NOT NULL,
          x_pos FLOAT NOT NULL,
          y_pos FLOAT NOT NULL,
          z_pos FLOAT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_server_position (server_id, position_type)
        )
      `);
      
      console.log('✅ position_coordinates table created successfully!');
    } else {
      console.log('✅ position_coordinates table already exists');
    }
    
    // Check current crate event configurations
    console.log('\n3. Checking current crate event configurations...');
    const [crateConfigs] = await pool.query(`
      SELECT 
        rs.nickname,
        cec.crate_type,
        cec.enabled,
        cec.spawn_interval_minutes,
        cec.spawn_amount,
        cec.last_spawn
      FROM crate_event_configs cec
      JOIN rust_servers rs ON cec.server_id = rs.id
      ORDER BY rs.nickname, cec.crate_type
    `);
    
    if (crateConfigs.length === 0) {
      console.log('⚠️ No crate event configurations found');
      console.log('   Use /set commands to configure crate events:');
      console.log('   /set CRATE-1 on <server>');
      console.log('   /set CRATE-1-TIME 30 <server>');
      console.log('   /set CRATE-1-AMOUNT 2 <server>');
      console.log('   /set CRATE-1-MSG "Custom message" <server>');
    } else {
      console.log(`📊 Found ${crateConfigs.length} crate event configurations:`);
      crateConfigs.forEach(config => {
        const status = config.enabled ? '✅ ENABLED' : '❌ DISABLED';
        const lastSpawn = config.last_spawn ? new Date(config.last_spawn).toLocaleString() : 'Never';
        console.log(`   ${config.nickname} - ${config.crate_type}: ${status}`);
        console.log(`     Interval: ${config.spawn_interval_minutes} minutes`);
        console.log(`     Amount: ${config.spawn_amount} crates`);
        console.log(`     Last spawn: ${lastSpawn}`);
      });
    }
    
    // Check if positions are set for crate events
    console.log('\n4. Checking crate event positions...');
    const [positions] = await pool.query(`
      SELECT 
        rs.nickname,
        pc.position_type,
        pc.x_pos,
        pc.y_pos,
        pc.z_pos
      FROM position_coordinates pc
      JOIN rust_servers rs ON pc.server_id = rs.id
      WHERE pc.position_type LIKE 'crate-event-%'
      ORDER BY rs.nickname, pc.position_type
    `);
    
    if (positions.length === 0) {
      console.log('⚠️ No crate event positions found');
      console.log('   Use /manage-positions to set crate event positions:');
      console.log('   /manage-positions <server>');
      console.log('   Then select Crate-1, Crate-2, Crate-3, or Crate-4 and set coordinates');
    } else {
      console.log(`📍 Found ${positions.length} crate event positions:`);
      positions.forEach(pos => {
        console.log(`   ${pos.nickname} - ${pos.position_type}: ${pos.x_pos}, ${pos.y_pos}, ${pos.z_pos}`);
      });
    }
    
    console.log('\n✅ Crate timer system fix completed!');
    console.log('\n📋 Summary:');
    console.log('   - Timer system checks every 30 seconds');
    console.log('   - Crates spawn automatically when enabled and timer expires');
    console.log('   - Requires both configuration (/set commands) and positions (/manage-positions)');
    console.log('   - Manual spawning available with /trigger-event command');
    
  } catch (error) {
    console.error('❌ Error fixing crate timer system:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixCrateTimerSystem();
