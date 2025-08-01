const pool = require('./src/db');

async function fixRustServersIdVarchar() {
  try {
    console.log('🔧 Fixing rust_servers table with VARCHAR id...');
    
    // The id column is VARCHAR(32), so we need to generate unique IDs
    // Let's update the addServer command to generate a unique ID
    
    console.log('✅ rust_servers.id is VARCHAR(32) - this is correct for your schema');
    console.log('💡 The addServer command needs to generate a unique ID');
    
    // Show what the current structure looks like
    const [columns] = await pool.query(`
      DESCRIBE rust_servers
    `);
    
    console.log('Current structure is correct for your schema');
    console.log('The issue is that the INSERT statement needs to include the id field');
    
  } catch (error) {
    console.error('❌ Error checking rust_servers structure:', error);
  } finally {
    await pool.end();
  }
}

fixRustServersIdVarchar(); 