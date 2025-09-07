const mysql = require('mysql2/promise');
require('dotenv').config();

async function testSingleRestoration() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('🔍 Testing single restoration to identify the conflict...');
    
    // Get a sample missing player from the original query
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
        AND p.server_id != 1
        AND p.discord_id NOT IN (
          SELECT discord_id 
          FROM players 
          WHERE guild_id = 609 AND server_id = 1 AND is_active = TRUE AND discord_id IS NOT NULL
        )
      GROUP BY p.discord_id, p.ign, p.normalized_ign, p.guild_id
      ORDER BY p.ign
      LIMIT 1
    `);

    if (missingPlayers.length === 0) {
      console.log('❌ No missing players found for testing');
      return;
    }

    const testPlayer = missingPlayers[0];
    console.log(`🧪 Testing with player: ${testPlayer.ign} (Discord: ${testPlayer.discord_id})`);
    console.log(`   Linked on: ${testPlayer.linked_servers}`);
    console.log(`   Balances: ${testPlayer.balances}`);

    // Check if there are any existing economy records for this discord_id
    const [existingEconomy] = await connection.execute(`
      SELECT e.player_id, e.balance, e.guild_id, p.server_id, rs.nickname
      FROM economy e
      JOIN players p ON e.player_id = p.id
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.discord_id = ? AND p.guild_id = ?
    `, [testPlayer.discord_id, testPlayer.guild_id]);

    console.log(`\n📊 Existing economy records for this Discord ID:`);
    if (existingEconomy.length > 0) {
      existingEconomy.forEach(record => {
        console.log(`   player_id: ${record.player_id}, balance: ${record.balance}, server: ${record.nickname} (${record.server_id})`);
      });
    } else {
      console.log('   None found');
    }

    // Check current auto-increment value
    const [autoIncrement] = await connection.execute(`
      SELECT AUTO_INCREMENT 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'players'
    `, [process.env.DB_NAME]);
    
    const nextPlayerId = autoIncrement[0].AUTO_INCREMENT;
    console.log(`\n🔢 Next player_id that would be assigned: ${nextPlayerId}`);

    // Check if there's already an economy record with this player_id
    const [conflictCheck] = await connection.execute(`
      SELECT player_id, balance, guild_id
      FROM economy
      WHERE player_id = ?
    `, [nextPlayerId]);

    if (conflictCheck.length > 0) {
      console.log(`🚨 CONFLICT FOUND! Economy record already exists for player_id ${nextPlayerId}:`);
      conflictCheck.forEach(record => {
        console.log(`   player_id: ${record.player_id}, balance: ${record.balance}, guild_id: ${record.guild_id}`);
      });
    } else {
      console.log(`✅ No conflict - player_id ${nextPlayerId} is available in economy table`);
    }

    // Now try the actual restoration process
    console.log(`\n🔧 Attempting restoration for ${testPlayer.ign}...`);
    
    await connection.beginTransaction();
    
    try {
      // Get starting balance
      const [configResult] = await connection.execute(
        'SELECT setting_value FROM eco_games_config WHERE server_id = ? AND setting_name = ?',
        [1, 'starting_balance']
      );
      
      let startingBalance = 0;
      if (configResult.length > 0) {
        startingBalance = parseInt(configResult[0].setting_value) || 0;
      }

      console.log(`   Starting balance: ${startingBalance}`);

      // Insert player record
      const [insertResult] = await connection.execute(`
        INSERT INTO players (guild_id, server_id, discord_id, ign, normalized_ign, linked_at, is_active)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, true)
      `, [
        testPlayer.guild_id,
        1, // server_id for Dead-ops
        testPlayer.discord_id,
        testPlayer.ign,
        testPlayer.normalized_ign
      ]);

      const playerId = insertResult.insertId;
      console.log(`   ✅ Created player record with ID: ${playerId}`);

      // Try to create economy record
      await connection.execute(`
        INSERT INTO economy (player_id, guild_id, balance)
        VALUES (?, ?, ?)
      `, [playerId, testPlayer.guild_id, startingBalance]);

      console.log(`   ✅ Created economy record for player_id: ${playerId}`);

      // Commit transaction
      await connection.commit();
      console.log(`   🎉 Successfully restored ${testPlayer.ign}!`);

      // Clean up - remove the test record
      console.log(`\n🧹 Cleaning up test record...`);
      await connection.execute('DELETE FROM economy WHERE player_id = ?', [playerId]);
      await connection.execute('DELETE FROM players WHERE id = ?', [playerId]);
      console.log(`   ✅ Test record cleaned up`);

    } catch (error) {
      await connection.rollback();
      console.log(`   ❌ Transaction failed: ${error.message}`);
      console.log(`   Error code: ${error.code}`);
      console.log(`   Error errno: ${error.errno}`);
      console.log(`   Error sqlState: ${error.sqlState}`);
      console.log(`   Error sqlMessage: ${error.sqlMessage}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

testSingleRestoration();
