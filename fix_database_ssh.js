const pool = require('./src/db');
const fs = require('fs');

async function fixDatabase() {
  try {
    console.log('🔧 Adding missing columns to database...');
    
    // Read the SQL script
    const sqlScript = fs.readFileSync('./add_missing_columns_ssh.sql', 'utf8');
    
    // Execute the SQL script
    await pool.query(sqlScript);
    
    console.log('✅ Missing columns added successfully!');
    
    // Verify the changes
    console.log('🔍 Verifying database structure...');
    
    const playersColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Players table columns:');
    playersColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    const activePlayers = await pool.query('SELECT COUNT(*) as count FROM players WHERE is_active = true');
    console.log(`👥 Active players: ${activePlayers.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Failed to fix database:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

fixDatabase();