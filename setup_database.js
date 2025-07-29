const mysql = require('mysql2/promise');
require('dotenv').config();

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  console.log('📋 Current configuration:');
  console.log(`  Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`  Port: ${process.env.DB_PORT || 3306}`);
  console.log(`  Database: ${process.env.DB_NAME || 'zentro_bot'}`);
  console.log(`  User: ${process.env.DB_USER || 'root'}`);
  console.log(`  Password: ${process.env.DB_PASSWORD ? '[SET]' : '[NOT SET]'}`);
  
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    // Test basic connection
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful!');
    
    // Test if database exists
    try {
      await pool.query(`USE ${process.env.DB_NAME || 'zentro_bot'}`);
      console.log(`✅ Database '${process.env.DB_NAME || 'zentro_bot'}' exists and accessible`);
      
      // Check if tables exist
      const [tables] = await pool.query('SHOW TABLES');
      console.log(`📊 Found ${tables.length} tables in database`);
      
      if (tables.length > 0) {
        console.log('📋 Existing tables:');
        tables.forEach(table => {
          console.log(`  - ${Object.values(table)[0]}`);
        });
      }
      
    } catch (error) {
      if (error.code === 'ER_BAD_DB_ERROR') {
        console.log(`❌ Database '${process.env.DB_NAME || 'zentro_bot'}' does not exist`);
        console.log('💡 You need to create the database first:');
        console.log(`   CREATE DATABASE ${process.env.DB_NAME || 'zentro_bot'};`);
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting options:');
    console.log('');
    console.log('1. Install MySQL locally:');
    console.log('   - Download from: https://dev.mysql.com/downloads/mysql/');
    console.log('   - Or use XAMPP: https://www.apachefriends.org/');
    console.log('');
    console.log('2. Use a remote MySQL server:');
    console.log('   - Update .env with remote server details');
    console.log('   - Example: DB_HOST=your-server.com');
    console.log('');
    console.log('3. Use a cloud database:');
    console.log('   - Google Cloud SQL');
    console.log('   - AWS RDS');
    console.log('   - DigitalOcean Managed Databases');
    console.log('');
    console.log('4. Check if MySQL service is running:');
    console.log('   - Windows: Check Services app for MySQL');
    console.log('   - Or use XAMPP/WAMP control panel');
  } finally {
    await pool.end();
  }
}

testDatabaseConnection(); 