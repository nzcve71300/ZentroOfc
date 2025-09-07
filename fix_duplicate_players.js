const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixDuplicatePlayers() {
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

    console.log('🔧 Starting duplicate player cleanup...');

    // First, let's see the current state
    const [duplicateCheck] = await connection.execute(`
      SELECT discord_id, COUNT(*) as count
      FROM players 
      WHERE is_active = TRUE
      GROUP BY discord_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    const [nullDiscordCheck] = await connection.execute(`
      SELECT COUNT(*) as count FROM players WHERE discord_id IS NULL AND is_active = TRUE
    `);

    console.log(`📊 Current Issues:`);
    console.log(`   🔄 Discord IDs with duplicates: ${duplicateCheck.length}`);
    console.log(`   ❌ Records with null Discord ID: ${nullDiscordCheck[0].count}`);

    if (duplicateCheck.length === 0 && nullDiscordCheck[0].count === 0) {
      console.log('✅ No duplicate or null Discord ID issues found!');
      return;
    }

    let fixedCount = 0;
    let deletedCount = 0;

    // Fix null Discord IDs first
    if (nullDiscordCheck[0].count > 0) {
      console.log(`\n🗑️ Cleaning up ${nullDiscordCheck[0].count} records with null Discord IDs...`);
      
      // Get the IDs of players with null discord_id
      const [nullPlayers] = await connection.execute(`
        SELECT id FROM players WHERE discord_id IS NULL AND is_active = TRUE
      `);

      const nullPlayerIds = nullPlayers.map(p => p.id);
      
      if (nullPlayerIds.length > 0) {
        // Delete associated economy records first
        await connection.execute(`
          DELETE FROM economy WHERE player_id IN (${nullPlayerIds.map(() => '?').join(',')})
        `, nullPlayerIds);
        
        // Delete the player records
        await connection.execute(`
          DELETE FROM players WHERE id IN (${nullPlayerIds.map(() => '?').join(',')})
        `, nullPlayerIds);
        
        deletedCount += nullPlayerIds.length;
        console.log(`✅ Deleted ${nullPlayerIds.length} records with null Discord IDs`);
      }
    }

    // Fix duplicate Discord IDs
    for (const duplicate of duplicateCheck) {
      if (duplicate.discord_id === null) continue; // Skip nulls, already handled
      
      console.log(`\n🔧 Fixing duplicate Discord ID: ${duplicate.discord_id} (${duplicate.count} records)`);
      
      // Get all records for this Discord ID
      const [duplicateRecords] = await connection.execute(`
        SELECT p.id, p.server_id, p.ign, p.normalized_ign, p.linked_at, e.balance, rs.nickname
        FROM players p
        LEFT JOIN economy e ON p.id = e.player_id
        LEFT JOIN rust_servers rs ON p.server_id = rs.id
        WHERE p.discord_id = ? AND p.is_active = TRUE
        ORDER BY p.linked_at ASC
      `, [duplicate.discord_id]);

      if (duplicateRecords.length <= 1) continue;

      // Keep the first (oldest) record, delete the rest
      const keepRecord = duplicateRecords[0];
      const deleteRecords = duplicateRecords.slice(1);

      console.log(`   📝 Keeping record: ${keepRecord.ign} on ${keepRecord.nickname} (ID: ${keepRecord.id})`);
      console.log(`   🗑️ Deleting ${deleteRecords.length} duplicate records:`);

      for (const deleteRecord of deleteRecords) {
        console.log(`      - ${deleteRecord.ign} on ${deleteRecord.nickname} (ID: ${deleteRecord.id}, Balance: ${deleteRecord.balance || 0})`);
        
        // Delete economy record first
        if (deleteRecord.balance !== null) {
          await connection.execute('DELETE FROM economy WHERE player_id = ?', [deleteRecord.id]);
        }
        
        // Delete player record
        await connection.execute('DELETE FROM players WHERE id = ?', [deleteRecord.id]);
        
        deletedCount++;
      }

      fixedCount++;
    }

    // Verify the fix
    console.log('\n🔍 Verifying fixes...');
    const [finalDuplicateCheck] = await connection.execute(`
      SELECT discord_id, COUNT(*) as count
      FROM players 
      WHERE is_active = TRUE
      GROUP BY discord_id
      HAVING COUNT(*) > 1
    `);

    const [finalNullCheck] = await connection.execute(`
      SELECT COUNT(*) as count FROM players WHERE discord_id IS NULL AND is_active = TRUE
    `);

    const [finalPlayerCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM players WHERE is_active = TRUE
    `);

    const [finalEconomyCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM economy
    `);

    console.log('\n📊 Cleanup Results:');
    console.log('===================');
    console.log(`✅ Fixed duplicate Discord IDs: ${fixedCount}`);
    console.log(`🗑️ Total records deleted: ${deletedCount}`);
    console.log(`👥 Final active players: ${finalPlayerCount[0].count}`);
    console.log(`💰 Final economy records: ${finalEconomyCount[0].count}`);
    console.log(`🔄 Remaining duplicates: ${finalDuplicateCheck.length}`);
    console.log(`❌ Remaining null Discord IDs: ${finalNullCheck[0].count}`);

    if (finalDuplicateCheck.length === 0 && finalNullCheck[0].count === 0) {
      console.log('\n🎉 All duplicate and null Discord ID issues have been resolved!');
    } else {
      console.log('\n⚠️ Some issues remain - manual review may be needed');
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the cleanup
if (require.main === module) {
  fixDuplicatePlayers()
    .then(() => {
      console.log('✅ Cleanup process completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup process failed:', error);
      process.exit(1);
    });
}

module.exports = fixDuplicatePlayers;
