#!/usr/bin/env node

const mysql = require('mysql2/promise');
require('dotenv').config();

const PLAYER_NAME = 'ttvVenom-killedU';

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

    console.log(`🗑️  Starting deletion of all data for player: ${PLAYER_NAME}`);
    console.log('=' .repeat(60));

    // Start transaction
    await connection.beginTransaction();

    let totalDeleted = 0;

    // 1. Delete from player_homes table
    try {
      const [result1] = await connection.execute(
        'DELETE FROM player_homes WHERE player_name = ?',
        [PLAYER_NAME]
      );
      console.log(`✅ Deleted ${result1.affectedRows} entries from player_homes`);
      totalDeleted += result1.affectedRows;
    } catch (error) {
      console.log(`⚠️  player_homes table not found or error: ${error.message}`);
    }

    // 2. Delete from player_whitelists table
    try {
      const [result2] = await connection.execute(
        'DELETE FROM player_whitelists WHERE player_name = ?',
        [PLAYER_NAME]
      );
      console.log(`✅ Deleted ${result2.affectedRows} entries from player_whitelists`);
      totalDeleted += result2.affectedRows;
    } catch (error) {
      console.log(`⚠️  player_whitelists table not found or error: ${error.message}`);
    }

    // 3. Delete from home_teleport_allowed_users table
    try {
      const [result3] = await connection.execute(
        'DELETE FROM home_teleport_allowed_users WHERE ign = ?',
        [PLAYER_NAME]
      );
      console.log(`✅ Deleted ${result3.affectedRows} entries from home_teleport_allowed_users`);
      totalDeleted += result3.affectedRows;
    } catch (error) {
      console.log(`⚠️  home_teleport_allowed_users table not found or error: ${error.message}`);
    }

    // 4. Delete from home_teleport_banned_users table
    try {
      const [result4] = await connection.execute(
        'DELETE FROM home_teleport_banned_users WHERE ign = ?',
        [PLAYER_NAME]
      );
      console.log(`✅ Deleted ${result4.affectedRows} entries from home_teleport_banned_users`);
      totalDeleted += result4.affectedRows;
    } catch (error) {
      console.log(`⚠️  home_teleport_banned_users table not found or error: ${error.message}`);
    }

    // 5. Delete from players table (this will cascade to related tables)
    try {
      const [result5] = await connection.execute(
        'DELETE FROM players WHERE ign = ?',
        [PLAYER_NAME]
      );
      console.log(`✅ Deleted ${result5.affectedRows} entries from players table`);
      totalDeleted += result5.affectedRows;
    } catch (error) {
      console.log(`⚠️  players table not found or error: ${error.message}`);
    }

    // 6. Delete from app_users table
    try {
      const [result6] = await connection.execute(
        'DELETE FROM app_users WHERE ign = ?',
        [PLAYER_NAME]
      );
      console.log(`✅ Deleted ${result6.affectedRows} entries from app_users`);
      totalDeleted += result6.affectedRows;
    } catch (error) {
      console.log(`⚠️  app_users table not found or error: ${error.message}`);
    }

    // 7. Delete from economy table (legacy)
    try {
      const [result7] = await connection.execute(
        'DELETE e FROM economy e JOIN players p ON e.player_id = p.id WHERE p.ign = ?',
        [PLAYER_NAME]
      );
      console.log(`✅ Deleted ${result7.affectedRows} entries from economy table`);
      totalDeleted += result7.affectedRows;
    } catch (error) {
      console.log(`⚠️  economy table not found or error: ${error.message}`);
    }

    // 8. Delete from player_balances table
    try {
      const [result8] = await connection.execute(
        'DELETE pb FROM player_balances pb JOIN players p ON pb.player_id = p.id WHERE p.ign = ?',
        [PLAYER_NAME]
      );
      console.log(`✅ Deleted ${result8.affectedRows} entries from player_balances`);
      totalDeleted += result8.affectedRows;
    } catch (error) {
      console.log(`⚠️  player_balances table not found or error: ${error.message}`);
    }

    // 9. Delete from server_events table
    try {
      const [result9] = await connection.execute(
        'DELETE se FROM server_events se JOIN players p ON se.player_id = p.id WHERE p.ign = ?',
        [PLAYER_NAME]
      );
      console.log(`✅ Deleted ${result9.affectedRows} entries from server_events`);
      totalDeleted += result9.affectedRows;
    } catch (error) {
      console.log(`⚠️  server_events table not found or error: ${error.message}`);
    }

    // 10. Delete from kit_delivery_queue table
    try {
      const [result10] = await connection.execute(
        'DELETE kdq FROM kit_delivery_queue kdq JOIN players p ON kdq.player_id = p.id WHERE p.ign = ?',
        [PLAYER_NAME]
      );
      console.log(`✅ Deleted ${result10.affectedRows} entries from kit_delivery_queue`);
      totalDeleted += result10.affectedRows;
    } catch (error) {
      console.log(`⚠️  kit_delivery_queue table not found or error: ${error.message}`);
    }

    // 11. Delete from home_teleport_allowed_users (by player_id)
    try {
      const [result11] = await connection.execute(
        'DELETE htau FROM home_teleport_allowed_users htau JOIN players p ON htau.player_id = p.id WHERE p.ign = ?',
        [PLAYER_NAME]
      );
      console.log(`✅ Deleted ${result11.affectedRows} entries from home_teleport_allowed_users (by player_id)`);
      totalDeleted += result11.affectedRows;
    } catch (error) {
      console.log(`⚠️  home_teleport_allowed_users table not found or error: ${error.message}`);
    }

    // 12. Delete from home_teleport_banned_users (by player_id)
    try {
      const [result12] = await connection.execute(
        'DELETE htb FROM home_teleport_banned_users htb JOIN players p ON htb.player_id = p.id WHERE p.ign = ?',
        [PLAYER_NAME]
      );
      console.log(`✅ Deleted ${result12.affectedRows} entries from home_teleport_banned_users (by player_id)`);
      totalDeleted += result12.affectedRows;
    } catch (error) {
      console.log(`⚠️  home_teleport_banned_users table not found or error: ${error.message}`);
    }

    // Commit transaction
    await connection.commit();

    console.log('=' .repeat(60));
    console.log(`🎉 Successfully deleted ${totalDeleted} total entries for player: ${PLAYER_NAME}`);
    console.log('✅ All data has been permanently removed from the database');

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
