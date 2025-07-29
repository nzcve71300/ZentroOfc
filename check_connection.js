require('dotenv').config();

console.log('🔍 Checking database connection configuration...');

console.log('📋 Environment variables:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PORT:', process.env.DB_PORT);

const { db } = require('./src/config');
console.log('📋 Database config:', db);

// Test connection
const pool = require('./src/db');

async function testConnection() {
  try {
    const result = await pool.query('SELECT current_database() as db_name, current_user as user');
    console.log('🗄️  Connected to database:', result.rows[0].db_name);
    console.log('👤 Connected as user:', result.rows[0].user);
    
    // Check if players table exists in this database
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'players'
      ) as exists
    `);
    console.log('📋 Players table exists:', tableExists.rows[0].exists);
    
    if (tableExists.rows[0].exists) {
      // Check columns
      const columns = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'players' 
        ORDER BY ordinal_position
      `);
      
      console.log('📋 Players table columns:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
  } finally {
    await pool.end();
  }
}

testConnection();