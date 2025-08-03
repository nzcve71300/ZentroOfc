const pool = require('./src/db');

async function checkKitAuthStructure() {
  console.log('🔍 Checking kit_auth table structure...');
  
  try {
    // Check the table structure
    const [structure] = await pool.query('DESCRIBE kit_auth');
    console.log('\n📋 kit_auth table structure:');
    console.table(structure);
    
    // Check a few sample records
    const [samples] = await pool.query('SELECT * FROM kit_auth LIMIT 5');
    console.log('\n📋 Sample kit_auth records:');
    console.table(samples);
    
    // Check what columns exist
    const columns = structure.map(col => col.Field);
    console.log('\n📋 Available columns:', columns);
    
  } catch (error) {
    console.error('❌ Error checking kit_auth structure:', error);
  } finally {
    await pool.end();
  }
}

checkKitAuthStructure(); 