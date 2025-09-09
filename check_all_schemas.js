const pool = require('./src/db');

async function checkAllSchemas() {
  try {
    console.log('🔍 Checking all table structures that might be used in server removal...');
    
    const tables = [
      'shop_items',
      'kit_delivery_queue', 
      'bounty_data',
      'leaderboard',
      'channel_settings'
    ];
    
    for (const table of tables) {
      try {
        console.log(`\n📋 ${table} table structure:`);
        const [result] = await pool.query(`DESCRIBE ${table}`);
        console.table(result);
        
        const columns = result.map(row => row.Field);
        console.log(`🏷️ Available columns: ${columns.join(', ')}`);
        
        // Check if server_id exists
        if (columns.includes('server_id')) {
          console.log('✅ Has server_id column');
        } else if (columns.includes('guild_id')) {
          console.log('✅ Has guild_id column (use guild_id instead)');
        } else {
          console.log('⚠️ No server_id or guild_id column found');
        }
        
      } catch (error) {
        console.log(`❌ Table ${table} doesn't exist or error: ${error.message}`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking schemas:', error);
    process.exit(1);
  }
}

checkAllSchemas();
