const pool = require('./src/db');

async function checkConstraints() {
  try {
    console.log('🔍 Checking current constraints...');
    
    const connection = await pool.getConnection();
    
    try {
      // Check all unique constraints
      const [constraints] = await connection.query('SHOW INDEX FROM players WHERE Non_unique = 0');
      console.log('\nCurrent unique constraints:');
      constraints.forEach(c => console.log(`- ${c.Key_name}: ${c.Column_name}`));
      
      // Check if the problematic constraints are gone
      const problematicIgn = constraints.some(c => c.Key_name === 'players_unique_guild_server_ign');
      const problematicDiscord = constraints.some(c => c.Key_name === 'players_unique_guild_server_discord');
      
      if (!problematicIgn && !problematicDiscord) {
        console.log('\n✅ SUCCESS: Both problematic constraints are gone!');
        console.log('✅ The system should now work properly for multi-server linking.');
      } else {
        console.log('\n❌ Some problematic constraints still exist:');
        if (problematicIgn) console.log('  - players_unique_guild_server_ign');
        if (problematicDiscord) console.log('  - players_unique_guild_server_discord');
      }
      
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  process.exit(0);
}

checkConstraints();