require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
});

async function testConnection() {
  try {
    console.log('Testing MariaDB/MySQL connection...');
    console.log('Host:', process.env.DB_HOST);
    console.log('User:', process.env.DB_USER);
    console.log('Database:', process.env.DB_NAME);
    console.log('Port:', process.env.DB_PORT || 3306);
    
    const [result] = await pool.execute('SELECT USER() as current_user, DATABASE() as current_database');
    console.log('Connected as:', result[0].current_user);
    console.log('Connected to database:', result[0].current_database);
    
    // Check if tables exist
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME IN ('guilds', 'rust_servers', 'players', 'economy')
    `, [process.env.DB_NAME]);
    
    console.log('Found tables:', tables.map(t => t.TABLE_NAME));
    
    // Check if guilds table has auto_increment
    const [guildsInfo] = await pool.execute(`
      SELECT COLUMN_NAME, COLUMN_TYPE, EXTRA
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'guilds' 
      AND COLUMN_NAME = 'id'
    `, [process.env.DB_NAME]);
    
    if (guildsInfo.length > 0) {
      console.log('Guilds ID column info:', guildsInfo[0]);
    }
    
    // Test inserting a test guild
    try {
      const [insertResult] = await pool.execute(
        'INSERT INTO guilds (discord_id, name) VALUES (?, ?)',
        ['123456789', 'Test Guild']
      );
      console.log('Test insert successful, ID:', insertResult.insertId);
      
      // Clean up test data
      await pool.execute('DELETE FROM guilds WHERE discord_id = ?', ['123456789']);
      console.log('Test data cleaned up');
    } catch (insertError) {
      console.error('Test insert failed:', insertError.message);
    }
    
    await pool.end();
  } catch (error) {
    console.error('Database test failed:', error.message);
    console.error('Error code:', error.code);
    await pool.end();
  }
}

testConnection(); 