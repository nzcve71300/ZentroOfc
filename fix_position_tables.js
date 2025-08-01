const pool = require('./src/db');

async function fixPositionTables() {
  try {
    console.log('🔧 Fixing Position Tables...');
    
    // Drop existing tables if they exist
    console.log('1. Dropping existing position tables...');
    await pool.query('DROP TABLE IF EXISTS position_coordinates');
    await pool.query('DROP TABLE IF EXISTS position_configs');
    
    // Create position_coordinates table with correct structure
    console.log('2. Creating position_coordinates table...');
    await pool.query(`
      CREATE TABLE position_coordinates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        position_type VARCHAR(50) NOT NULL,
        x_pos DECIMAL(10,2) NOT NULL,
        y_pos DECIMAL(10,2) NOT NULL,
        z_pos DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_server_position (server_id, position_type)
      )
    `);
    
    // Create position_configs table with correct structure
    console.log('3. Creating position_configs table...');
    await pool.query(`
      CREATE TABLE position_configs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        server_id VARCHAR(32) NOT NULL,
        position_type VARCHAR(50) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        delay_seconds INT DEFAULT 0,
        cooldown_minutes INT DEFAULT 5,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_server_position (server_id, position_type)
      )
    `);
    
    console.log('✅ Position tables fixed successfully!');
    console.log('📝 Tables created:');
    console.log('   - position_coordinates (server_id as VARCHAR)');
    console.log('   - position_configs (server_id as VARCHAR)');
    
  } catch (error) {
    console.error('❌ Error fixing position tables:', error);
  } finally {
    await pool.end();
  }
}

fixPositionTables(); 