const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugEliteKitIssue() {
  console.log('🔍 Debug Elite Kit Issue');
  console.log('========================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    const serverId = '1753952654507_7deot3q0';
    const playerName = 'nzcve7130';
    const correctDiscordId = '1252993829007528200';

    console.log('\n📋 Step 1: Check player record...');
    const [playerResult] = await connection.execute(
      'SELECT * FROM players WHERE server_id = ? AND ign = ?',
      [serverId, playerName]
    );
    
    console.log(`Player record:`, playerResult);
    if (playerResult.length > 0) {
      console.log(`- Discord ID: ${playerResult[0].discord_id === null ? 'NULL' : `"${playerResult[0].discord_id}"`}`);
    }

    console.log('\n📋 Step 2: Check all kit_auth entries for this server...');
    const [authResult] = await connection.execute(
      'SELECT * FROM kit_auth WHERE server_id = ?',
      [serverId]
    );
    
    console.log(`All kit_auth entries:`);
    for (const auth of authResult) {
      console.log(`- Discord ID: ${auth.discord_id === null ? 'NULL' : `"${auth.discord_id}"`}, Kitlist: "${auth.kitlist}"`);
    }

    console.log('\n📋 Step 3: Test the exact JOIN query from the code...');
    const [joinTest] = await connection.execute(
      `SELECT ka.* FROM kit_auth ka 
       JOIN players p ON ka.discord_id = p.discord_id 
       WHERE ka.server_id = ? AND p.ign = ? AND ka.kitlist = ?`,
      [serverId, playerName, 'Elite1']
    );
    
    console.log(`JOIN test result for Elite1: ${joinTest.length > 0 ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log('Join test details:', joinTest);

    console.log('\n📋 Step 4: Test individual parts...');
    
    // Test player lookup
    const [playerLookup] = await connection.execute(
      'SELECT discord_id FROM players WHERE server_id = ? AND ign = ?',
      [serverId, playerName]
    );
    console.log(`Player lookup result:`, playerLookup);

    // Test kit_auth lookup
    const [authLookup] = await connection.execute(
      'SELECT * FROM kit_auth WHERE server_id = ? AND kitlist = ?',
      [serverId, 'Elite1']
    );
    console.log(`Kit auth lookup for Elite1:`, authLookup);

    await connection.end();

    console.log('\n🎯 ANALYSIS:');
    console.log('This will help us understand why the elite kit authorization is failing.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

debugEliteKitIssue(); 