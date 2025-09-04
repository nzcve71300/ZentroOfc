const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkZorpSchema() {
  console.log('🔍 Checking Zorp Zones Table Schema\n');
  
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

    // Check current table structure
    console.log('📋 Current zorp_zones table structure:');
    const [columnsResult] = await connection.execute(`
      DESCRIBE zorp_zones
    `);

    columnsResult.forEach(column => {
      console.log(`   • ${column.Field} - ${column.Type} ${column.Null === 'YES' ? '(NULL)' : '(NOT NULL)'} ${column.Key ? `[${column.Key}]` : ''}`);
    });

    // Check if we need to add missing columns
    console.log('\n🔧 Checking for missing columns...');
    
    const existingColumns = columnsResult.map(col => col.Field);
    const requiredColumns = [
      'deleted_at',
      'last_state_change'
    ];

    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.log(`❌ Missing columns: ${missingColumns.join(', ')}`);
      console.log('\n💡 To fix this, run: node fix_zorp_schema.js');
    } else {
      console.log('✅ All required columns exist!');
    }

    // Show sample data
    console.log('\n📊 Sample zorp_zones data:');
    const [sampleData] = await connection.execute(`
      SELECT id, name, owner, current_state, created_at, expire, server_id
      FROM zorp_zones 
      WHERE created_at + INTERVAL expire SECOND > CURRENT_TIMESTAMP
      LIMIT 3
    `);

    if (sampleData.length > 0) {
      sampleData.forEach(zone => {
        console.log(`   • ID: ${zone.id}, Name: ${zone.name}, Owner: ${zone.owner}, State: ${zone.current_state}`);
      });
    } else {
      console.log('   No active zones found');
    }

  } catch (error) {
    console.error('❌ Error checking schema:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the check
checkZorpSchema();
