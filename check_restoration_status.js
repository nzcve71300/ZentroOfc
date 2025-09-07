const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkRestorationStatus() {
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

    console.log('🔍 Checking restoration status...');

    // Check total backups
    const [totalBackups] = await connection.execute(`
      SELECT COUNT(*) as count FROM player_balance_backup
    `);

    // Check unprocessed backups
    const [unprocessedBackups] = await connection.execute(`
      SELECT COUNT(*) as count FROM player_balance_backup WHERE restored_at IS NULL
    `);

    // Check processed backups
    const [processedBackups] = await connection.execute(`
      SELECT COUNT(*) as count FROM player_balance_backup WHERE restored_at IS NOT NULL
    `);

    // Get unique players that can be restored
    const [restorablePlayers] = await connection.execute(`
      SELECT 
        guild_id,
        discord_id,
        ign,
        normalized_ign,
        COUNT(*) as server_count,
        GROUP_CONCAT(DISTINCT server_id) as server_ids,
        GROUP_CONCAT(DISTINCT balance) as balances,
        MIN(backed_up_at) as first_backup,
        MAX(backed_up_at) as last_backup
      FROM player_balance_backup 
      WHERE restored_at IS NULL
      GROUP BY guild_id, discord_id, ign, normalized_ign
      ORDER BY guild_id, discord_id
    `);

    // Get current active players
    const [activePlayers] = await connection.execute(`
      SELECT COUNT(*) as count FROM players WHERE is_active = TRUE
    `);

    // Get current economy records
    const [economyRecords] = await connection.execute(`
      SELECT COUNT(*) as count FROM economy
    `);

    console.log('\n📊 Restoration Status Summary:');
    console.log('================================');
    console.log(`📋 Total backup records: ${totalBackups[0].count}`);
    console.log(`🔄 Unprocessed backups: ${unprocessedBackups[0].count}`);
    console.log(`✅ Processed backups: ${processedBackups[0].count}`);
    console.log(`👥 Unique players to restore: ${restorablePlayers.length}`);
    console.log(`🎮 Current active players: ${activePlayers[0].count}`);
    console.log(`💰 Current economy records: ${economyRecords[0].count}`);

    if (restorablePlayers.length > 0) {
      console.log('\n👥 Players Available for Restoration:');
      console.log('=====================================');
      
      restorablePlayers.forEach((player, index) => {
        console.log(`${index + 1}. ${player.ign} (Discord: ${player.discord_id})`);
        console.log(`   Guild ID: ${player.guild_id}`);
        console.log(`   Servers: ${player.server_ids} (${player.server_count} servers)`);
        console.log(`   Balances: ${player.balances}`);
        console.log(`   Backup Date: ${player.first_backup} to ${player.last_backup}`);
        console.log('');
      });

      console.log('💡 To restore all these players, run: node restore_all_unlinked_players.js');
    } else {
      console.log('\n✅ No players need restoration - all backups have been processed!');
    }

    // Check for any potential issues
    console.log('\n🔍 Potential Issues Check:');
    console.log('==========================');
    
    // Check for duplicate active players
    const [duplicateCheck] = await connection.execute(`
      SELECT discord_id, COUNT(*) as count
      FROM players 
      WHERE is_active = TRUE
      GROUP BY discord_id
      HAVING COUNT(*) > 1
    `);

    if (duplicateCheck.length > 0) {
      console.log(`⚠️ Found ${duplicateCheck.length} Discord IDs with multiple active player records:`);
      duplicateCheck.forEach(dup => {
        console.log(`   Discord ID ${dup.discord_id}: ${dup.count} active records`);
      });
    } else {
      console.log('✅ No duplicate active player records found');
    }

    // Check for economy records without players
    const [orphanedEconomy] = await connection.execute(`
      SELECT COUNT(*) as count
      FROM economy e
      LEFT JOIN players p ON e.player_id = p.id
      WHERE p.id IS NULL
    `);

    if (orphanedEconomy[0].count > 0) {
      console.log(`⚠️ Found ${orphanedEconomy[0].count} orphaned economy records (no corresponding player)`);
    } else {
      console.log('✅ No orphaned economy records found');
    }

  } catch (error) {
    console.error('❌ Error checking restoration status:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the check
if (require.main === module) {
  checkRestorationStatus()
    .then(() => {
      console.log('✅ Status check completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Status check failed:', error);
      process.exit(1);
    });
}

module.exports = checkRestorationStatus;
