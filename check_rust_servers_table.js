const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkRustServersTable() {
  console.log('🔍 CHECK: RUST_SERVERS TABLE STRUCTURE');
  console.log('======================================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    console.log('\n📋 CHECKING RUST_SERVERS TABLE STRUCTURE...\n');
    
    // Get table structure
    const [columns] = await connection.execute('DESCRIBE rust_servers');
    
    console.log('📊 RUST_SERVERS TABLE COLUMNS:');
    columns.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.Field} (${col.Type}) - ${col.Null === 'YES' ? 'NULLABLE' : 'NOT NULL'}`);
    });

    console.log('\n📋 CHECKING ACTUAL DATA IN TABLE...\n');
    
    // Get sample data
    const [servers] = await connection.execute('SELECT * FROM rust_servers LIMIT 5');
    
    console.log(`📊 SAMPLE DATA (${servers.length} rows):`);
    if (servers.length > 0) {
      // Show column names
      const columnNames = Object.keys(servers[0]);
      console.log('   COLUMNS:', columnNames.join(', '));
      
      // Show sample data
      servers.forEach((server, index) => {
        console.log(`   Row ${index + 1}:`, server);
      });
    } else {
      console.log('   ❌ NO DATA FOUND IN RUST_SERVERS TABLE!');
    }

    await connection.end();

    console.log('\n🎯 ANALYSIS:');
    console.log('The /link command is looking for "server_id" column but it might be named differently.');
    console.log('Check the actual column names above and we\'ll fix the bot code.');

  } catch (error) {
    console.error('❌ CHECK ERROR:', error.message);
    console.error(error);
  }
}

checkRustServersTable();