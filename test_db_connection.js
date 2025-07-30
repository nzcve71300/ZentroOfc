const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  console.log('🔍 Testing database connection...');
  console.log('Environment variables:');
  console.log('DB_HOST:', process.env.DB_HOST);
  console.log('DB_USER:', process.env.DB_USER);
  console.log('DB_NAME:', process.env.DB_NAME);
  console.log('DB_PORT:', process.env.DB_PORT || 3306);
  
  let pool;
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    // Test connection
    const [result] = await pool.query('SELECT 1 as test');
    console.log('✅ Database connection successful!');
    console.log('Test query result:', result);
    
    // Check if tables exist
    const [tables] = await pool.query('SHOW TABLES');
    console.log('📊 Available tables:');
    tables.forEach(table => {
      console.log(`   - ${Object.values(table)[0]}`);
    });
    
    // Check economy table structure
    try {
      const [economyColumns] = await pool.query('DESCRIBE economy');
      console.log('📈 Economy table columns:');
      economyColumns.forEach(col => {
        console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
    } catch (error) {
      console.log('❌ Economy table does not exist');
    }
    
    // Check transactions table structure
    try {
      const [transactionColumns] = await pool.query('DESCRIBE transactions');
      console.log('📊 Transactions table columns:');
      transactionColumns.forEach(col => {
        console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });
    } catch (error) {
      console.log('❌ Transactions table does not exist');
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('💡 Please check your environment variables and database setup');
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

testConnection(); 