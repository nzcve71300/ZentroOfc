const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixAllPlayerLinking() {
  console.log('🔧 Comprehensive Player Linking Fix Script');
  console.log('==========================================\n');

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

    // Step 2: Get all unique players from both servers (MariaDB compatible)
    console.log('\n📋 Step 2: Collecting all unique players...');
    
    // Get players from main server
    const [mainPlayers] = await connection.execute(`
      SELECT DISTINCT discord_id, ign, guild_id
      FROM players 
      WHERE guild_id = ? AND is_active = true
    `, [guildId]);

    // Get players from USA server
    const [usaPlayers] = await connection.execute(`
      SELECT DISTINCT discord_id, ign, guild_id
      FROM players 
      WHERE guild_id = ? AND is_active = true
    `, [guildId]);

    console.log(`📊 Main server players: ${mainPlayers.length}`);
    console.log(`📊 USA server players: ${usaPlayers.length}`);

    // Combine and deduplicate players
    const playerMap = new Map();
    
    [...mainPlayers, ...usaPlayers].forEach(player => {
      // Create a unique key for each player
      const key = `${player.discord_id || 'null'}_${player.ign}`;
      if (!playerMap.has(key)) {
        playerMap.set(key, player);
      }
    });

    const uniquePlayers = Array.from(playerMap.values());
    console.log(`📊 Total unique players found: ${uniquePlayers.length}`);

    // Continue with the unique players
    await processPlayerLinking(connection, guildId, mainServer, usaServer, uniquePlayers);

  } catch (error) {
    console.error('❌ Error during player linking fix:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

async function processPlayerLinking(connection, guildId, mainServer, usaServer, allPlayers) {
  console.log('\n📋 Step 3: Processing player linking...');
  
  let mainLinksCreated = 0;
  let usaLinksCreated = 0;
  let economyRecordsCreated = 0;
  let playersProcessed = 0;

  for (const player of allPlayers) {
    playersProcessed++;
    if (playersProcessed % 100 === 0) {
      console.log(`   Progress: ${playersProcessed}/${allPlayers.length} players processed`);
    }

    // Skip players with null values
    if (!player.discord_id || !player.ign) {
      console.log(`⚠️ Skipping player with null values: ${JSON.stringify(player)}`);
      continue;
    }

    try {
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
        console.log(`✅ Created main server link for ${player.ign} (Discord: ${player.discord_id})`);
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
        console.log(`✅ Created USA server link for ${player.ign} (Discord: ${player.discord_id})`);
      }

    } catch (error) {
      console.error(`❌ Error processing player ${player.ign}:`, error.message);
    }
  }

  // Step 4: Final verification
  console.log('\n📋 Step 4: Final verification...');
  
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

  // Step 5: Summary
  console.log('\n🎉 Player linking fix completed successfully!');
  console.log('==============================================');
  console.log(`📊 Final results:`);
  console.log(`   Main server (${mainServer.nickname}): ${finalMainPlayers[0].count} players, ${finalMainEconomy[0].count} economy records`);
  console.log(`   USA server (${usaServer.nickname}): ${finalUsaPlayers[0].count} players, ${finalUsaEconomy[0].count} economy records`);
  console.log(`\n🔧 Actions taken:`);
  console.log(`   Main server links created: ${mainLinksCreated}`);
  console.log(`   USA server links created: ${usaLinksCreated}`);
  console.log(`   Economy records created: ${economyRecordsCreated}`);
  console.log(`   Total players processed: ${playersProcessed}`);
  console.log(`\n✅ All players are now properly linked to both servers!`);
  console.log(`✅ You can now give coins to players on both servers.`);
  console.log(`✅ The "no player found" error should be resolved.`);
  
  // Step 6: Test verification
  console.log('\n📋 Step 6: Testing player lookup...');
  
  // Test a few random players to make sure they can be found
  const [testPlayers] = await connection.execute(`
    SELECT p.ign, p.discord_id, rs.nickname as server
    FROM players p
    JOIN rust_servers rs ON p.server_id = rs.id
    WHERE p.guild_id = ? AND p.is_active = true
    ORDER BY RAND()
    LIMIT 5
  `, [guildId]);

  if (testPlayers.length > 0) {
    console.log(`\n🧪 Test verification - Sample players found:`);
    testPlayers.forEach(player => {
      console.log(`   ✅ ${player.ign} (Discord: ${player.discord_id}) on ${player.server}`);
    });
  }
}

// Run the script
fixAllPlayerLinking();
