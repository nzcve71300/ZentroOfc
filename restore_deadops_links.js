const mysql = require('mysql2/promise');
require('dotenv').config();

async function restoreDeadOpsLinks() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('🔍 Finding players with missing Dead-ops server links...');

    // Get the Dead-ops servers specifically
    const [deadOpsServers] = await connection.execute(`
      SELECT id, nickname, guild_id FROM rust_servers 
      WHERE guild_id = 609 AND (nickname LIKE '%Dead%' OR nickname LIKE '%dead%')
      ORDER BY nickname
    `);

    console.log(`📋 Found ${deadOpsServers.length} Dead-ops servers:`);
    deadOpsServers.forEach(server => {
      console.log(`   - ${server.nickname} (ID: ${server.id})`);
    });

    if (deadOpsServers.length < 2) {
      console.log('❌ Need at least 2 Dead-ops servers to perform cross-linking');
      return;
    }

    let totalRestored = 0;
    const restorationLog = [];

    // For each Dead-ops server, find players who are linked on other Dead-ops servers but missing on this one
    for (const targetServer of deadOpsServers) {
      console.log(`\n🔍 Checking server: ${targetServer.nickname} (${targetServer.id})`);
      
      // Find players who are linked on other Dead-ops servers but not on this server
      const [missingPlayers] = await connection.execute(`
        SELECT DISTINCT
          p.discord_id,
          p.ign,
          p.normalized_ign,
          p.guild_id,
          COUNT(DISTINCT p.server_id) as linked_server_count,
          GROUP_CONCAT(DISTINCT rs.nickname ORDER BY rs.nickname) as linked_servers,
          GROUP_CONCAT(DISTINCT e.balance ORDER BY e.balance) as balances
        FROM players p
        JOIN rust_servers rs ON p.server_id = rs.id
        LEFT JOIN economy e ON p.id = e.player_id
        WHERE p.guild_id = 609 
          AND p.is_active = TRUE 
          AND p.discord_id IS NOT NULL
          AND p.server_id != ?
          AND rs.nickname LIKE '%Dead%'
          AND p.discord_id NOT IN (
            SELECT discord_id 
            FROM players 
            WHERE guild_id = 609 AND server_id = ? AND is_active = TRUE AND discord_id IS NOT NULL
          )
        GROUP BY p.discord_id, p.ign, p.normalized_ign, p.guild_id
        ORDER BY p.ign
      `, [targetServer.id, targetServer.id]);

      console.log(`   📊 Found ${missingPlayers.length} players missing on ${targetServer.nickname}`);

      if (missingPlayers.length === 0) {
        console.log(`   ✅ All players are properly linked on ${targetServer.nickname}`);
        continue;
      }

      // Show some examples
      const examples = missingPlayers.slice(0, 5);
      console.log(`   📋 Examples of missing players:`);
      examples.forEach((player, index) => {
        console.log(`      ${index + 1}. ${player.ign} (Discord: ${player.discord_id})`);
        console.log(`         Linked on: ${player.linked_servers} (${player.linked_server_count} servers)`);
        console.log(`         Balances: ${player.balances}`);
      });

      if (missingPlayers.length > 5) {
        console.log(`      ... and ${missingPlayers.length - 5} more players`);
      }

      console.log(`\n   🔧 Restoring ${missingPlayers.length} missing links on ${targetServer.nickname}...`);

      let serverRestored = 0;
      const serverErrors = [];

      for (const player of missingPlayers) {
        try {
          // Get the starting balance for this server
          const [configResult] = await connection.execute(
            'SELECT setting_value FROM eco_games_config WHERE server_id = ? AND setting_name = ?',
            [targetServer.id, 'starting_balance']
          );
          
          let startingBalance = 0;
          if (configResult.length > 0) {
            startingBalance = parseInt(configResult[0].setting_value) || 0;
          }

          // Start transaction for this player
          await connection.beginTransaction();

          try {
            // Insert player record for this server
            const [insertResult] = await connection.execute(`
              INSERT INTO players (guild_id, server_id, discord_id, ign, normalized_ign, linked_at, is_active)
              VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, true)
            `, [
              player.guild_id,
              targetServer.id,
              player.discord_id,
              player.ign,
              player.normalized_ign
            ]);

            const playerId = insertResult.insertId;

            // Create economy record with starting balance
            await connection.execute(`
              INSERT INTO economy (player_id, guild_id, balance)
              VALUES (?, ?, ?)
            `, [playerId, player.guild_id, startingBalance]);

            // Commit transaction
            await connection.commit();

            console.log(`      ✅ Restored ${player.ign} on ${targetServer.nickname} (Balance: ${startingBalance})`);
            serverRestored++;

            restorationLog.push({
              player: player.ign,
              discordId: player.discord_id,
              server: targetServer.nickname,
              balance: startingBalance,
              status: 'success'
            });

          } catch (error) {
            // Rollback transaction
            await connection.rollback();
            throw error;
          }

        } catch (error) {
          console.log(`      ❌ Failed to restore ${player.ign}: ${error.message}`);
          serverErrors.push({
            player: player.ign,
            discordId: player.discord_id,
            error: error.message
          });

          restorationLog.push({
            player: player.ign,
            discordId: player.discord_id,
            server: targetServer.nickname,
            balance: 0,
            status: 'failed',
            error: error.message
          });
        }
      }

      console.log(`   📊 Server ${targetServer.nickname} results:`);
      console.log(`      ✅ Successfully restored: ${serverRestored} players`);
      console.log(`      ❌ Failed to restore: ${serverErrors.length} players`);

      if (serverErrors.length > 0) {
        console.log(`      🚨 Errors:`);
        serverErrors.forEach(error => {
          console.log(`         - ${error.player}: ${error.error}`);
        });
      }

      totalRestored += serverRestored;
    }

    // Final summary
    console.log(`\n🎉 Restoration completed!`);
    console.log(`📊 Total players restored across all Dead-ops servers: ${totalRestored}`);

    // Show detailed log
    const successfulRestorations = restorationLog.filter(log => log.status === 'success');
    const failedRestorations = restorationLog.filter(log => log.status === 'failed');

    console.log(`\n📋 Detailed Results:`);
    console.log(`   ✅ Successful restorations: ${successfulRestorations.length}`);
    console.log(`   ❌ Failed restorations: ${failedRestorations.length}`);

    if (successfulRestorations.length > 0) {
      console.log(`\n✅ Successfully Restored Players:`);
      successfulRestorations.forEach((log, index) => {
        console.log(`   ${index + 1}. ${log.player} → ${log.server} (Balance: ${log.balance})`);
      });
    }

    if (failedRestorations.length > 0) {
      console.log(`\n❌ Failed Restorations:`);
      failedRestorations.forEach((log, index) => {
        console.log(`   ${index + 1}. ${log.player} → ${log.server}: ${log.error}`);
      });
    }

    // Verify final state
    console.log(`\n🔍 Final verification:`);
    for (const server of deadOpsServers) {
      const [serverPlayerCount] = await connection.execute(`
        SELECT COUNT(*) as count 
        FROM players 
        WHERE server_id = ? AND is_active = TRUE AND discord_id IS NOT NULL
      `, [server.id]);

      console.log(`   ${server.nickname}: ${serverPlayerCount[0].count} linked players`);
    }

  } catch (error) {
    console.error('❌ Error during restoration:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the restoration
if (require.main === module) {
  restoreDeadOpsLinks()
    .then(() => {
      console.log('✅ Restoration process completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Restoration process failed:', error);
      process.exit(1);
    });
}

module.exports = restoreDeadOpsLinks;
