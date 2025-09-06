#!/usr/bin/env node

const mysql = require('mysql2/promise');
const pool = require('./src/db');

async function fixZorpRconLogTable() {
  console.log('🔧 Fixing zorp_rcon_log table structure...\n');
  
  try {
    // Check if table exists
    const [tables] = await pool.query(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'zorp_rcon_log'
    `);
    
    if (tables.length === 0) {
      console.log('📋 Creating zorp_rcon_log table...');
      
      await pool.query(`
        CREATE TABLE zorp_rcon_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          server_id VARCHAR(32) NOT NULL,
          zone_id INT NULL,
          zone_name VARCHAR(255) NOT NULL,
          command TEXT NOT NULL,
          success BOOLEAN NOT NULL,
          response TEXT,
          attempt INT DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_server_zone (server_id, zone_name),
          INDEX idx_zone_id (zone_id),
          INDEX idx_created_at (created_at)
        )
      `);
      
      console.log('✅ Created zorp_rcon_log table');
    } else {
      console.log('📋 Table exists, checking structure...');
      
      // Check if zone_id column exists
      const [columns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'zorp_rcon_log' 
        AND COLUMN_NAME = 'zone_id'
      `);
      
      if (columns.length === 0) {
        console.log('📋 Adding missing zone_id column...');
        
        await pool.query(`
          ALTER TABLE zorp_rcon_log 
          ADD COLUMN zone_id INT NULL,
          ADD COLUMN attempt INT DEFAULT 1,
          ADD INDEX idx_zone_id (zone_id)
        `);
        
        console.log('✅ Added zone_id and attempt columns');
      } else {
        console.log('✅ zone_id column already exists');
      }
      
      // Check if attempt column exists
      const [attemptColumns] = await pool.query(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'zorp_rcon_log' 
        AND COLUMN_NAME = 'attempt'
      `);
      
      if (attemptColumns.length === 0) {
        console.log('📋 Adding missing attempt column...');
        
        await pool.query(`
          ALTER TABLE zorp_rcon_log 
          ADD COLUMN attempt INT DEFAULT 1
        `);
        
        console.log('✅ Added attempt column');
      } else {
        console.log('✅ attempt column already exists');
      }
    }
    
    console.log('\n🎉 zorp_rcon_log table structure is now correct!');
    console.log('\n📋 Table structure:');
    console.log('   - id (AUTO_INCREMENT PRIMARY KEY)');
    console.log('   - server_id (VARCHAR(32))');
    console.log('   - zone_id (INT NULL)');
    console.log('   - zone_name (VARCHAR(255))');
    console.log('   - command (TEXT)');
    console.log('   - success (BOOLEAN)');
    console.log('   - response (TEXT)');
    console.log('   - attempt (INT DEFAULT 1)');
    console.log('   - created_at (TIMESTAMP)');
    
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  Columns already exist, table is ready');
    } else {
      console.error('❌ Error fixing table:', error);
      process.exit(1);
    }
  }
}

// Run the fix
fixZorpRconLogTable().then(() => {
  console.log('\n✅ Database fix completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Database fix failed:', error);
  process.exit(1);
});
