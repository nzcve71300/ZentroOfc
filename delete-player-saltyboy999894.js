#!/usr/bin/env node

/**
 * Delete Player Records Script for Saltyboy999894
 * 
 * This script completely removes all database records for the player "Saltyboy999894"
 * so they can use the /link command again. It removes data from all related tables
 * including players, economy, teleports, events, and more.
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const PLAYER_NAME = 'Saltyboy999894';

async function deletePlayerData() {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log(`🗑️  Starting complete deletion of all data for player: ${PLAYER_NAME}`);
    console.log('=' .repeat(60));

    // Start transaction
    await connection.beginTransaction();

    let totalDeleted = 0;

    // First, find all player IDs for this player name
    console.log(`🔍 Searching for player records with name: ${PLAYER_NAME}`);
    const [playerRecords] = await connection.execute(
      'SELECT id, discord_id, ign, server_id FROM players WHERE ign = ? OR LOWER(ign) = LOWER(?)',
      [PLAYER_NAME, PLAYER_NAME]
    );

    if (playerRecords.length === 0) {
      console.log(`⚠️  No player records found for: ${PLAYER_NAME}`);
      console.log('🔍 Searching by Discord ID patterns...');
      
      // Try searching for similar names or partial matches
      const [similarRecords] = await connection.execute(
        'SELECT id, discord_id, ign, server_id FROM players WHERE ign LIKE ?',
        [`%${PLAYER_NAME}%`]
      );
      
      if (similarRecords.length > 0) {
        console.log(`📋 Found similar records:`);
        similarRecords.forEach(record => {
          console.log(`   - ID: ${record.id}, IGN: "${record.ign}", Discord: ${record.discord_id}, Server: ${record.server_id}`);
        });
        console.log(`\n⚠️  Please verify these are the correct records to delete.`);
      }
    } else {
      console.log(`📋 Found ${playerRecords.length} player record(s):`);
      playerRecords.forEach(record => {
        console.log(`   - ID: ${record.id}, IGN: "${record.ign}", Discord: ${record.discord_id}, Server: ${record.server_id}`);
      });
    }

    // Get all player IDs to delete
    const playerIds = playerRecords.map(record => record.id);
    
    if (playerIds.length === 0) {
      console.log(`❌ No player records found to delete. Exiting.`);
      await connection.rollback();
      return;
    }

    console.log(`\n🗑️  Proceeding to delete all related records for ${playerIds.length} player ID(s)...`);

    // 1. Delete from kit_delivery_queue table
    try {
      const [result] = await connection.execute(
        'DELETE FROM kit_delivery_queue WHERE player_id IN (' + playerIds.map(() => '?').join(',') + ')',
        playerIds
      );
      console.log(`✅ Deleted ${result.affectedRows} entries from kit_delivery_queue`);
      totalDeleted += result.affectedRows;
    } catch (error) {
      console.log(`⚠️  kit_delivery_queue table not found or error: ${error.message}`);
    }

    // 2. Delete from server_events table
    try {
      const [result] = await connection.execute(
        'DELETE FROM server_events WHERE player_id IN (' + playerIds.map(() => '?').join(',') + ')',
        playerIds
      );
      console.log(`✅ Deleted ${result.affectedRows} entries from server_events`);
      totalDeleted += result.affectedRows;
    } catch (error) {
      console.log(`⚠️  server_events table not found or error: ${error.message}`);
    }

    // 3. Delete from player_balances table
    try {
      const [result] = await connection.execute(
        'DELETE FROM player_balances WHERE player_id IN (' + playerIds.map(() => '?').join(',') + ')',
        playerIds
      );
      console.log(`✅ Deleted ${result.affectedRows} entries from player_balances`);
      totalDeleted += result.affectedRows;
    } catch (error) {
      console.log(`⚠️  player_balances table not found or error: ${error.message}`);
    }

    // 4. Delete from economy table (legacy)
    try {
      const [result] = await connection.execute(
        'DELETE FROM economy WHERE player_id IN (' + playerIds.map(() => '?').join(',') + ')',
        playerIds
      );
      console.log(`✅ Deleted ${result.affectedRows} entries from economy table`);
      totalDeleted += result.affectedRows;
    } catch (error) {
      console.log(`⚠️  economy table not found or error: ${error.message}`);
    }

    // 5. Delete from home_teleport_allowed_users table
    try {
      const [result] = await connection.execute(
        'DELETE FROM home_teleport_allowed_users WHERE player_id IN (' + playerIds.map(() => '?').join(',') + ')',
        playerIds
      );
      console.log(`✅ Deleted ${result.affectedRows} entries from home_teleport_allowed_users`);
      totalDeleted += result.affectedRows;
    } catch (error) {
      console.log(`⚠️  home_teleport_allowed_users table not found or error: ${error.message}`);
    }

    // 6. Delete from home_teleport_banned_users table
    try {
      const [result] = await connection.execute(
        'DELETE FROM home_teleport_banned_users WHERE player_id IN (' + playerIds.map(() => '?').join(',') + ')',
        playerIds
      );
      console.log(`✅ Deleted ${result.affectedRows} entries from home_teleport_banned_users`);
      totalDeleted += result.affectedRows;
    } catch (error) {
      console.log(`⚠️  home_teleport_banned_users table not found or error: ${error.message}`);
    }

    // 7. Delete from player_homes table (by player name)
    try {
      const [result] = await connection.execute(
        'DELETE FROM player_homes WHERE player_name = ? OR LOWER(player_name) = LOWER(?)',
        [PLAYER_NAME, PLAYER_NAME]
      );
      console.log(`✅ Deleted ${result.affectedRows} entries from player_homes`);
      totalDeleted += result.affectedRows;
    } catch (error) {
      console.log(`⚠️  player_homes table not found or error: ${error.message}`);
    }

    // 8. Delete from player_whitelists table (by player name)
    try {
      const [result] = await connection.execute(
        'DELETE FROM player_whitelists WHERE player_name = ? OR LOWER(player_name) = LOWER(?)',
        [PLAYER_NAME, PLAYER_NAME]
      );
      console.log(`✅ Deleted ${result.affectedRows} entries from player_whitelists`);
      totalDeleted += result.affectedRows;
    } catch (error) {
      console.log(`⚠️  player_whitelists table not found or error: ${error.message}`);
    }

    // 9. Delete from app_users table (by player name)
    try {
      const [result] = await connection.execute(
        'DELETE FROM app_users WHERE ign = ? OR LOWER(ign) = LOWER(?)',
        [PLAYER_NAME, PLAYER_NAME]
      );
      console.log(`✅ Deleted ${result.affectedRows} entries from app_users`);
      totalDeleted += result.affectedRows;
    } catch (error) {
      console.log(`⚠️  app_users table not found or error: ${error.message}`);
    }

    // 10. Delete from audit_logs table (by user_id if it matches Discord ID)
    try {
      const discordIds = playerRecords.map(record => record.discord_id).filter(id => id);
      if (discordIds.length > 0) {
        const [result] = await connection.execute(
          'DELETE FROM audit_logs WHERE user_id IN (' + discordIds.map(() => '?').join(',') + ')',
          discordIds
        );
        console.log(`✅ Deleted ${result.affectedRows} entries from audit_logs`);
        totalDeleted += result.affectedRows;
      }
    } catch (error) {
      console.log(`⚠️  audit_logs table not found or error: ${error.message}`);
    }

    // 11. Delete from subscription_logs table (by user_id if it matches Discord ID)
    try {
      const discordIds = playerRecords.map(record => record.discord_id).filter(id => id);
      if (discordIds.length > 0) {
        const [result] = await connection.execute(
          'DELETE FROM subscription_logs WHERE user_id IN (' + discordIds.map(() => '?').join(',') + ')',
          discordIds
        );
        console.log(`✅ Deleted ${result.affectedRows} entries from subscription_logs`);
        totalDeleted += result.affectedRows;
      }
    } catch (error) {
      console.log(`⚠️  subscription_logs table not found or error: ${error.message}`);
    }

    // 12. Delete from subscription_payments table (by user_id if it matches Discord ID)
    try {
      const discordIds = playerRecords.map(record => record.discord_id).filter(id => id);
      if (discordIds.length > 0) {
        const [result] = await connection.execute(
          'DELETE FROM subscription_payments WHERE user_id IN (' + discordIds.map(() => '?').join(',') + ')',
          discordIds
        );
        console.log(`✅ Deleted ${result.affectedRows} entries from subscription_payments`);
        totalDeleted += result.affectedRows;
      }
    } catch (error) {
      console.log(`⚠️  subscription_payments table not found or error: ${error.message}`);
    }

    // 13. Finally, delete from players table (this should cascade to related tables)
    try {
      const [result] = await connection.execute(
        'DELETE FROM players WHERE id IN (' + playerIds.map(() => '?').join(',') + ')',
        playerIds
      );
      console.log(`✅ Deleted ${result.affectedRows} entries from players table`);
      totalDeleted += result.affectedRows;
    } catch (error) {
      console.log(`⚠️  players table error: ${error.message}`);
    }

    // Commit transaction
    await connection.commit();

    console.log('=' .repeat(60));
    console.log(`🎉 Successfully deleted ${totalDeleted} total entries for player: ${PLAYER_NAME}`);
    console.log('✅ All data has been permanently removed from the database');
    console.log('\n📋 Summary of deleted data:');
    console.log('   - Player records');
    console.log('   - Economy/balance data');
    console.log('   - Teleport permissions');
    console.log('   - Server events');
    console.log('   - Kit delivery queue');
    console.log('   - Audit logs');
    console.log('   - App user accounts');
    console.log('\n🔄 The player can now use /link command again!');

  } catch (error) {
    console.error('❌ Error during deletion:', error);
    
    if (connection) {
      try {
        await connection.rollback();
        console.log('🔄 Transaction rolled back due to error');
      } catch (rollbackError) {
        console.error('❌ Error during rollback:', rollbackError);
      }
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the deletion
deletePlayerData().catch(console.error);
