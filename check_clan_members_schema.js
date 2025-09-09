const pool = require('./src/db');

async function checkClanMembersSchema() {
  try {
    console.log('🔍 Checking clan_members table structure...');
    
    const [result] = await pool.query('DESCRIBE clan_members');
    
    console.log('\n📋 clan_members table structure:');
    console.table(result);
    
    // Also check if there are any records
    const [countResult] = await pool.query('SELECT COUNT(*) as count FROM clan_members');
    console.log(`\n📊 Total records in clan_members: ${countResult[0].count}`);
    
    // Check what columns exist
    const columns = result.map(row => row.Field);
    console.log(`\n🏷️ Available columns: ${columns.join(', ')}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking schema:', error);
    process.exit(1);
  }
}

checkClanMembersSchema();
