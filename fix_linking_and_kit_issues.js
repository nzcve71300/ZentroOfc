const pool = require('./src/db');

async function fixLinkingAndKitIssues() {
  console.log('🔧 Fixing linking and kit claim issues...');
  
  try {
    // Test the linking query
    console.log('\n📋 Testing linking query...');
    const [testResult] = await pool.query(
      'SELECT id, is_active FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND LOWER(ign) = LOWER(?)',
      ['123456789', 'test_server', 'test_player']
    );
    
    console.log('Linking query result structure:', testResult);
    
    // Test the kit auth query
    console.log('\n📋 Testing kit auth query...');
    const [kitAuthResult] = await pool.query(
      `SELECT ka.* FROM kit_auth ka 
       JOIN players p ON ka.discord_id = p.discord_id 
       WHERE ka.server_id = ? AND p.ign = ? AND ka.kitlist = ?`,
      ['test_server', 'test_player', 'VIPkit']
    );
    
    console.log('Kit auth query result structure:', kitAuthResult);
    
    console.log('\n✅ Test completed. The issues are:');
    console.log('1. Linking system: MySQL2 result access needs to be fixed');
    console.log('2. Kit claim system: MySQL2 result access needs to be fixed');
    
  } catch (error) {
    console.error('❌ Error testing queries:', error);
  }
}

fixLinkingAndKitIssues(); 