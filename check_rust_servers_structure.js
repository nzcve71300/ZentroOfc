const pool = require('./src/db');

console.log('🔍 Checking rust_servers table structure...\n');

async function checkRustServersStructure() {
  try {
    // Check the table structure
    const [columns] = await pool.query('DESCRIBE rust_servers');
    console.log('📋 rust_servers table structure:');
    console.table(columns);
    
    // Check what columns contain server names
    const [sampleData] = await pool.query('SELECT * FROM rust_servers LIMIT 3');
    console.log('\n📋 Sample rust_servers data:');
    console.table(sampleData);
    
    // Look for the server with name "EMPEROR 3X"
    const [emperorServer] = await pool.query('SELECT * FROM rust_servers WHERE id = ?', ['1754071898933_jg45hm1wj']);
    console.log('\n📋 EMPEROR 3X server data:');
    console.table(emperorServer);
    
  } catch (error) {
    console.log('❌ Error checking rust_servers structure:', error.message);
  } finally {
    await pool.end();
  }
}

checkRustServersStructure(); 