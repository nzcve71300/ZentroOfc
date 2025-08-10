const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('🧪 Testing Nivaro Setup...');

// Test database connection
async function testConnection() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log('📋 Testing database connection...');
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');

    console.log('📋 Testing if Nivaro tables exist...');
    
    const tables = ['pending_stores', 'stores', 'discord_links', 'api_rate_limits'];
    
    for (const table of tables) {
      try {
        await pool.query(`SELECT 1 FROM ${table} LIMIT 1`);
        console.log(`✅ ${table} table exists`);
      } catch (error) {
        console.log(`❌ ${table} table missing - needs to be created`);
      }
    }

    await pool.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('💡 Make sure your .env file has correct database credentials');
  }
}

testConnection(); 