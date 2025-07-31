const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixEliteDiscordIdsSSH() {
  console.log('🔧 Fix Elite Discord IDs (SSH Version)');
  console.log('=====================================\n');

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

    console.log('\n📋 Step 1: Checking current elite auth entries...');
    const [authResult] = await connection.execute(
      'SELECT * FROM kit_auth WHERE server_id = ? AND kitlist LIKE "Elite%"',
      [serverId]
    );
    
    console.log(`Found ${authResult.length} elite auth entries:`);
    for (const auth of authResult) {
      console.log(`- Discord ID: ${auth.discord_id === null ? 'NULL' : `"${auth.discord_id}"`}, Kitlist: "${auth.kitlist}"`);
    }

    if (authResult.length === 0) {
      console.log('❌ No elite auth entries found to fix.');
      await connection.end();
      return;
    }

    console.log('\n📋 Step 2: Fixing elite kit Discord IDs...');
    for (const auth of authResult) {
      await connection.execute(
        'UPDATE kit_auth SET discord_id = ? WHERE server_id = ? AND kitlist = ?',
        [correctDiscordId, serverId, auth.kitlist]
      );
      console.log(`✅ Updated ${auth.kitlist} Discord ID`);
    }

    console.log('\n📋 Step 3: Verifying the fix...');
    const [updatedAuth] = await connection.execute(
      'SELECT * FROM kit_auth WHERE server_id = ? AND kitlist LIKE "Elite%"',
      [serverId]
    );
    
    console.log(`Updated elite auth entries:`);
    for (const auth of updatedAuth) {
      console.log(`- Discord ID: ${auth.discord_id === null ? 'NULL' : `"${auth.discord_id}"`}, Kitlist: "${auth.kitlist}"`);
    }

    console.log('\n📋 Step 4: Testing elite JOIN queries...');
    for (const auth of updatedAuth) {
      const [joinTest] = await connection.execute(
        'SELECT ka.* FROM kit_auth ka JOIN players p ON ka.discord_id = p.discord_id WHERE ka.server_id = ? AND p.ign = ? AND ka.kitlist = ?',
        [serverId, 'nzcve7130', auth.kitlist]
      );
      
      console.log(`${auth.kitlist} JOIN test: ${joinTest.length > 0 ? '✅ SUCCESS' : '❌ FAILED'}`);
    }

    await connection.end();

    console.log('\n🎯 SUMMARY:');
    console.log('✅ Fixed Discord IDs for all elite kit entries');
    console.log('✅ Elite kit authorization should now work');

    console.log('\n🚀 RESTART THE BOT NOW:');
    console.log('pm2 restart zentro-bot');
    console.log('pm2 logs zentro-bot');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

fixEliteDiscordIdsSSH(); 