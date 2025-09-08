const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixClapDiscordFinalWorking() {
  console.log('🔧 FIXING CLAP2000777 DISCORD ID - FINAL WORKING SOLUTION');
  console.log('=========================================================');

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Database connected successfully!');

    // Step 1: Check current state
    console.log('\n📋 Step 1: Checking current state...');
    const [currentPlayers] = await connection.execute(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE LOWER(p.ign) = LOWER('Clap2000777')
      ORDER BY p.is_active DESC, p.linked_at DESC
    `);

    console.log(`Found ${currentPlayers.length} Clap2000777 players:`);
    for (const player of currentPlayers) {
      console.log(`- ID: ${player.id}, IGN: "${player.ign}", Discord: ${player.discord_id}, Active: ${player.is_active}, Balance: ${player.balance || 0}, Server: ${player.nickname}`);
    }

    // Find the active record with balance
    const activeRecord = currentPlayers.find(p => p.is_active && p.balance > 0);
    if (!activeRecord) {
      console.log('❌ No active Clap2000777 record with balance found!');
      return;
    }

    console.log(`\n🎯 Target record: ID ${activeRecord.id} on ${activeRecord.nickname}`);
    console.log(`Current Discord ID: ${activeRecord.discord_id}`);
    console.log(`Target Discord ID: 899414980355571712`);

    // Step 2: Find and delete ALL conflicting records with target Discord ID
    console.log('\n📋 Step 2: Finding conflicting records...');
    const [conflictingRecords] = await connection.execute(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.discord_id = 899414980355571712
      AND p.id != ?
    `, [activeRecord.id]);

    if (conflictingRecords.length > 0) {
      console.log(`Found ${conflictingRecords.length} conflicting records:`);
      for (const record of conflictingRecords) {
        console.log(`- ID: ${record.id}, IGN: "${record.ign}", Active: ${record.is_active}, Balance: ${record.balance || 0}, Server: ${record.nickname}`);
      }

      console.log('\n🗑️ Deleting conflicting records...');
      for (const record of conflictingRecords) {
        // Delete economy record first
        await connection.execute('DELETE FROM economy WHERE player_id = ?', [record.id]);
        console.log(`  ✅ Deleted economy record for ID ${record.id}`);

        // Delete player record
        await connection.execute('DELETE FROM players WHERE id = ?', [record.id]);
        console.log(`  ✅ Deleted player record ID ${record.id} (IGN: "${record.ign}")`);
      }
    } else {
      console.log('✅ No conflicting records found');
    }

    // Step 3: Update the target record using the working pattern from Artemis fixes
    console.log('\n📋 Step 3: Updating target record...');
    
    try {
      await connection.execute(`
        UPDATE players 
        SET discord_id = ? 
        WHERE id = ?
      `, [899414980355571712, activeRecord.id]);
      
      console.log(`✅ Updated ${activeRecord.ign} on ${activeRecord.nickname} to Discord ID 899414980355571712`);
    } catch (error) {
      console.log(`❌ Failed to update ${activeRecord.ign}: ${error.message}`);
      throw error;
    }

    // Step 4: Verify the update
    console.log('\n📋 Step 4: Verifying the update...');
    const [updatedPlayers] = await connection.execute(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.id = ?
    `, [activeRecord.id]);

    if (updatedPlayers.length > 0) {
      const record = updatedPlayers[0];
      console.log(`Updated record:`);
      console.log(`- ID: ${record.id}, IGN: "${record.ign}", Discord: ${record.discord_id}, Active: ${record.is_active}, Balance: ${record.balance || 0}, Server: ${record.nickname}`);
      
      if (record.discord_id == 899414980355571712) {
        console.log('\n🎉 SUCCESS: Clap2000777 now has the CORRECT Discord ID!');
      } else {
        console.log('\n❌ ISSUE: Discord ID was not updated correctly');
        console.log(`Expected: 899414980355571712`);
        console.log(`Actual: ${record.discord_id}`);
      }
    }

    // Step 5: Final status
    console.log('\n📋 Step 5: Final status...');
    const [finalPlayers] = await connection.execute(`
      SELECT p.id, p.ign, p.discord_id, p.is_active, e.balance, rs.nickname
      FROM players p
      LEFT JOIN economy e ON p.id = e.player_id
      LEFT JOIN rust_servers rs ON p.server_id = rs.id
      WHERE LOWER(p.ign) = LOWER('Clap2000777')
      ORDER BY p.is_active DESC, p.linked_at DESC
    `);

    console.log(`Final Clap2000777 records:`);
    for (const player of finalPlayers) {
      console.log(`- ID: ${player.id}, IGN: "${player.ign}", Discord: ${player.discord_id}, Active: ${player.is_active}, Balance: ${player.balance || 0}, Server: ${player.nickname}`);
    }

  } catch (error) {
    console.error('❌ Error in final working fix:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the fix
if (require.main === module) {
  fixClapDiscordFinalWorking()
    .then(() => {
      console.log('\n✅ Final working Discord ID fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Final working Discord ID fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixClapDiscordFinalWorking };
