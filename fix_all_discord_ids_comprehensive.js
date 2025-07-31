const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixAllDiscordIdsComprehensive() {
  console.log('🔧 Comprehensive Discord ID Fix');
  console.log('================================\n');

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
    const playerName = 'nzcve7130';

    console.log('\n📋 Step 1: Check current state...');
    
    // Check players table
    const [playersResult] = await connection.execute(
      'SELECT * FROM players WHERE server_id = ?',
      [serverId]
    );
    console.log(`Players table entries:`);
    for (const player of playersResult) {
      console.log(`- IGN: "${player.ign}", Discord ID: ${player.discord_id === null ? 'NULL' : `"${player.discord_id}"`}`);
    }

    // Check kit_auth table
    const [authResult] = await connection.execute(
      'SELECT * FROM kit_auth WHERE server_id = ?',
      [serverId]
    );
    console.log(`Kit auth entries:`);
    for (const auth of authResult) {
      console.log(`- Discord ID: ${auth.discord_id === null ? 'NULL' : `"${auth.discord_id}"`}, Kitlist: "${auth.kitlist}"`);
    }

    console.log('\n📋 Step 2: Fix players table Discord ID...');
    await connection.execute(
      'UPDATE players SET discord_id = ? WHERE server_id = ? AND ign = ?',
      [correctDiscordId, serverId, playerName]
    );
    console.log('✅ Updated players table Discord ID');

    console.log('\n📋 Step 3: Fix all kit_auth Discord IDs...');
    for (const auth of authResult) {
      await connection.execute(
        'UPDATE kit_auth SET discord_id = ? WHERE server_id = ? AND kitlist = ?',
        [correctDiscordId, serverId, auth.kitlist]
      );
      console.log(`✅ Updated ${auth.kitlist} Discord ID`);
    }

    console.log('\n📋 Step 4: Clear all cooldown entries...');
    const [deleteResult] = await connection.execute(
      'DELETE FROM kit_cooldowns WHERE server_id = ?',
      [serverId]
    );
    console.log(`✅ Cleared ${deleteResult.affectedRows} cooldown entries`);

    console.log('\n📋 Step 5: Verify all fixes...');
    
    // Verify players table
    const [updatedPlayers] = await connection.execute(
      'SELECT * FROM players WHERE server_id = ?',
      [serverId]
    );
    console.log(`Updated players table:`);
    for (const player of updatedPlayers) {
      console.log(`- IGN: "${player.ign}", Discord ID: ${player.discord_id === null ? 'NULL' : `"${player.discord_id}"`}`);
    }

    // Verify kit_auth table
    const [updatedAuth] = await connection.execute(
      'SELECT * FROM kit_auth WHERE server_id = ?',
      [serverId]
    );
    console.log(`Updated kit auth entries:`);
    for (const auth of updatedAuth) {
      console.log(`- Discord ID: ${auth.discord_id === null ? 'NULL' : `"${auth.discord_id}"`}, Kitlist: "${auth.kitlist}"`);
    }

    console.log('\n📋 Step 6: Test all authorization queries...');
    
    // Test shop player lookup
    const [shopPlayerTest] = await connection.execute(
      `SELECT * FROM players 
       WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
       AND server_id = ?
       AND discord_id = ?
       AND is_active = true`,
      ['1753952654507', serverId, correctDiscordId]
    );
    console.log(`Shop player lookup test: ${shopPlayerTest.length > 0 ? '✅ SUCCESS' : '❌ FAILED'}`);

    // Test VIP authorization
    const [vipTest] = await connection.execute(
      `SELECT ka.* FROM kit_auth ka 
       JOIN players p ON ka.discord_id = p.discord_id 
       WHERE ka.server_id = ? AND p.ign = ? AND ka.kitlist = ?`,
      [serverId, playerName, 'VIPkit']
    );
    console.log(`VIP authorization test: ${vipTest.length > 0 ? '✅ SUCCESS' : '❌ FAILED'}`);

    // Test Elite authorization
    const [eliteTest] = await connection.execute(
      `SELECT ka.* FROM kit_auth ka 
       JOIN players p ON ka.discord_id = p.discord_id 
       WHERE ka.server_id = ? AND p.ign = ? AND ka.kitlist = ?`,
      [serverId, playerName, 'Elite1']
    );
    console.log(`Elite1 authorization test: ${eliteTest.length > 0 ? '✅ SUCCESS' : '❌ FAILED'}`);

    await connection.end();

    console.log('\n🎯 SUMMARY:');
    console.log('✅ Fixed Discord IDs in players table');
    console.log('✅ Fixed Discord IDs in kit_auth table');
    console.log('✅ Cleared all cooldown entries');
    console.log('✅ Shop command should now work');
    console.log('✅ VIP kit authorization should work');
    console.log('✅ Elite kit authorization should work');

    console.log('\n🚀 RESTART THE BOT NOW:');
    console.log('pm2 restart zentro-bot');
    console.log('pm2 logs zentro-bot');

    console.log('\n📝 NEXT STEPS:');
    console.log('1. Test /shop command');
    console.log('2. Test VIP kit claim in-game');
    console.log('3. Test Elite kit claim in-game');
    console.log('4. Check that confirmation messages appear');
    console.log('5. Verify no kit spam occurs');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

fixAllDiscordIdsComprehensive(); 