const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugVipIssue() {
  console.log('🔧 Debug VIP Issue');
  console.log('==================\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    const discordId = '1252993829007528200';
    const playerName = 'nzcve7130';
    const serverId = '1753952654507_7deot3q0';

    console.log('\n📋 Step 1: Checking players table...');
    const [playersResult] = await connection.execute(
      'SELECT * FROM players WHERE server_id = ?',
      [serverId]
    );
    
    console.log(`Found ${playersResult.length} players on this server:`);
    for (const player of playersResult) {
      console.log(`- IGN: "${player.ign}", Discord ID: "${player.discord_id}", Server ID: "${player.server_id}"`);
    }

    console.log('\n📋 Step 2: Checking kit_auth table...');
    const [authResult] = await connection.execute(
      'SELECT * FROM kit_auth WHERE server_id = ?',
      [serverId]
    );
    
    console.log(`Found ${authResult.length} kit authorization entries:`);
    for (const auth of authResult) {
      console.log(`- Discord ID: "${auth.discord_id}", Kitlist: "${auth.kitlist}", Server ID: "${auth.server_id}"`);
    }

    console.log('\n📋 Step 3: Testing the JOIN query step by step...');
    
    // Test 1: Find the player record
    const [playerRecord] = await connection.execute(
      'SELECT * FROM players WHERE server_id = ? AND ign = ?',
      [serverId, playerName]
    );
    console.log(`Player record found: ${playerRecord.length > 0 ? 'YES' : 'NO'}`);
    if (playerRecord.length > 0) {
      console.log(`- Player Discord ID: "${playerRecord[0].discord_id}"`);
    }

    // Test 2: Find the auth record
    const [authRecord] = await connection.execute(
      'SELECT * FROM kit_auth WHERE server_id = ? AND kitlist = ?',
      [serverId, 'VIPkit']
    );
    console.log(`VIP auth record found: ${authRecord.length > 0 ? 'YES' : 'NO'}`);
    if (authRecord.length > 0) {
      console.log(`- Auth Discord ID: "${authRecord[0].discord_id}"`);
    }

    // Test 3: Manual JOIN test
    if (playerRecord.length > 0 && authRecord.length > 0) {
      const [joinTest] = await connection.execute(
        'SELECT ka.* FROM kit_auth ka JOIN players p ON ka.discord_id = p.discord_id WHERE ka.server_id = ? AND p.ign = ? AND ka.kitlist = ?',
        [serverId, playerName, 'VIPkit']
      );
      console.log(`JOIN test result: ${joinTest.length > 0 ? 'SUCCESS' : 'FAILED'}`);
      
      if (joinTest.length === 0) {
        console.log('💡 The JOIN is failing. Let\'s check why...');
        
        // Check if Discord IDs match exactly
        const playerDiscordId = playerRecord[0].discord_id;
        const authDiscordId = authRecord[0].discord_id;
        
        console.log(`Player Discord ID: "${playerDiscordId}"`);
        console.log(`Auth Discord ID: "${authDiscordId}"`);
        console.log(`IDs match: ${playerDiscordId === authDiscordId ? 'YES' : 'NO'}`);
        console.log(`Player ID length: ${playerDiscordId ? playerDiscordId.length : 0}`);
        console.log(`Auth ID length: ${authDiscordId ? authDiscordId.length : 0}`);
        
        // Check for whitespace or hidden characters
        console.log(`Player ID trimmed: "${playerDiscordId ? playerDiscordId.trim() : ''}"`);
        console.log(`Auth ID trimmed: "${authDiscordId ? authDiscordId.trim() : ''}"`);
      }
    }

    console.log('\n📋 Step 4: Testing with exact Discord ID match...');
    if (playerRecord.length > 0 && authRecord.length > 0) {
      const playerDiscordId = playerRecord[0].discord_id;
      const [exactMatch] = await connection.execute(
        'SELECT ka.* FROM kit_auth ka WHERE ka.server_id = ? AND ka.discord_id = ? AND ka.kitlist = ?',
        [serverId, playerDiscordId, 'VIPkit']
      );
      console.log(`Exact Discord ID match: ${exactMatch.length > 0 ? 'YES' : 'NO'}`);
    }

    await connection.end();

    console.log('\n🎯 SUMMARY:');
    console.log('The issue is likely one of these:');
    console.log('1. Discord ID mismatch between players and kit_auth tables');
    console.log('2. Hidden characters or whitespace in the Discord IDs');
    console.log('3. Data type mismatch (string vs number)');
    
    console.log('\n💡 SOLUTION:');
    console.log('1. Check the exact Discord IDs above');
    console.log('2. If they don\'t match, fix the kit_auth entry');
    console.log('3. Restart the bot after fixing');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugVipIssue(); 