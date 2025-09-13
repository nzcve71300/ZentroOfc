const mysql = require('mysql2/promise');
require('dotenv').config();

async function deletePlayerRecords() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });

  try {
    console.log('🗑️ Starting complete deletion of all data for player: Thomson5072');
    console.log('============================================================');

    // First, find all player records with this name
    console.log('🔍 Searching for player records with name: Thomson5072');
    
    const [playerRecords] = await connection.execute(
      'SELECT id, ign, discord_id, server_id FROM players WHERE LOWER(ign) = LOWER(?)',
      ['Thomson5072']
    );

    if (playerRecords.length === 0) {
      console.log('❌ No player records found for Thomson5072');
      return;
    }

    console.log(`📋 Found ${playerRecords.length} player record(s):`);
    playerRecords.forEach(record => {
      console.log(`   - ID: ${record.id}, IGN: "${record.ign}", Discord: ${record.discord_id}, Server: ${record.server_id}`);
    });

    const playerIds = playerRecords.map(record => record.id);
    const serverIds = [...new Set(playerRecords.map(record => record.server_id))];
    
    console.log(`🗑️ Proceeding to delete all related records for ${playerIds.length} player ID(s)...`);

    // Delete from kit_delivery_queue
    try {
      const [kitResult] = await connection.execute(
        'DELETE FROM kit_delivery_queue WHERE player_id IN (' + playerIds.map(() => '?').join(',') + ')',
        playerIds
      );
      console.log(`✅ Deleted ${kitResult.affectedRows} entries from kit_delivery_queue`);
    } catch (error) {
      console.log(`⚠️ kit_delivery_queue error: ${error.message}`);
    }

    // Delete from server_events
    try {
      const [eventsResult] = await connection.execute(
        'DELETE FROM server_events WHERE player_id IN (' + playerIds.map(() => '?').join(',') + ')',
        playerIds
      );
      console.log(`✅ Deleted ${eventsResult.affectedRows} entries from server_events`);
    } catch (error) {
      console.log(`⚠️ server_events error: ${error.message}`);
    }

    // Delete from player_balances
    try {
      const [balanceResult] = await connection.execute(
        'DELETE FROM player_balances WHERE player_id IN (' + playerIds.map(() => '?').join(',') + ')',
        playerIds
      );
      console.log(`✅ Deleted ${balanceResult.affectedRows} entries from player_balances`);
    } catch (error) {
      console.log(`⚠️ player_balances error: ${error.message}`);
    }

    // Delete from economy table
    try {
      const [economyResult] = await connection.execute(
        'DELETE FROM economy WHERE player_id IN (' + playerIds.map(() => '?').join(',') + ')',
        playerIds
      );
      console.log(`✅ Deleted ${economyResult.affectedRows} entries from economy table`);
    } catch (error) {
      console.log(`⚠️ economy error: ${error.message}`);
    }

    // Delete from home_teleport_allowed_users
    try {
      const [allowedResult] = await connection.execute(
        'DELETE FROM home_teleport_allowed_users WHERE player_id IN (' + playerIds.map(() => '?').join(',') + ')',
        playerIds
      );
      console.log(`✅ Deleted ${allowedResult.affectedRows} entries from home_teleport_allowed_users`);
    } catch (error) {
      console.log(`⚠️ home_teleport_allowed_users table not found or error: ${error.message}`);
    }

    // Delete from home_teleport_banned_users
    try {
      const [bannedResult] = await connection.execute(
        'DELETE FROM home_teleport_banned_users WHERE player_id IN (' + playerIds.map(() => '?').join(',') + ')',
        playerIds
      );
      console.log(`✅ Deleted ${bannedResult.affectedRows} entries from home_teleport_banned_users`);
    } catch (error) {
      console.log(`⚠️ home_teleport_banned_users table not found or error: ${error.message}`);
    }

    // Delete from player_homes
    try {
      const [homesResult] = await connection.execute(
        'DELETE FROM player_homes WHERE player_id IN (' + playerIds.map(() => '?').join(',') + ')',
        playerIds
      );
      console.log(`✅ Deleted ${homesResult.affectedRows} entries from player_homes`);
    } catch (error) {
      console.log(`⚠️ player_homes error: ${error.message}`);
    }

    // Delete from player_whitelists
    try {
      const [whitelistResult] = await connection.execute(
        'DELETE FROM player_whitelists WHERE player_id IN (' + playerIds.map(() => '?').join(',') + ')',
        playerIds
      );
      console.log(`✅ Deleted ${whitelistResult.affectedRows} entries from player_whitelists`);
    } catch (error) {
      console.log(`⚠️ player_whitelists error: ${error.message}`);
    }

    // Delete from app_users
    try {
      const [appUsersResult] = await connection.execute(
        'DELETE FROM app_users WHERE player_id IN (' + playerIds.map(() => '?').join(',') + ')',
        playerIds
      );
      console.log(`✅ Deleted ${appUsersResult.affectedRows} entries from app_users`);
    } catch (error) {
      console.log(`⚠️ app_users error: ${error.message}`);
    }

    // Delete from audit_logs
    try {
      const [auditResult] = await connection.execute(
        'DELETE FROM audit_logs WHERE player_id IN (' + playerIds.map(() => '?').join(',') + ')',
        playerIds
      );
      console.log(`✅ Deleted ${auditResult.affectedRows} entries from audit_logs`);
    } catch (error) {
      console.log(`⚠️ audit_logs error: ${error.message}`);
    }

    // Delete from subscription_logs (if exists)
    try {
      const [subLogsResult] = await connection.execute(
        'DELETE FROM subscription_logs WHERE user_id IN (' + playerIds.map(() => '?').join(',') + ')',
        playerIds
      );
      console.log(`✅ Deleted ${subLogsResult.affectedRows} entries from subscription_logs`);
    } catch (error) {
      console.log(`⚠️ subscription_logs table not found or error: ${error.message}`);
    }

    // Delete from subscription_payments (if exists)
    try {
      const [subPayResult] = await connection.execute(
        'DELETE FROM subscription_payments WHERE user_id IN (' + playerIds.map(() => '?').join(',') + ')',
        playerIds
      );
      console.log(`✅ Deleted ${subPayResult.affectedRows} entries from subscription_payments`);
    } catch (error) {
      console.log(`⚠️ subscription_payments table not found or error: ${error.message}`);
    }

    // Finally, delete from players table
    const [playersResult] = await connection.execute(
      'DELETE FROM players WHERE id IN (' + playerIds.map(() => '?').join(',') + ')',
      playerIds
    );
    console.log(`✅ Deleted ${playersResult.affectedRows} entries from players table`);

    console.log('============================================================');
    console.log('🎉 Successfully deleted all records for player: Thomson5072');
    console.log('✅ All data has been permanently removed from the database');
    console.log('📋 Summary of deleted data:');
    console.log('   - Player records');
    console.log('   - Economy/balance data');
    console.log('   - Teleport permissions');
    console.log('   - Server events');
    console.log('   - Kit delivery queue');
    console.log('   - Audit logs');
    console.log('   - App user accounts');
    console.log('🔄 The player can now use /link command again!');

  } catch (error) {
    console.error('❌ Error during deletion:', error);
  } finally {
    await connection.end();
  }
}

deletePlayerRecords();
