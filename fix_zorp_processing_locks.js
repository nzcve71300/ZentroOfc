const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixZorpProcessingLocks() {
  let connection;
  
  try {
    console.log('🔧 Fixing ZORP Processing Locks table...');
    
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Connected to database');

    // Check if table exists
    const [tables] = await connection.execute(
      "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'zorp_processing_locks'",
      [process.env.DB_NAME]
    );

    const tableExists = tables[0].count > 0;
    console.log(`📋 Table exists: ${tableExists}`);

    if (!tableExists) {
      // Create the table from scratch
      console.log('🏗️  Creating zorp_processing_locks table...');
      await connection.execute(`
        CREATE TABLE zorp_processing_locks (
          id INT AUTO_INCREMENT PRIMARY KEY,
          server_id VARCHAR(255) NOT NULL UNIQUE,
          owner_id VARCHAR(255) NOT NULL,
          locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 90 SECOND),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_zorp_locks_server (server_id),
          INDEX idx_zorp_locks_owner (owner_id),
          INDEX idx_zorp_locks_expires (expires_at)
        )
      `);
      console.log('✅ Table created successfully');
    } else {
      // Check and add missing columns
      console.log('🔍 Checking for missing columns...');
      
      const [columns] = await connection.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'zorp_processing_locks'",
        [process.env.DB_NAME]
      );
      
      const existingColumns = columns.map(col => col.COLUMN_NAME);
      console.log(`📋 Existing columns: ${existingColumns.join(', ')}`);

      // Add missing columns
      const requiredColumns = [
        { name: 'owner_id', type: 'VARCHAR(255) NOT NULL DEFAULT "unknown"' },
        { name: 'locked_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
        { name: 'expires_at', type: 'TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 90 SECOND)' },
        { name: 'created_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
      ];

      for (const column of requiredColumns) {
        if (!existingColumns.includes(column.name)) {
          console.log(`➕ Adding missing column: ${column.name}`);
          await connection.execute(`ALTER TABLE zorp_processing_locks ADD COLUMN ${column.name} ${column.type}`);
        } else {
          console.log(`✅ Column already exists: ${column.name}`);
        }
      }

      // Create indexes if they don't exist
      console.log('🔗 Creating indexes...');
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_zorp_locks_server ON zorp_processing_locks(server_id)',
        'CREATE INDEX IF NOT EXISTS idx_zorp_locks_owner ON zorp_processing_locks(owner_id)',
        'CREATE INDEX IF NOT EXISTS idx_zorp_locks_expires ON zorp_processing_locks(expires_at)'
      ];

      for (const indexSql of indexes) {
        try {
          await connection.execute(indexSql);
          console.log(`✅ Index created: ${indexSql.split(' ')[5]}`);
        } catch (error) {
          if (error.code === 'ER_DUP_KEYNAME') {
            console.log(`ℹ️  Index already exists: ${indexSql.split(' ')[5]}`);
          } else {
            console.log(`⚠️  Index creation warning: ${error.message}`);
          }
        }
      }
    }

    // Clean up expired locks
    console.log('🧹 Cleaning up expired locks...');
    const [deleteResult] = await connection.execute(
      'DELETE FROM zorp_processing_locks WHERE expires_at < CURRENT_TIMESTAMP'
    );
    console.log(`✅ Cleaned up ${deleteResult.affectedRows} expired locks`);

    // Show final table structure
    console.log('\n📋 Final table structure:');
    const [structure] = await connection.execute('DESCRIBE zorp_processing_locks');
    console.table(structure);

    // Show current locks
    console.log('\n🔒 Current active locks:');
    const [locks] = await connection.execute('SELECT * FROM zorp_processing_locks');
    if (locks.length > 0) {
      console.table(locks);
    } else {
      console.log('No active locks found');
    }

    console.log('\n🎉 ZORP Processing Locks table fixed successfully!');
    console.log('The ZORP system should now work without the "Unknown column \'owner_id\'" error.');

  } catch (error) {
    console.error('❌ Error fixing ZORP Processing Locks table:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the fix
if (require.main === module) {
  fixZorpProcessingLocks()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixZorpProcessingLocks };
