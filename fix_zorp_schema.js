const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixZorpSchema() {
  console.log('🔧 Fixing Zorp Zones Table Schema\n');
  
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!\n');

    // Add missing columns
    console.log('📋 Adding missing columns...');
    
    try {
      // Add deleted_at column
      await connection.execute(`
        ALTER TABLE zorp_zones 
        ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL
      `);
      console.log('✅ Added deleted_at column');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  deleted_at column already exists');
      } else {
        console.log(`⚠️  Could not add deleted_at column: ${error.message}`);
      }
    }

    try {
      // Add last_state_change column
      await connection.execute(`
        ALTER TABLE zorp_zones 
        ADD COLUMN last_state_change TIMESTAMP NULL DEFAULT NULL
      `);
      console.log('✅ Added last_state_change column');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  last_state_change column already exists');
      } else {
        console.log(`⚠️  Could not add last_state_change column: ${error.message}`);
      }
    }

    // Verify the table structure
    console.log('\n📋 Updated zorp_zones table structure:');
    const [columnsResult] = await connection.execute(`
      DESCRIBE zorp_zones
    `);

    columnsResult.forEach(column => {
      console.log(`   • ${column.Field} - ${column.Type} ${column.Null === 'YES' ? '(NULL)' : '(NOT NULL)'} ${column.Key ? `[${column.Key}]` : ''}`);
    });

    console.log('\n🎉 Schema update completed!');
    console.log('💡 You can now run: node improved_zorp_system.js');

  } catch (error) {
    console.error('❌ Error fixing schema:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
fixZorpSchema();
