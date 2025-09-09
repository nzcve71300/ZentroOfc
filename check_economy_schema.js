const pool = require('./src/db');

async function checkEconomySchema() {
  try {
    console.log('🔍 Checking economy table structure...');
    
    const [result] = await pool.query('DESCRIBE economy');
    
    console.log('\n📋 economy table structure:');
    console.table(result);
    
    // Also check if there are any records
    const [countResult] = await pool.query('SELECT COUNT(*) as count FROM economy');
    console.log(`\n📊 Total records in economy: ${countResult[0].count}`);
    
    // Check what columns exist
    const columns = result.map(row => row.Field);
    console.log(`\n🏷️ Available columns: ${columns.join(', ')}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking schema:', error);
    process.exit(1);
  }
}

checkEconomySchema();
