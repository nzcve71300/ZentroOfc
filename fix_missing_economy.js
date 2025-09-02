const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixMissingEconomy() {
  console.log('🔧 Fixing Missing Economy Records');
  console.log('==================================\n');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    // Step 1: Find all players without economy records
    console.log('📋 Step 1: Finding players without economy records...');
    const [playersWithoutEconomy] = await connection.execute(`
      SELECT p.id, p.guild_id, p.discord_id, p.ign, p.server_id, rs.nickname as server_name
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      LEFT JOIN economy e ON p.id = e.player_id
      WHERE p.is_active = true 
      AND e.player_id IS NULL
      ORDER BY rs.nickname, p.ign
    `);

    if (playersWithoutEconomy.length === 0) {
      console.log('✅ All players already have economy records!');
      return;
    }

    console.log(`❌ Found ${playersWithoutEconomy.length} players missing economy records:`);
    playersWithoutEconomy.forEach(player => {
      console.log(`   ${player.ign} on ${player.server_name} (Player ID: ${player.id})`);
    });

    // Step 2: Create missing economy records
    console.log('\n📋 Step 2: Creating missing economy records...');
    let createdCount = 0;
    let errorCount = 0;

    for (const player of playersWithoutEconomy) {
      try {
        // Check if economy record already exists (double-check)
        const [existingEconomy] = await connection.execute(
          'SELECT id FROM economy WHERE player_id = ?',
          [player.id]
        );

        if (existingEconomy.length > 0) {
          console.log(`ℹ️ Economy record already exists for ${player.ign} on ${player.server_name}`);
          continue;
        }

        // Create economy record with 0 balance
        await connection.execute(
          'INSERT INTO economy (player_id, balance, guild_id) VALUES (?, 0, ?)',
          [player.id, player.guild_id]
        );

        console.log(`✅ Created economy record for ${player.ign} on ${player.server_name}`);
        createdCount++;

      } catch (error) {
        console.error(`❌ Failed to create economy record for ${player.ign} on ${player.server_name}: ${error.message}`);
        errorCount++;
      }
    }

    // Step 3: Verify the fix
    console.log('\n📋 Step 3: Verifying the fix...');
    const [verificationResult] = await connection.execute(`
      SELECT COUNT(*) as total_players, 
             COUNT(e.player_id) as players_with_economy,
             COUNT(*) - COUNT(e.player_id) as players_without_economy
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      WHERE p.is_active = true
    `);

    const stats = verificationResult[0];
    console.log(`📊 Economy System Status:`);
    console.log(`   Total active players: ${stats.total_players}`);
    console.log(`   Players with economy: ${stats.players_with_economy}`);
    console.log(`   Players without economy: ${stats.players_without_economy}`);

    // Step 4: Summary
    console.log('\n📋 Step 4: Summary...');
    if (createdCount > 0) {
      console.log(`✅ Successfully created ${createdCount} economy records`);
    }
    if (errorCount > 0) {
      console.log(`⚠️ Failed to create ${errorCount} economy records (check logs above)`);
    }
    
    if (stats.players_without_economy === 0) {
      console.log(`🎉 All players now have economy records!`);
    } else {
      console.log(`⚠️ ${stats.players_without_economy} players still missing economy records`);
    }

    // Step 5: Test specific player (nzcve7130 on USA-DeadOps)
    console.log('\n📋 Step 5: Testing specific player fix...');
    const [testPlayer] = await connection.execute(`
      SELECT p.id, p.ign, rs.nickname as server_name, e.balance
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      LEFT JOIN economy e ON p.id = e.player_id
      WHERE p.ign = 'nzcve7130' AND rs.nickname = 'USA-DeadOps'
    `);

    if (testPlayer.length > 0) {
      const player = testPlayer[0];
      console.log(`🧪 Test Player: ${player.ign} on ${player.server_name}`);
      console.log(`   Player ID: ${player.id}`);
      console.log(`   Balance: ${player.balance !== null ? player.balance : 'NULL (No economy record)'}`);
      
      if (player.balance === null) {
        console.log(`   Status: ❌ Still missing economy record`);
      } else {
        console.log(`   Status: ✅ Has economy record with balance ${player.balance}`);
      }
    } else {
      console.log(`❌ Test player nzcve7130 on USA-DeadOps not found`);
    }

  } catch (error) {
    console.error('❌ Error during fix:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    process.exit();
  }
}

fixMissingEconomy();
