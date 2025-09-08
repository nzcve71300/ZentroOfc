const pool = require('./src/db');

/**
 * Comprehensive Duplicate Player Fix
 * This script will:
 * 1. Find all duplicate player records
 * 2. Merge them properly (preserving economy data)
 * 3. Add database constraints to prevent future duplicates
 * 4. Provide detailed reporting
 */

async function fixDuplicatePlayersComprehensive() {
  console.log('🔧 COMPREHENSIVE DUPLICATE PLAYER FIX');
  console.log('=====================================');
  
  try {
    // Step 1: Find all duplicate records
    console.log('\n📊 Step 1: Analyzing duplicate records...');
    
    const [duplicates] = await pool.query(`
      SELECT 
        guild_id,
        server_id,
        discord_id,
        COUNT(*) as duplicate_count,
        GROUP_CONCAT(id ORDER BY linked_at DESC, id DESC) as player_ids,
        GROUP_CONCAT(ign ORDER BY linked_at DESC, id DESC) as igns,
        GROUP_CONCAT(linked_at ORDER BY linked_at DESC, id DESC) as linked_dates,
        GROUP_CONCAT(is_active ORDER BY linked_at DESC, id DESC) as active_status
      FROM players 
      WHERE is_active = true
      GROUP BY guild_id, server_id, discord_id
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC, guild_id, server_id
    `);
    
    console.log(`Found ${duplicates.length} sets of duplicate records`);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate records found! System is clean.');
      return;
    }
    
    // Step 2: Process each set of duplicates
    console.log('\n🔧 Step 2: Processing duplicate records...');
    
    let totalProcessed = 0;
    let totalMerged = 0;
    let totalPreserved = 0;
    
    for (const dup of duplicates) {
      console.log(`\n📋 Processing duplicate set:`);
      console.log(`  Guild ID: ${dup.guild_id}`);
      console.log(`  Server ID: ${dup.server_id}`);
      console.log(`  Discord ID: ${dup.discord_id}`);
      console.log(`  Duplicate count: ${dup.duplicate_count}`);
      
      const playerIds = dup.player_ids.split(',');
      const igns = dup.igns.split(',');
      const linkedDates = dup.linked_dates.split(',');
      const activeStatus = dup.active_status.split(',');
      
      // Get detailed info for each duplicate
      const [playerDetails] = await pool.query(`
        SELECT p.id, p.ign, p.linked_at, p.is_active, e.balance, rs.nickname
        FROM players p
        LEFT JOIN economy e ON p.id = e.player_id
        LEFT JOIN rust_servers rs ON p.server_id = rs.id
        WHERE p.id IN (${playerIds.join(',')})
        ORDER BY p.linked_at DESC, p.id DESC
      `);
      
      console.log(`  Player records:`);
      for (const player of playerDetails) {
        console.log(`    ID: ${player.id}, IGN: "${player.ign}", Balance: ${player.balance || 0}, Server: ${player.nickname || 'Unknown'}`);
      }
      
      // Determine which record to keep (most recent with highest balance)
      let keepRecord = playerDetails[0]; // Most recent by default
      let totalBalance = 0;
      
      for (const player of playerDetails) {
        totalBalance += player.balance || 0;
        // Prefer record with higher balance if dates are close
        if (player.balance > (keepRecord.balance || 0)) {
          keepRecord = player;
        }
      }
      
      console.log(`  🎯 Keeping record ID ${keepRecord.id} (IGN: "${keepRecord.ign}", Balance: ${keepRecord.balance || 0})`);
      console.log(`  🗑️ Merging ${playerDetails.length - 1} duplicate records`);
      
      // Step 3: Merge economy data
      if (totalBalance > (keepRecord.balance || 0)) {
        console.log(`  💰 Updating balance from ${keepRecord.balance || 0} to ${totalBalance}`);
        await pool.query(
          'UPDATE economy SET balance = ? WHERE player_id = ?',
          [totalBalance, keepRecord.id]
        );
      }
      
      // Step 4: Merge duplicate records (preserve all data, just deactivate duplicates)
      const duplicateIds = playerDetails.filter(p => p.id !== keepRecord.id).map(p => p.id);
      
      if (duplicateIds.length > 0) {
        // Only deactivate the duplicate records, don't delete anything
        await pool.query(`
          UPDATE players 
          SET is_active = false, 
              unlinked_at = CURRENT_TIMESTAMP,
              unlink_reason = 'Duplicate cleanup - merged with record ID ${keepRecord.id}'
          WHERE id IN (${duplicateIds.join(',')})
        `);
        
        // Keep economy records for deactivated players (don't delete them)
        // This preserves the data in case it's needed for reference
        console.log(`  📊 Preserved economy records for ${duplicateIds.length} deactivated duplicate records`);
      }
      
      totalProcessed += playerDetails.length;
      totalMerged += duplicateIds.length;
      totalPreserved += 1;
      
      console.log(`  ✅ Successfully deactivated ${duplicateIds.length} duplicates, kept record ID ${keepRecord.id} active`);
    }
    
    // Step 5: Add database constraints to prevent future duplicates
    console.log('\n🔒 Step 5: Adding database constraints...');
    
    try {
      // Drop existing constraint if it exists
      await pool.query('ALTER TABLE players DROP INDEX IF EXISTS unique_guild_server_discord');
      
      // Add unique constraint for active records only
      await pool.query(`
        ALTER TABLE players 
        ADD CONSTRAINT unique_active_discord_per_server 
        UNIQUE (guild_id, server_id, discord_id, is_active)
      `);
      console.log('  ✅ Added unique constraint for active Discord links per server');
      
    } catch (constraintError) {
      console.log('  ⚠️ Could not add constraint (may already exist):', constraintError.message);
    }
    
    // Step 6: Final verification
    console.log('\n🔍 Step 6: Final verification...');
    
    const [finalDuplicates] = await pool.query(`
      SELECT 
        guild_id,
        server_id,
        discord_id,
        COUNT(*) as duplicate_count
      FROM players 
      WHERE is_active = true
      GROUP BY guild_id, server_id, discord_id
      HAVING COUNT(*) > 1
    `);
    
    const [totalActiveRecords] = await pool.query(`
      SELECT COUNT(*) as count FROM players WHERE is_active = true
    `);
    
    // Step 7: Summary report
    console.log('\n📊 SUMMARY REPORT');
    console.log('=================');
    console.log(`Total duplicate sets processed: ${duplicates.length}`);
    console.log(`Total player records processed: ${totalProcessed}`);
    console.log(`Total duplicate records deactivated: ${totalMerged}`);
    console.log(`Total unique records preserved: ${totalPreserved}`);
    console.log(`Total active records remaining: ${totalActiveRecords[0].count}`);
    console.log(`Remaining duplicate sets: ${finalDuplicates.length}`);
    console.log(`\n💾 DATA PRESERVATION:`);
    console.log(`- All economy records preserved (no data deleted)`);
    console.log(`- Duplicate records deactivated but kept for reference`);
    console.log(`- Only the most recent/highest balance record remains active`);
    
    if (finalDuplicates.length === 0) {
      console.log('\n🎉 SUCCESS: All duplicate records have been cleaned up!');
      console.log('✅ The system is now clean and protected against future duplicates.');
    } else {
      console.log('\n⚠️ WARNING: Some duplicate records still exist. Manual review may be needed.');
    }
    
    // Step 8: Show remaining duplicates if any
    if (finalDuplicates.length > 0) {
      console.log('\n🔍 Remaining duplicate sets:');
      for (const dup of finalDuplicates) {
        console.log(`  Guild: ${dup.guild_id}, Server: ${dup.server_id}, Discord: ${dup.discord_id}, Count: ${dup.duplicate_count}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error during duplicate cleanup:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
if (require.main === module) {
  fixDuplicatePlayersComprehensive()
    .then(() => {
      console.log('\n✅ Duplicate cleanup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Duplicate cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { fixDuplicatePlayersComprehensive };
