const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugTeleportSystem() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('🔍 Debugging Teleport System...\n');

    // Test with a specific server and teleport
    const testServer = 'Emperor 3x';
    const testTeleport = 'tpe';
    const testPlayer = 'YourPlayerName'; // Replace with your actual player name

    console.log(`🧪 Testing with:`);
    console.log(`   Server: ${testServer}`);
    console.log(`   Teleport: ${testTeleport}`);
    console.log(`   Player: ${testPlayer}`);

    // Get server ID
    const [serverResult] = await connection.execute(`
      SELECT rs.id FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id 
      WHERE rs.nickname = ? AND g.discord_id = ?
    `, [testServer, 'YOUR_GUILD_ID']); // Replace with actual guild ID

    if (serverResult.length === 0) {
      console.log('❌ Server not found');
      return;
    }

    const serverId = serverResult[0].id;
    console.log(`   Server ID: ${serverId}`);

    // 1. Check teleport config
    console.log('\n📋 1. Checking teleport config...');
    const [configResult] = await connection.execute(
      'SELECT * FROM teleport_configs WHERE server_id = ? AND teleport_name = ?',
      [serverId.toString(), testTeleport]
    );

    if (configResult.length === 0) {
      console.log('❌ No teleport config found');
      return;
    }

    const config = configResult[0];
    console.log(`   Config found:`);
    console.log(`     - Enabled: ${config.enabled}`);
    console.log(`     - Use List: ${config.use_list}`);
    console.log(`     - Use Kit: ${config.use_kit}`);
    console.log(`     - Kit Name: ${config.kit_name}`);
    console.log(`     - Cooldown: ${config.cooldown_minutes} minutes`);

    // 2. Check if player exists
    console.log('\n👤 2. Checking if player exists...');
    const [playerResult] = await connection.execute(
      'SELECT discord_id FROM players WHERE ign = ? AND server_id = ?',
      [testPlayer, serverId.toString()]
    );

    if (playerResult.length === 0) {
      console.log('❌ Player not found in database');
      return;
    }

    const discordId = playerResult[0].discord_id;
    console.log(`   Player found with Discord ID: ${discordId}`);

    // 3. Check ban list (if use_list is enabled)
    if (config.use_list) {
      console.log('\n🚫 3. Checking ban list...');
      const [bannedResult] = await connection.execute(
        'SELECT * FROM teleport_banned_users WHERE server_id = ? AND teleport_name = ? AND (discord_id = ? OR ign = ?)',
        [serverId.toString(), testTeleport, discordId, testPlayer]
      );

      console.log(`   Ban list entries found: ${bannedResult.length}`);
      if (bannedResult.length > 0) {
        console.log('   ❌ Player is banned!');
        bannedResult.forEach(ban => {
          console.log(`     - Banned by: ${ban.banned_by}`);
          console.log(`     - Discord ID: ${ban.discord_id}`);
          console.log(`     - IGN: ${ban.ign}`);
        });
      } else {
        console.log('   ✅ Player is not banned');
      }

      // 4. Check allowed list
      console.log('\n✅ 4. Checking allowed list...');
      const [allowedResult] = await connection.execute(
        'SELECT * FROM teleport_allowed_users WHERE server_id = ? AND teleport_name = ? AND (discord_id = ? OR ign = ?)',
        [serverId.toString(), testTeleport, discordId, testPlayer]
      );

      console.log(`   Allowed list entries found: ${allowedResult.length}`);
      if (allowedResult.length > 0) {
        console.log('   ✅ Player is allowed!');
        allowedResult.forEach(allowed => {
          console.log(`     - Added by: ${allowed.added_by}`);
          console.log(`     - Discord ID: ${allowed.discord_id}`);
          console.log(`     - IGN: ${allowed.ign}`);
        });
      } else {
        console.log('   ❌ Player is not in allowed list');
      }
    } else {
      console.log('\n⚠️  3. List system is disabled (use_list = false)');
      console.log('   No ban/allowed list checks will be performed');
    }

    // 5. Simulate the teleport decision
    console.log('\n🎯 5. Teleport Decision Logic:');
    
    if (!config.enabled) {
      console.log('   ❌ Teleport is DISABLED');
    } else if (config.use_list) {
      if (bannedResult.length > 0) {
        console.log('   ❌ Player is BANNED - Teleport denied');
      } else if (allowedResult.length === 0) {
        console.log('   ❌ Player not in ALLOWED list - Teleport denied');
      } else {
        console.log('   ✅ Player is ALLOWED - Teleport would proceed');
      }
    } else {
      console.log('   ✅ List system disabled - Teleport would proceed');
    }

    console.log('\n🔧 Debug complete!');

  } catch (error) {
    console.error('❌ Error debugging teleport system:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

debugTeleportSystem();
