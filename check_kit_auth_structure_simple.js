const pool = require('./src/db');

async function checkKitAuthStructure() {
  console.log('🔍 Checking kit_auth table structure...');
  
  try {
    // Check the table structure
    const [structure] = await pool.query('DESCRIBE kit_auth');
    console.log('\n📋 kit_auth table structure:');
    console.table(structure);
    
    // Check what columns exist
    const columns = structure.map(col => col.Field);
    console.log('\n📋 Available columns:', columns);
    
    // Check a few sample records
    const [samples] = await pool.query('SELECT * FROM kit_auth LIMIT 3');
    console.log('\n📋 Sample kit_auth records:');
    console.table(samples);
    
    // Check if there are any Elite5 entries
    const [elite5Entries] = await pool.query("SELECT * FROM kit_auth WHERE kitlist = 'Elite5'");
    console.log('\n📋 Elite5 entries:', elite5Entries.length);
    elite5Entries.forEach(entry => {
      console.log(`- ${entry.player_name || entry.discord_id} on server ${entry.server_id}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking kit_auth structure:', error);
  } finally {
    await pool.end();
  }
}

checkKitAuthStructure(); 