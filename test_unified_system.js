const pool = require('./src/db');

async function testDatabaseConnection() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connection successful:', result.rows[0]);
    
    // Check if players table exists and has expected columns
    const playersColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      ORDER BY ordinal_position
    `);
    console.log('📋 Players table columns:', playersColumns.rows);
    
    // Check if economy table exists and has expected columns
    const economyColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'economy' 
      ORDER BY ordinal_position
    `);
    console.log('📋 Economy table columns:', economyColumns.rows);
    
    // Test a simple query on players table
    const playerCount = await pool.query('SELECT COUNT(*) as count FROM players');
    console.log('👥 Player count:', playerCount.rows[0]);
    
    // Test a simple query on economy table
    const economyCount = await pool.query('SELECT COUNT(*) as count FROM economy');
    console.log('💰 Economy records count:', economyCount.rows[0]);
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

testDatabaseConnection();