const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixPlayerLinking() {
  console.log('🔧 Fixing Player Linking Between Servers');
  console.log('========================================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    // Step 1: Find the guild and servers
    console.log('📋 Step 1: Finding guild and servers...');
    
    const [guilds] = await connection.execute(`
      SELECT DISTINCT g.id, g.discord_id, g.name
      FROM guilds g
      JOIN rust_servers rs ON g.id = rs.guild_id
      WHERE rs.nickname IN ('Dead-ops', 'USA-DeadOps')
      ORDER BY g.id ASC
    `);
    
    if (guilds.length === 0) {
      console.log('❌ No guild found containing both Dead-ops and USA-DeadOps!');
      return;
    }
    
    const guildId = guilds[0].id;
    console.log(`✅ Found guild: ${guilds[0].name} (ID: ${guildId})`);
    
    // Get both servers
    const [servers] = await connection.execute(`
      SELECT id, nickname, guild_id
      FROM rust_servers 
      WHERE guild_id = ? AND nickname IN ('Dead-ops', 'USA-DeadOps')
      ORDER BY nickname
    `, [guildId]);

    if (servers.length < 2) {
      console.log('❌ Not all servers found!');
      return;
    }

    const mainServer = servers.find(s => s.nickname === 'Dead-ops');
    const usaServer = servers.find(s => s.nickname === 'USA-DeadOps');

    console.log(`✅ Main server: ${mainServer.nickname} (ID: ${mainServer.id})`);
    console.log(`✅ USA server: ${usaServer.nickname} (ID: ${usaServer.id})`);

    // Step 2: Get all unique players across both servers
    console.log('\n📋 Step 2: Getting all unique players...');
    
    const [allPlayers] = await connection.execute(`
      SELECT DISTINCT p.discord_id, p.ign, p.guild_id
      FROM players p
      WHERE p.guild_id = ? AND p.is_active = true
    `, [guildId]);

    console.log(`📊 Found ${allPlayers.length} unique active players in guild`);

    if (allPlayers.length === 0) {
      console.log('ℹ️ No players found in guild - nothing to fix');
      return;
    }

    // Step 3: Check current linking status
    console.log('\n📋 Step 3: Checking current linking status...');
    
    let playersLinkedToMain = 0;
    let playersLinkedToUsa = 0;
    let playersLinkedToBoth = 0;
    let playersLinkedToNeither = 0;

    for (const player of allPlayers) {
      const [mainLink] = await connection.execute(`
        SELECT id FROM players 
        WHERE guild_id = ? AND discord_id = ? AND server_id = ? AND is_active = true
      `, [guildId, player.discord_id, mainServer.id]);

      const [usaLink] = await connection.execute(`
        SELECT id FROM players 
        WHERE guild_id = ? AND discord_id = ? AND server_id = ? AND is_active = true
      `, [guildId, player.discord_id, usaServer.id]);

      if (mainLink.length > 0 && usaLink.length > 0) {
        playersLinkedToBoth++;
      } else if (mainLink.length > 0) {
        playersLinkedToMain++;
      } else if (usaLink.length > 0) {
        playersLinkedToUsa++;
      } else {
        playersLinkedToNeither++;
      }
    }

    console.log(`📊 Current linking status:`);
    console.log(`   Linked to both servers: ${playersLinkedToBoth}`);
    console.log(`   Linked to main only: ${playersLinkedToMain}`);
    console.log(`   Linked to USA only: ${playersLinkedToUsa}`);
    console.log(`   Not linked to either: ${playersLinkedToNeither}`);

    // Step 4: Fix missing links
    console.log('\n📋 Step 4: Fixing missing links...');
    
    let mainLinksCreated = 0;
    let usaLinksCreated = 0;
    let economyRecordsCreated = 0;

    for (const player of allPlayers) {
      // Check if linked to main server
      const [mainLink] = await connection.execute(`
        SELECT id FROM players 
        WHERE guild_id = ? AND discord_id = ? AND server_id = ? AND is_active = true
      `, [guildId, player.discord_id, mainServer.id]);

      if (mainLink.length === 0) {
        // Create link to main server
        const [mainResult] = await connection.execute(`
          INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, true)
        `, [guildId, mainServer.id, player.discord_id, player.ign]);

        // Create economy record for main server
        await connection.execute(`
          INSERT INTO economy (player_id, balance, guild_id) VALUES (?, 0, ?)
        `, [mainResult.insertId, guildId]);

        mainLinksCreated++;
        economyRecordsCreated++;
        console.log(`✅ Created main server link for ${player.ign}`);
      }

      // Check if linked to USA server
      const [usaLink] = await connection.execute(`
        SELECT id FROM players 
        WHERE guild_id = ? AND discord_id = ? AND server_id = ? AND is_active = true
      `, [guildId, player.discord_id, usaServer.id]);

      if (usaLink.length === 0) {
        // Create link to USA server
        const [usaResult] = await connection.execute(`
          INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, true)
        `, [guildId, usaServer.id, player.discord_id, player.ign]);

        // Create economy record for USA server
        await connection.execute(`
          INSERT INTO economy (player_id, balance, guild_id) VALUES (?, 0, ?)
        `, [usaResult.insertId, guildId]);

        usaLinksCreated++;
        economyRecordsCreated++;
        console.log(`✅ Created USA server link for ${player.ign}`);
      }
    }

    // Step 5: Final verification
    console.log('\n📋 Step 5: Final verification...');
    
    const [finalMainPlayers] = await connection.execute(`
      SELECT COUNT(*) as count FROM players WHERE server_id = ? AND is_active = true
    `, [mainServer.id]);

    const [finalUsaPlayers] = await connection.execute(`
      SELECT COUNT(*) as count FROM players WHERE server_id = ? AND is_active = true
    `, [usaServer.id]);

    const [finalMainEconomy] = await connection.execute(`
      SELECT COUNT(*) as count FROM economy e
      JOIN players p ON e.player_id = p.id
      WHERE p.server_id = ? AND p.is_active = true
    `, [mainServer.id]);

    const [finalUsaEconomy] = await connection.execute(`
      SELECT COUNT(*) as count FROM economy e
      JOIN players p ON e.player_id = p.id
      WHERE p.server_id = ? AND p.is_active = true
    `, [usaServer.id]);

    console.log(`\n🎉 Player linking fix completed successfully!`);
    console.log(`📊 Final results:`);
    console.log(`   Main server (${mainServer.nickname}): ${finalMainPlayers[0].count} players, ${finalMainEconomy[0].count} economy records`);
    console.log(`   USA server (${usaServer.nickname}): ${finalUsaPlayers[0].count} players, ${finalUsaEconomy[0].count} economy records`);
    console.log(`\n🔧 Actions taken:`);
    console.log(`   Main server links created: ${mainLinksCreated}`);
    console.log(`   USA server links created: ${usaLinksCreated}`);
    console.log(`   Economy records created: ${economyRecordsCreated}`);
    console.log(`\n✅ All players are now properly linked to both servers!`);
    console.log(`✅ You can now give coins to players on both servers.`);

  } catch (error) {
    console.error('❌ Error during player linking fix:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

fixPlayerLinking(); 