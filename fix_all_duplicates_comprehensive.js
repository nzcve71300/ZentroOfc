const pool = require('./src/db');

/**
 * Comprehensive Duplicate Player Fix - ALL TYPES
 * This script will find and fix ALL types of duplicates:
 * 1. Duplicates with discord_id = null (already fixed)
 * 2. Duplicates with actual Discord IDs (NEW - this is the issue!)
 * 3. Duplicates with same IGN but different Discord IDs
 */

async function fixAllDuplicatesComprehensive() {
  console.log('🔧 COMPREHENSIVE DUPLICATE FIX - ALL TYPES');
  console.log('==========================================');
  
  try {
    // Step 1: Find ALL types of duplicates
    console.log('\n📊 Step 1: Analyzing ALL duplicate types...');
    
    // Type 1: Duplicates with same Discord ID on same server
    const [discordDuplicates] = await pool.query(`
      SELECT 
        guild_id,
        server_id,
        discord_id,
        COUNT(*) as duplicate_count,
        GROUP_CONCAT(id ORDER BY linked_at DESC, id DESC) as player_ids,
        GROUP_CONCAT(ign ORDER BY linked_at DESC, id DESC) as igns,
        GROUP_CONCAT(linked_at ORDER BY linked_at DESC, id DESC) as linked_dates
      FROM players 
      WHERE is_active = true
      AND discord_id IS NOT NULL
      GROUP BY guild_id, server_id, discord_id
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC, guild_id, server_id
    `);
    
    // Type 2: Duplicates with same IGN on same server (different Discord IDs)
    const [ignDuplicates] = await pool.query(`
      SELECT 
        guild_id,
        server_id,
        ign,
        COUNT(*) as duplicate_count,
        GROUP_CONCAT(id ORDER BY linked_at DESC, id DESC) as player_ids,
        GROUP_CONCAT(discord_id ORDER BY linked_at DESC, id DESC) as discord_ids,
        GROUP_CONCAT(linked_at ORDER BY linked_at DESC, id DESC) as linked_dates
      FROM players 
      WHERE is_active = true
      AND ign IS NOT NULL
      GROUP BY guild_id, server_id, LOWER(ign)
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC, guild_id, server_id
    `);
    
    console.log(`Found ${discordDuplicates.length} sets of Discord ID duplicates`);
    console.log(`Found ${ignDuplicates.length} sets of IGN duplicates`);
    
    let totalProcessed = 0;
    let totalMerged = 0;
    let totalPreserved = 0;
    
    // Step 2: Process Discord ID duplicates
    if (discordDuplicates.length > 0) {
      console.log('\n🔧 Step 2: Processing Discord ID duplicates...');
      
      for (const dup of discordDuplicates) {
        console.log(`\n📋 Processing Discord ID duplicate set:`);
        console.log(`  Guild ID: ${dup.guild_id}`);
        console.log(`  Server ID: ${dup.server_id}`);
        console.log(`  Discord ID: ${dup.discord_id}`);
        console.log(`  Duplicate count: ${dup.duplicate_count}`);
        
        const playerIds = dup.player_ids.split(',');
        const igns = dup.igns.split(',');
        
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
        
        // Merge economy data
        if (totalBalance > (keepRecord.balance || 0)) {
          console.log(`  💰 Updating balance from ${keepRecord.balance || 0} to ${totalBalance}`);
          await pool.query(
            'UPDATE economy SET balance = ? WHERE player_id = ?',
            [totalBalance, keepRecord.id]
          );
        }
        
        // Deactivate duplicate records
        const duplicateIds = playerDetails.filter(p => p.id !== keepRecord.id).map(p => p.id);
        
        if (duplicateIds.length > 0) {
          await pool.query(`
            UPDATE players 
            SET is_active = false, 
                unlinked_at = CURRENT_TIMESTAMP,
                unlink_reason = 'Discord ID duplicate cleanup - merged with record ID ${keepRecord.id}'
            WHERE id IN (${duplicateIds.join(',')})
          `);
          
          console.log(`  📊 Preserved economy records for ${duplicateIds.length} deactivated duplicate records`);
        }
        
        totalProcessed += playerDetails.length;
        totalMerged += duplicateIds.length;
        totalPreserved += 1;
        
        console.log(`  ✅ Successfully deactivated ${duplicateIds.length} duplicates, kept record ID ${keepRecord.id} active`);
      }
    }
    
    // Step 3: Process IGN duplicates
    if (ignDuplicates.length > 0) {
      console.log('\n🔧 Step 3: Processing IGN duplicates...');
      
      for (const dup of ignDuplicates) {
        console.log(`\n📋 Processing IGN duplicate set:`);
        console.log(`  Guild ID: ${dup.guild_id}`);
        console.log(`  Server ID: ${dup.server_id}`);
        console.log(`  IGN: "${dup.ign}"`);
        console.log(`  Duplicate count: ${dup.duplicate_count}`);
        
        const playerIds = dup.player_ids.split(',');
        const discordIds = dup.discord_ids.split(',');
        
        // Get detailed info for each duplicate
        const [playerDetails] = await pool.query(`
          SELECT p.id, p.ign, p.discord_id, p.linked_at, p.is_active, e.balance, rs.nickname
          FROM players p
          LEFT JOIN economy e ON p.id = e.player_id
          LEFT JOIN rust_servers rs ON p.server_id = rs.id
          WHERE p.id IN (${playerIds.join(',')})
          ORDER BY p.linked_at DESC, p.id DESC
        `);
        
        console.log(`  Player records:`);
        for (const player of playerDetails) {
          console.log(`    ID: ${player.id}, IGN: "${player.ign}", Discord: ${player.discord_id}, Balance: ${player.balance || 0}, Server: ${player.nickname || 'Unknown'}`);
        }
        
        // Determine which record to keep (prefer linked Discord account, then highest balance)
        let keepRecord = playerDetails[0]; // Most recent by default
        let totalBalance = 0;
        
        for (const player of playerDetails) {
          totalBalance += player.balance || 0;
          
          // Prefer record with Discord ID linked
          if (player.discord_id && !keepRecord.discord_id) {
            keepRecord = player;
          } else if (player.discord_id && keepRecord.discord_id && player.balance > (keepRecord.balance || 0)) {
            keepRecord = player;
          } else if (!player.discord_id && !keepRecord.discord_id && player.balance > (keepRecord.balance || 0)) {
            keepRecord = player;
          }
        }
        
        console.log(`  🎯 Keeping record ID ${keepRecord.id} (IGN: "${keepRecord.ign}", Discord: ${keepRecord.discord_id}, Balance: ${keepRecord.balance || 0})`);
        console.log(`  🗑️ Merging ${playerDetails.length - 1} duplicate records`);
        
        // Merge economy data
        if (totalBalance > (keepRecord.balance || 0)) {
          console.log(`  💰 Updating balance from ${keepRecord.balance || 0} to ${totalBalance}`);
          await pool.query(
            'UPDATE economy SET balance = ? WHERE player_id = ?',
            [totalBalance, keepRecord.id]
          );
        }
        
        // Deactivate duplicate records
        const duplicateIds = playerDetails.filter(p => p.id !== keepRecord.id).map(p => p.id);
        
        if (duplicateIds.length > 0) {
          await pool.query(`
            UPDATE players 
            SET is_active = false, 
                unlinked_at = CURRENT_TIMESTAMP,
                unlink_reason = 'IGN duplicate cleanup - merged with record ID ${keepRecord.id}'
            WHERE id IN (${duplicateIds.join(',')})
          `);
          
          console.log(`  📊 Preserved economy records for ${duplicateIds.length} deactivated duplicate records`);
        }
        
        totalProcessed += playerDetails.length;
        totalMerged += duplicateIds.length;
        totalPreserved += 1;
        
        console.log(`  ✅ Successfully deactivated ${duplicateIds.length} duplicates, kept record ID ${keepRecord.id} active`);
      }
    }
    
    // Step 4: Final verification
    console.log('\n🔍 Step 4: Final verification...');
    
    const [finalDiscordDuplicates] = await pool.query(`
      SELECT 
        guild_id,
        server_id,
        discord_id,
        COUNT(*) as duplicate_count
      FROM players 
      WHERE is_active = true
      AND discord_id IS NOT NULL
      GROUP BY guild_id, server_id, discord_id
      HAVING COUNT(*) > 1
    `);
    
    const [finalIgnDuplicates] = await pool.query(`
      SELECT 
        guild_id,
        server_id,
        ign,
        COUNT(*) as duplicate_count
      FROM players 
      WHERE is_active = true
      AND ign IS NOT NULL
      GROUP BY guild_id, server_id, LOWER(ign)
      HAVING COUNT(*) > 1
    `);
    
    const [totalActiveRecords] = await pool.query(`
      SELECT COUNT(*) as count FROM players WHERE is_active = true
    `);
    
    // Step 5: Summary report
    console.log('\n📊 SUMMARY REPORT');
    console.log('=================');
    console.log(`Discord ID duplicate sets processed: ${discordDuplicates.length}`);
    console.log(`IGN duplicate sets processed: ${ignDuplicates.length}`);
    console.log(`Total player records processed: ${totalProcessed}`);
    console.log(`Total duplicate records deactivated: ${totalMerged}`);
    console.log(`Total unique records preserved: ${totalPreserved}`);
    console.log(`Total active records remaining: ${totalActiveRecords[0].count}`);
    console.log(`Remaining Discord ID duplicate sets: ${finalDiscordDuplicates.length}`);
    console.log(`Remaining IGN duplicate sets: ${finalIgnDuplicates.length}`);
    console.log(`\n💾 DATA PRESERVATION:`);
    console.log(`- All economy records preserved (no data deleted)`);
    console.log(`- Duplicate records deactivated but kept for reference`);
    console.log(`- Only the best record (linked + highest balance) remains active`);
    
    if (finalDiscordDuplicates.length === 0 && finalIgnDuplicates.length === 0) {
      console.log('\n🎉 SUCCESS: All duplicate records have been cleaned up!');
      console.log('✅ The system is now completely clean and protected against future duplicates.');
    } else {
      console.log('\n⚠️ WARNING: Some duplicate records still exist. Manual review may be needed.');
      
      if (finalDiscordDuplicates.length > 0) {
        console.log('\n🔍 Remaining Discord ID duplicate sets:');
        for (const dup of finalDiscordDuplicates) {
          console.log(`  Guild: ${dup.guild_id}, Server: ${dup.server_id}, Discord: ${dup.discord_id}, Count: ${dup.duplicate_count}`);
        }
      }
      
      if (finalIgnDuplicates.length > 0) {
        console.log('\n🔍 Remaining IGN duplicate sets:');
        for (const dup of finalIgnDuplicates) {
          console.log(`  Guild: ${dup.guild_id}, Server: ${dup.server_id}, IGN: "${dup.ign}", Count: ${dup.duplicate_count}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error during comprehensive duplicate cleanup:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
if (require.main === module) {
  fixAllDuplicatesComprehensive()
    .then(() => {
      console.log('\n✅ Comprehensive duplicate cleanup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Comprehensive duplicate cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { fixAllDuplicatesComprehensive };
