const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkRustServersSchema() {
  console.log('🔍 Checking rust_servers table structure...');
  console.log('==========================================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    // Check if rust_servers table exists
    const [tables] = await connection.execute(`
      SHOW TABLES LIKE 'rust_servers'
    `);

    if (tables.length === 0) {
      console.log('❌ rust_servers table does not exist!');
      return;
    }

    console.log('✅ rust_servers table exists\n');

    // Show table structure
    console.log('📋 Table structure:');
    const [columns] = await connection.execute(`
      DESCRIBE rust_servers
    `);

    columns.forEach(col => {
      console.log(`   ${col.Field} | ${col.Type} | ${col.Null} | ${col.Key} | ${col.Default} | ${col.Extra}`);
    });

    console.log('\n📋 Show create table:');
    const [createTable] = await connection.execute(`
      SHOW CREATE TABLE rust_servers
    `);

    console.log(createTable[0]['Create Table']);

    // Check primary key
    console.log('\n🔑 Primary key information:');
    const [primaryKeys] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'rust_servers' AND CONSTRAINT_NAME = 'PRIMARY'
    `, [process.env.DB_NAME]);

    if (primaryKeys.length > 0) {
      primaryKeys.forEach(pk => {
        console.log(`   Primary key: ${pk.COLUMN_NAME} (${pk.DATA_TYPE})`);
      });
    } else {
      console.log('   ❌ No primary key found!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

checkRustServersSchema();
