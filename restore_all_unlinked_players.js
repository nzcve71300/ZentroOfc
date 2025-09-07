const mysql = require('mysql2/promise');
require('dotenv').config();

async function restoreAllUnlinkedPlayers() {
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

    console.log('🔄 Starting restoration of all unlinked players...');

    // Get all backed-up players that haven't been restored yet
    const [backupPlayers] = await connection.execute(`
      SELECT DISTINCT 
        guild_id, 
        discord_id, 
        ign, 
        normalized_ign,
        COUNT(*) as server_count,
        GROUP_CONCAT(DISTINCT server_id) as server_ids,
        GROUP_CONCAT(DISTINCT balance) as balances
      FROM player_balance_backup 
      WHERE restored_at IS NULL
      GROUP BY guild_id, discord_id, ign, normalized_ign
      ORDER BY guild_id, discord_id
    `);

    console.log(`📊 Found ${backupPlayers.length} unique players to restore`);

    if (backupPlayers.length === 0) {
      console.log('✅ No players need restoration - all backups have been restored!');
      return;
    }

    let restoredCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const backupPlayer of backupPlayers) {
      try {
        console.log(`\n🔄 Restoring player: ${backupPlayer.ign} (Discord ID: ${backupPlayer.discord_id})`);
        console.log(`   Guild ID: ${backupPlayer.guild_id}, Servers: ${backupPlayer.server_ids}, Balances: ${backupPlayer.balances}`);

        // Get all backup records for this player
        const [playerBackups] = await connection.execute(`
          SELECT server_id, balance, backed_up_at
          FROM player_balance_backup 
          WHERE guild_id = ? AND discord_id = ? AND restored_at IS NULL
          ORDER BY server_id
        `, [backupPlayer.guild_id, backupPlayer.discord_id]);

        // Start transaction for this player
        await connection.beginTransaction();

        try {
          // Restore player records for each server
          for (const backup of playerBackups) {
            console.log(`   📝 Restoring to server ${backup.server_id} with balance ${backup.balance}`);

            // Insert player record
            const [insertResult] = await connection.execute(`
              INSERT INTO players (guild_id, server_id, discord_id, ign, normalized_ign, linked_at, is_active)
              VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, true)
            `, [
              backupPlayer.guild_id,
              backup.server_id,
              backupPlayer.discord_id,
              backupPlayer.ign,
              backupPlayer.normalized_ign
            ]);

            const playerId = insertResult.insertId;
            console.log(`   ✅ Player record created with ID: ${playerId}`);

            // Create economy record with restored balance
            await connection.execute(`
              INSERT INTO economy (player_id, guild_id, balance)
              VALUES (?, ?, ?)
            `, [playerId, backupPlayer.guild_id, backup.balance]);

            console.log(`   💰 Economy record created with balance: ${backup.balance}`);

            // Mark backup as restored
            await connection.execute(`
              UPDATE player_balance_backup 
              SET restored_at = CURRENT_TIMESTAMP
              WHERE guild_id = ? AND discord_id = ? AND server_id = ? AND restored_at IS NULL
            `, [backupPlayer.guild_id, backupPlayer.discord_id, backup.server_id]);

            console.log(`   ✅ Backup marked as restored for server ${backup.server_id}`);
          }

          // Commit transaction for this player
          await connection.commit();
          console.log(`✅ Successfully restored player: ${backupPlayer.ign}`);
          restoredCount++;

        } catch (error) {
          // Rollback transaction for this player
          await connection.rollback();
          throw error;
        }

      } catch (error) {
        console.error(`❌ Failed to restore player ${backupPlayer.ign}:`, error.message);
        errors.push({
          player: backupPlayer.ign,
          discordId: backupPlayer.discord_id,
          error: error.message
        });
        errorCount++;
      }
    }

    // Summary
    console.log('\n🎉 Restoration completed!');
    console.log(`📊 Summary:`);
    console.log(`   ✅ Successfully restored: ${restoredCount} players`);
    console.log(`   ❌ Failed to restore: ${errorCount} players`);

    if (errors.length > 0) {
      console.log(`\n❌ Errors encountered:`);
      errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.player} (${error.discordId}): ${error.error}`);
      });
    }

    // Verify restoration
    console.log('\n🔍 Verifying restoration...');
    const [remainingBackups] = await connection.execute(`
      SELECT COUNT(*) as count FROM player_balance_backup WHERE restored_at IS NULL
    `);
    
    const [activePlayers] = await connection.execute(`
      SELECT COUNT(*) as count FROM players WHERE is_active = TRUE
    `);

    console.log(`📊 Verification results:`);
    console.log(`   🔄 Remaining unprocessed backups: ${remainingBackups[0].count}`);
    console.log(`   👥 Active players in system: ${activePlayers[0].count}`);

    if (remainingBackups[0].count === 0) {
      console.log('✅ All backups have been successfully processed!');
    } else {
      console.log('⚠️ Some backups remain unprocessed - check errors above');
    }

  } catch (error) {
    console.error('❌ Error during restoration process:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the restoration
if (require.main === module) {
  restoreAllUnlinkedPlayers()
    .then(() => {
      console.log('✅ Restoration process completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Restoration process failed:', error);
      process.exit(1);
    });
}

module.exports = restoreAllUnlinkedPlayers;
