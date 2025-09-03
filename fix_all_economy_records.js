const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixAllEconomyRecords() {
  console.log('🔧 Fix ALL Economy Records Script');
  console.log('=================================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    // Step 1: Find both servers
    console.log('📋 Step 1: Finding both servers...');
    const [servers] = await connection.execute(`
      SELECT id, nickname, guild_id
      FROM rust_servers 
      WHERE nickname IN ('Dead-ops', 'USA-DeadOps')
      ORDER BY nickname
    `);

    if (servers.length < 2) {
      console.log('❌ Not all servers found!');
      return;
    }

    const deadOpsServer = servers.find(s => s.nickname === 'Dead-ops');
    const usaServer = servers.find(s => s.nickname === 'USA-DeadOps');

    console.log(`✅ Found Dead-ops server: ${deadOpsServer.nickname} (ID: ${deadOpsServer.id})`);
    console.log(`✅ Found USA-DeadOps server: ${usaServer.nickname} (ID: ${usaServer.id})`);

    // Step 2: Process each server
    const allServers = [deadOpsServer, usaServer];
    let totalPlayersProcessed = 0;
    let totalEconomyRecordsCreated = 0;

    for (const server of allServers) {
      console.log(`\n📋 Step 2: Processing ${server.nickname} server...`);
      console.log('=' + '='.repeat(server.nickname.length + 20));

      // Find all players on this server
      const [players] = await connection.execute(`
        SELECT p.id, p.ign, p.discord_id, p.guild_id
        FROM players p
        WHERE p.server_id = ? AND p.is_active = true
        ORDER BY p.ign
      `, [server.id]);

      console.log(`📊 Found ${players.length} players on ${server.nickname} server`);

      // Check which players are missing economy records
      let missingEconomyCount = 0;
      let createdEconomyCount = 0;

      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        
        // Show progress every 100 players
        if ((i + 1) % 100 === 0) {
          console.log(`   Progress: ${i + 1}/${players.length} players processed`);
        }

        const [economyRecords] = await connection.execute(`
          SELECT id FROM economy WHERE player_id = ?
        `, [player.id]);

        if (economyRecords.length === 0) {
          missingEconomyCount++;
          
          // Create the missing economy record
          try {
            const [result] = await connection.execute(`
              INSERT INTO economy (player_id, balance, guild_id) VALUES (?, 0, ?)
            `, [player.id, player.guild_id]);
            
            createdEconomyCount++;
            
            // Only log the first few and last few to avoid spam
            if (missingEconomyCount <= 5 || missingEconomyCount > missingEconomyCount - 5) {
              console.log(`   ✅ Created economy record for ${player.ign} (ID: ${result.insertId})`);
            } else if (missingEconomyCount === 6) {
              console.log(`   ... (and ${missingEconomyCount - 10} more)`);
            }
          } catch (error) {
            console.log(`   ❌ Failed to create economy record for ${player.ign}: ${error.message}`);
          }
        }
      }

      console.log(`\n📊 ${server.nickname} Server Summary:`);
      console.log(`   Total players: ${players.length}`);
      console.log(`   Missing economy records: ${missingEconomyCount}`);
      console.log(`   Economy records created: ${createdEconomyCount}`);

      totalPlayersProcessed += players.length;
      totalEconomyRecordsCreated += createdEconomyCount;
    }

    // Step 3: Final verification
    console.log('\n📋 Step 3: Final verification...');
    console.log('==================================');

    for (const server of allServers) {
      const [finalPlayerCount] = await connection.execute(`
        SELECT COUNT(*) as count FROM players WHERE server_id = ? AND is_active = true
      `, [server.id]);

      const [finalEconomyCount] = await connection.execute(`
        SELECT COUNT(*) as count FROM economy e
        JOIN players p ON e.player_id = p.id
        WHERE p.server_id = ? AND p.is_active = true
      `, [server.id]);

      console.log(`📊 ${server.nickname}: ${finalPlayerCount[0].count} players, ${finalEconomyCount[0].count} economy records`);
    }

    // Step 4: Summary
    console.log('\n🎉 ALL Economy Records Fix Completed!');
    console.log('======================================');
    console.log(`📊 Total players processed: ${totalPlayersProcessed}`);
    console.log(`🔧 Total economy records created: ${totalEconomyRecordsCreated}`);
    
    if (totalEconomyRecordsCreated > 0) {
      console.log(`\n✅ All missing economy records have been created!`);
      console.log(`✅ Players should now be able to receive currency properly on BOTH servers.`);
      console.log(`✅ Try adding currency to Y03Xx again - it should work now.`);
      console.log(`✅ The "New Balance: 0" issue should be resolved.`);
    } else {
      console.log(`\nℹ️ No missing economy records found. All players already have economy records.`);
    }

    // Step 5: Test a specific player
    console.log('\n📋 Step 5: Testing specific player (Y03Xx)...');
    console.log('=============================================');

    const [testPlayer] = await connection.execute(`
      SELECT p.id, p.ign, rs.nickname as server_name
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.ign = 'Y03Xx' AND p.is_active = true
      ORDER BY rs.nickname
    `);

    if (testPlayer.length > 0) {
      console.log(`✅ Found Y03Xx on ${testPlayer.length} server(s):`);
      testPlayer.forEach(player => {
        console.log(`   📍 ${player.ign} on ${player.server_name} (ID: ${player.id})`);
      });

      // Check economy records for Y03Xx
      for (const player of testPlayer) {
        const [economyRecords] = await connection.execute(`
          SELECT e.id, e.balance, e.guild_id
          FROM economy e
          WHERE e.player_id = ?
        `, [player.id]);

        if (economyRecords.length > 0) {
          console.log(`   💰 Economy record found: Balance ${economyRecords[0].balance} | Guild ID: ${economyRecords[0].guild_id}`);
        } else {
          console.log(`   ❌ No economy record found for ${player.ign} on ${player.server_name}`);
        }
      }
    } else {
      console.log(`❌ Y03Xx not found on any server`);
    }

  } catch (error) {
    console.error('❌ Error during economy records fix:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

// Run the script
fixAllEconomyRecords();
