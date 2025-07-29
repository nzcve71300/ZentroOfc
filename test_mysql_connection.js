const mysql = require('mysql2/promise');
require('dotenv').config();

async function testMySQLConnection() {
  console.log('🧪 Testing MySQL connection...');
  
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
  });

  try {
    // Test basic connection
    console.log('📡 Testing basic connection...');
    const [result] = await pool.query('SELECT 1 as test');
    console.log('✅ Basic connection successful:', result[0]);

    // Test database version
    console.log('📊 Getting MySQL version...');
    const [version] = await pool.query('SELECT VERSION() as version');
    console.log('✅ MySQL version:', version[0].version);

    // Test table creation
    console.log('🗄️ Testing table creation...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_table (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Test table created successfully');

    // Test insert
    console.log('📝 Testing insert...');
    const [insertResult] = await pool.query(
      'INSERT INTO test_table (name) VALUES (?)',
      ['MySQL Test']
    );
    console.log('✅ Insert successful, ID:', insertResult.insertId);

    // Test select
    console.log('🔍 Testing select...');
    const [selectResult] = await pool.query('SELECT * FROM test_table WHERE id = ?', [insertResult.insertId]);
    console.log('✅ Select successful:', selectResult[0]);

    // Test update
    console.log('✏️ Testing update...');
    const [updateResult] = await pool.query(
      'UPDATE test_table SET name = ? WHERE id = ?',
      ['Updated MySQL Test', insertResult.insertId]
    );
    console.log('✅ Update successful, affected rows:', updateResult.affectedRows);

    // Test delete
    console.log('🗑️ Testing delete...');
    const [deleteResult] = await pool.query('DELETE FROM test_table WHERE id = ?', [insertResult.insertId]);
    console.log('✅ Delete successful, affected rows:', deleteResult.affectedRows);

    // Clean up test table
    console.log('🧹 Cleaning up test table...');
    await pool.query('DROP TABLE test_table');
    console.log('✅ Test table dropped');

    // Test guilds table (if exists)
    console.log('🏛️ Testing guilds table...');
    try {
      const [guilds] = await pool.query('SELECT COUNT(*) as count FROM guilds');
      console.log('✅ Guilds table accessible, count:', guilds[0].count);
    } catch (error) {
      console.log('ℹ️ Guilds table not found (this is normal for fresh installation)');
    }

    // Test players table (if exists)
    console.log('👥 Testing players table...');
    try {
      const [players] = await pool.query('SELECT COUNT(*) as count FROM players');
      console.log('✅ Players table accessible, count:', players[0].count);
    } catch (error) {
      console.log('ℹ️ Players table not found (this is normal for fresh installation)');
    }

    console.log('🎉 All MySQL tests passed!');
    console.log('✅ Your MySQL setup is working correctly.');

  } catch (error) {
    console.error('❌ MySQL test failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Provide helpful error messages
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Tip: Make sure MySQL is running: sudo systemctl status mysql');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('💡 Tip: Check your database credentials in .env file');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.log('💡 Tip: Database does not exist. Run: mysql -u root -p -e "CREATE DATABASE zentro_bot;"');
    }
  } finally {
    await pool.end();
  }
}

// Run test if this script is executed directly
if (require.main === module) {
  testMySQLConnection()
    .then(() => {
      console.log('Test completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testMySQLConnection }; 