const pool = require('./src/db');

async function testConnection() {
  try {
    console.log('Testing database connection...');
    const [result] = await pool.query('SELECT 1 as test');
    console.log('✅ Database connection successful:', result);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  } finally {
    process.exit(0);
  }
}

testConnection(); 