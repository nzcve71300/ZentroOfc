require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
});

async function testConnection() {
  try {
    console.log('Testing database connection...');
    console.log('Host:', process.env.DB_HOST);
    console.log('User:', process.env.DB_USER);
    console.log('Database:', process.env.DB_NAME);
    console.log('Port:', process.env.DB_PORT || 5432);
    
    const result = await pool.query('SELECT current_user, current_database()');
    console.log('Connected as:', result.rows[0].current_user);
    console.log('Connected to database:', result.rows[0].current_database);
    
    // Check if sequence exists
    const sequenceCheck = await pool.query(`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public' 
      AND sequence_name = 'guilds_id_seq'
    `);
    console.log('Sequence exists:', sequenceCheck.rows.length > 0);
    
    if (sequenceCheck.rows.length > 0) {
      // Check current permissions on sequence
      const permCheck = await pool.query(`
        SELECT grantee, privilege_type 
        FROM information_schema.usage_privileges 
        WHERE object_name = 'guilds_id_seq' 
        AND grantee = current_user
      `);
      console.log('Current permissions on sequence:', permCheck.rows);
      
      // Try to get next value
      try {
        const sequenceResult = await pool.query("SELECT nextval('guilds_id_seq')");
        console.log('Sequence test successful:', sequenceResult.rows[0].nextval);
      } catch (seqError) {
        console.error('Sequence access failed:', seqError.message);
      }
    }
    
    await pool.end();
  } catch (error) {
    console.error('Database test failed:', error.message);
    console.error('Error code:', error.code);
    await pool.end();
  }
}

testConnection(); 