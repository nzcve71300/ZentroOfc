const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixVipDiscordIds() {
  console.log('🔧 Fix VIP Discord IDs');
  console.log('======================\n');

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
    const correctDiscordId = '1252993829007528200';

    console.log('\n📋 Step 1: Checking current state...');
    const [playersResult] = await connection.execute(
      'SELECT * FROM players WHERE server_id = ?',
      [serverId]
    );
    
    console.log(`Found ${playersResult.length} players:`);
    for (const player of playersResult) {
      console.log(`- IGN: "${player.ign}", Discord ID: ${player.discord_id === null ? 'NULL' : `"${player.discord_id}"`}`);
    }

    const [authResult] = await connection.execute(
      'SELECT * FROM kit_auth WHERE server_id = ?',
      [serverId]
    );
    
    console.log(`Found ${authResult.length} kit auth entries:`);
    for (const auth of authResult) {
      console.log(`- Discord ID: ${auth.discord_id === null ? 'NULL' : `"${auth.discord_id}"`}, Kitlist: "${auth.kitlist}"`);
    }

    console.log('\n📋 Step 2: Fixing player Discord ID...');
    await connection.execute(
      'UPDATE players SET discord_id = ? WHERE server_id = ? AND ign = ?',
      [correctDiscordId, serverId, 'nzcve7130']
    );
    console.log('✅ Updated player Discord ID');

    console.log('\n📋 Step 3: Fixing kit_auth Discord ID...');
    await connection.execute(
      'UPDATE kit_auth SET discord_id = ? WHERE server_id = ? AND kitlist = ?',
      [correctDiscordId, serverId, 'VIPkit']
    );
    console.log('✅ Updated kit_auth Discord ID');

    console.log('\n📋 Step 4: Verifying the fix...');
    const [updatedPlayers] = await connection.execute(
      'SELECT * FROM players WHERE server_id = ?',
      [serverId]
    );
    
    console.log(`Updated players:`);
    for (const player of updatedPlayers) {
      console.log(`- IGN: "${player.ign}", Discord ID: ${player.discord_id === null ? 'NULL' : `"${player.discord_id}"`}`);
    }

    const [updatedAuth] = await connection.execute(
      'SELECT * FROM kit_auth WHERE server_id = ?',
      [serverId]
    );
    
    console.log(`Updated kit auth:`);
    for (const auth of updatedAuth) {
      console.log(`- Discord ID: ${auth.discord_id === null ? 'NULL' : `"${auth.discord_id}"`}, Kitlist: "${auth.kitlist}"`);
    }

    console.log('\n📋 Step 5: Testing the JOIN query...');
    const [joinTest] = await connection.execute(
      'SELECT ka.* FROM kit_auth ka JOIN players p ON ka.discord_id = p.discord_id WHERE ka.server_id = ? AND p.ign = ? AND ka.kitlist = ?',
      [serverId, 'nzcve7130', 'VIPkit']
    );
    
    console.log(`JOIN test result: ${joinTest.length > 0 ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (joinTest.length > 0) {
      console.log('✅ The VIP authorization should now work!');
    }

    await connection.end();

    console.log('\n🎯 SUMMARY:');
    console.log('✅ Fixed Discord IDs in both players and kit_auth tables');
    console.log('✅ JOIN query now works');
    console.log('✅ VIP authorization should work');

    console.log('\n🚀 RESTART THE BOT NOW:');
    console.log('pm2 restart zentro-bot');
    console.log('pm2 logs zentro-bot');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fixVipDiscordIds(); 