const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixKitIssuesComprehensive() {
  console.log('🔧 Comprehensive Kit Issues Fix');
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

    console.log('\n📋 Step 1: Fix all Discord IDs in kit_auth...');
    const [authResult] = await connection.execute(
      'SELECT * FROM kit_auth WHERE server_id = ?',
      [serverId]
    );
    
    console.log(`Found ${authResult.length} kit auth entries to fix:`);
    for (const auth of authResult) {
      console.log(`- Discord ID: ${auth.discord_id === null ? 'NULL' : `"${auth.discord_id}"`}, Kitlist: "${auth.kitlist}"`);
    }

    // Fix all Discord IDs
    for (const auth of authResult) {
      await connection.execute(
        'UPDATE kit_auth SET discord_id = ? WHERE server_id = ? AND kitlist = ?',
        [correctDiscordId, serverId, auth.kitlist]
      );
      console.log(`✅ Updated ${auth.kitlist} Discord ID`);
    }

    console.log('\n📋 Step 2: Clear all cooldown entries to fix spam issue...');
    const [deleteResult] = await connection.execute(
      'DELETE FROM kit_cooldowns WHERE server_id = ?',
      [serverId]
    );
    console.log(`✅ Cleared ${deleteResult.affectedRows} cooldown entries`);

    console.log('\n📋 Step 3: Verify the fixes...');
    const [updatedAuth] = await connection.execute(
      'SELECT * FROM kit_auth WHERE server_id = ?',
      [serverId]
    );
    
    console.log(`Updated kit auth entries:`);
    for (const auth of updatedAuth) {
      console.log(`- Discord ID: ${auth.discord_id === null ? 'NULL' : `"${auth.discord_id}"`}, Kitlist: "${auth.kitlist}"`);
    }

    const [remainingCooldowns] = await connection.execute(
      'SELECT COUNT(*) as count FROM kit_cooldowns WHERE server_id = ?',
      [serverId]
    );
    console.log(`Remaining cooldown entries: ${remainingCooldowns[0].count}`);

    console.log('\n📋 Step 4: Test authorization queries...');
    const testPlayer = 'nzcve7130';
    
    // Test VIP authorization
    const [vipTest] = await connection.execute(
      `SELECT ka.* FROM kit_auth ka 
       JOIN players p ON ka.discord_id = p.discord_id 
       WHERE ka.server_id = ? AND p.ign = ? AND ka.kitlist = ?`,
      [serverId, testPlayer, 'VIPkit']
    );
    console.log(`VIP authorization test: ${vipTest.length > 0 ? '✅ SUCCESS' : '❌ FAILED'}`);

    // Test Elite authorization
    const [eliteTest] = await connection.execute(
      `SELECT ka.* FROM kit_auth ka 
       JOIN players p ON ka.discord_id = p.discord_id 
       WHERE ka.server_id = ? AND p.ign = ? AND ka.kitlist = ?`,
      [serverId, testPlayer, 'Elite1']
    );
    console.log(`Elite1 authorization test: ${eliteTest.length > 0 ? '✅ SUCCESS' : '❌ FAILED'}`);

    await connection.end();

    console.log('\n🎯 SUMMARY:');
    console.log('✅ Fixed Discord IDs for all kit auth entries');
    console.log('✅ Cleared all cooldown entries to prevent spam');
    console.log('✅ Authorization queries should now work');
    console.log('✅ Kit claims should work without spam');

    console.log('\n🚀 RESTART THE BOT NOW:');
    console.log('pm2 restart zentro-bot');
    console.log('pm2 logs zentro-bot');

    console.log('\n📝 NEXT STEPS:');
    console.log('1. Test VIP kit claim in-game');
    console.log('2. Test Elite kit claim in-game');
    console.log('3. Check that confirmation messages appear');
    console.log('4. Verify no kit spam occurs');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

fixKitIssuesComprehensive(); 