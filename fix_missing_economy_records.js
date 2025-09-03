const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixMissingEconomyRecords() {
  console.log('🔧 Fix Missing Economy Records Script');
  console.log('=====================================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    // Step 1: Find the Dead-ops server
    console.log('📋 Step 1: Finding Dead-ops server...');
    const [servers] = await connection.execute(`
      SELECT id, nickname, guild_id
      FROM rust_servers 
      WHERE nickname = 'Dead-ops'
    `);

    if (servers.length === 0) {
      console.log('❌ Dead-ops server not found!');
      return;
    }

    const deadOpsServer = servers[0];
    console.log(`✅ Found Dead-ops server: ${deadOpsServer.nickname} (ID: ${deadOpsServer.id})`);

    // Step 2: Find all players on Dead-ops server
    console.log('\n📋 Step 2: Finding all players on Dead-ops server...');
    const [players] = await connection.execute(`
      SELECT p.id, p.ign, p.discord_id, p.guild_id
      FROM players p
      WHERE p.server_id = ? AND p.is_active = true
      ORDER BY p.ign
    `, [deadOpsServer.id]);

    console.log(`📊 Found ${players.length} players on Dead-ops server`);

    // Step 3: Check which players are missing economy records
    console.log('\n📋 Step 3: Checking for missing economy records...');
    let missingEconomyCount = 0;
    let createdEconomyCount = 0;

    for (const player of players) {
      const [economyRecords] = await connection.execute(`
        SELECT id FROM economy WHERE player_id = ?
      `, [player.id]);

      if (economyRecords.length === 0) {
        missingEconomyCount++;
        console.log(`   ❌ Missing economy record for ${player.ign} (ID: ${player.id})`);
        
        // Create the missing economy record
        try {
          const [result] = await connection.execute(`
            INSERT INTO economy (player_id, balance, guild_id) VALUES (?, 0, ?)
          `, [player.id, player.guild_id]);
          
          console.log(`   ✅ Created economy record with ID: ${result.insertId}`);
          createdEconomyCount++;
        } catch (error) {
          console.log(`   ❌ Failed to create economy record: ${error.message}`);
        }
      }
    }

    // Step 4: Summary
    console.log('\n🎉 Economy Records Fix Completed!');
    console.log('==================================');
    console.log(`📊 Total players on Dead-ops: ${players.length}`);
    console.log(`🔧 Missing economy records: ${missingEconomyCount}`);
    console.log(`✅ Economy records created: ${createdEconomyCount}`);
    
    if (createdEconomyCount > 0) {
      console.log(`\n✅ All missing economy records have been created!`);
      console.log(`✅ Players should now be able to receive currency properly.`);
      console.log(`✅ Try adding currency to Y03Xx again - it should work now.`);
    } else {
      console.log(`\nℹ️ No missing economy records found.`);
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
fixMissingEconomyRecords();
