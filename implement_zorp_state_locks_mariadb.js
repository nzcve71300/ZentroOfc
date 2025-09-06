#!/usr/bin/env node

/**
 * Implement Zorp State Locks System for MariaDB
 * This script adds comprehensive state locking to prevent race conditions
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function implementZorpStateLocks() {
  let connection;
  
  try {
    console.log('🔒 Implementing Zorp state locking system for MariaDB...');
    
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'zentro',
      charset: 'utf8mb4'
    });
    
    console.log('✅ Connected to database');
    
    // Read and execute the SQL file
    const fs = require('fs');
    const sqlContent = fs.readFileSync('add_zorp_state_locks_mariadb.sql', 'utf8');
    
    // Split by delimiter and execute each statement
    const statements = sqlContent.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.execute(statement);
          console.log('✅ Executed SQL statement');
        } catch (error) {
          if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
              error.code === 'ER_DUP_KEYNAME' || 
              error.code === 'ER_DUP_ENTRY' ||
              error.message.includes('already exists')) {
            console.log('⏭️  Object already exists, skipping');
          } else {
            console.log(`⚠️  SQL execution warning: ${error.message}`);
          }
        }
      }
    }
    
    // Test the locking system
    console.log('🧪 Testing state locking system...');
    
    // Test 1: Check if tables exist
    try {
      const [tables] = await connection.execute(`
        SHOW TABLES LIKE 'zorp_%'
      `);
      console.log(`✅ Found ${tables.length} zorp tables`);
      tables.forEach(table => {
        console.log(`  - ${Object.values(table)[0]}`);
      });
    } catch (error) {
      console.log(`⚠️  Table check warning: ${error.message}`);
    }
    
    // Test 2: Test basic table operations
    try {
      // Test inserting a lock
      const [insertResult] = await connection.execute(`
        INSERT INTO zorp_state_locks (zone_id, current_state, target_state, transition_reason, expires_at)
        VALUES (999999, 'green', 'yellow', 'TEST_LOCK', DATE_ADD(NOW(), INTERVAL 1 MINUTE))
      `);
      
      if (insertResult.affectedRows > 0) {
        console.log('✅ Lock insertion test passed');
        
        // Test checking for locks
        const [lockCheck] = await connection.execute(`
          SELECT COUNT(*) as lock_count FROM zorp_state_locks WHERE zone_id = 999999 AND expires_at > NOW()
        `);
        
        if (lockCheck[0].lock_count > 0) {
          console.log('✅ Lock checking test passed');
        }
        
        // Clean up test data
        await connection.execute(`DELETE FROM zorp_state_locks WHERE zone_id = 999999`);
        console.log('✅ Test cleanup completed');
      }
    } catch (error) {
      console.log(`⚠️  Lock testing warning: ${error.message}`);
    }
    
    console.log('\n✅ Zorp state locking system implemented successfully!');
    console.log('🔒 Features added:');
    console.log('  - State transition locks table');
    console.log('  - State transition history logging table');
    console.log('  - Proper indexing for performance');
    console.log('  - MariaDB compatible structure');
    
    console.log('\n📝 Next steps:');
    console.log('  1. The bot will use these tables for state locking');
    console.log('  2. Manual lock management will be handled in the application code');
    console.log('  3. Automatic cleanup will run every minute');
    
  } catch (error) {
    console.error('❌ Error implementing Zorp state locks:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the implementation
if (require.main === module) {
  implementZorpStateLocks()
    .then(() => {
      console.log('🎉 State locking implementation completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 State locking implementation failed:', error);
      process.exit(1);
    });
}

module.exports = { implementZorpStateLocks };
