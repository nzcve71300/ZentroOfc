const pool = require('./src/db');

/**
 * Comprehensive script to fix ALL duplicate player records
 * This will find duplicates by Discord ID, similar IGNs, and merge them
 * Always keeps the record with the highest balance
 */
async function fixAllDuplicatePlayers() {
  try {
    console.log('🔍 Starting comprehensive duplicate player cleanup...\n');
    
    let totalDuplicatesFound = 0;
    let totalDuplicatesFixed = 0;
    let totalBalanceMerged = 0;
    
    // 1. Find duplicates by Discord ID (same Discord user, multiple records)
    console.log('📋 Phase 1: Finding duplicates by Discord ID...');
    const [discordDuplicates] = await pool.query(`
      SELECT 
        discord_id,
        GROUP_CONCAT(CONCAT(id, ':', ign, ':', COALESCE(server_id, 'NULL')) SEPARATOR '|') as records,
        COUNT(*) as count
      FROM players 
      WHERE discord_id IS NOT NULL 
      AND is_active = true
      GROUP BY discord_id 
      HAVING COUNT(*) > 1
      ORDER BY discord_id
    `);
    
    console.log(`Found ${discordDuplicates.length} Discord users with multiple records`);
    
    for (const dup of discordDuplicates) {
      console.log(`\n🔄 Processing Discord ID: ${dup.discord_id} (${dup.count} records)`);
      
      const records = dup.records.split('|').map(record => {
        const [id, ign, serverId] = record.split(':');
        return { id: parseInt(id), ign, serverId: serverId === 'NULL' ? null : serverId };
      });
      
      // Group by server to handle each server separately
      const serverGroups = {};
      for (const record of records) {
        if (!serverGroups[record.serverId]) {
          serverGroups[record.serverId] = [];
        }
        serverGroups[record.serverId].push(record);
      }
      
      for (const [serverId, serverRecords] of Object.entries(serverGroups)) {
        if (serverRecords.length <= 1) continue;
        
        console.log(`  📍 Server ID: ${serverId} (${serverRecords.length} records)`);
        
        // Get balances for all records
        const recordsWithBalances = [];
        for (const record of serverRecords) {
          const [balanceResult] = await pool.query('SELECT balance FROM economy WHERE player_id = ?', [record.id]);
          const balance = balanceResult[0]?.balance || 0;
          recordsWithBalances.push({ ...record, balance });
          console.log(`    - ID=${record.id}, IGN="${record.ign}", Balance=${balance}`);
        }
        
        // Sort by priority: Discord ID first, then by balance (highest first)
        recordsWithBalances.sort((a, b) => {
          // If one has Discord ID and other doesn't, prioritize the one with Discord ID
          if (a.discord_id && !b.discord_id) return -1;
          if (!a.discord_id && b.discord_id) return 1;
          
          // If both have Discord ID or both don't, sort by balance
          return b.balance - a.balance;
        });
        
        const keepRecord = recordsWithBalances[0];
        const mergeRecords = recordsWithBalances.slice(1);
        
        console.log(`    🎯 Keeping: ID=${keepRecord.id}, IGN="${keepRecord.ign}", Balance=${keepRecord.balance}`);
        
        // Calculate total balance
        const totalBalance = recordsWithBalances.reduce((sum, r) => sum + r.balance, 0);
        
        // Update the kept record with total balance
        await pool.query('UPDATE economy SET balance = ? WHERE player_id = ?', [totalBalance, keepRecord.id]);
        
        // Deactivate and clean up merge records
        for (const mergeRecord of mergeRecords) {
          console.log(`    🗑️ Merging: ID=${mergeRecord.id}, IGN="${mergeRecord.ign}", Balance=${mergeRecord.balance}`);
          
          // Deactivate the record
          await pool.query(
            'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP, unlink_reason = "Merged duplicate record" WHERE id = ?',
            [mergeRecord.id]
          );
          
          // Delete economy record
          await pool.query('DELETE FROM economy WHERE player_id = ?', [mergeRecord.id]);
        }
        
        console.log(`    ✅ Merged successfully! Total balance: ${totalBalance}`);
        totalDuplicatesFixed += mergeRecords.length;
        totalBalanceMerged += mergeRecords.reduce((sum, r) => sum + r.balance, 0);
      }
      
      totalDuplicatesFound += dup.count - 1;
    }
    
    // 2. Find duplicates by similar IGNs (fuzzy matching)
    console.log('\n📋 Phase 2: Finding duplicates by similar IGNs...');
    const [similarIgns] = await pool.query(`
      SELECT 
        p1.id as id1, p1.ign as ign1, p1.discord_id as discord_id1, p1.server_id as server_id1,
        p2.id as id2, p2.ign as ign2, p2.discord_id as discord_id2, p2.server_id as server_id2,
        rs.nickname as server_name
      FROM players p1
      JOIN players p2 ON p1.server_id = p2.server_id AND p1.guild_id = p2.guild_id
      JOIN rust_servers rs ON p1.server_id = rs.id
      WHERE p1.id < p2.id
      AND p1.is_active = true
      AND p2.is_active = true
      AND (
        -- Exact match (case insensitive)
        LOWER(p1.ign) = LOWER(p2.ign)
        OR
        -- Similar names (same base with different numbers/suffixes)
        (
          LENGTH(p1.ign) > 3 AND LENGTH(p2.ign) > 3 AND
          (
            -- Same prefix, different suffix
            SUBSTRING(LOWER(p1.ign), 1, LEAST(LENGTH(p1.ign), LENGTH(p2.ign)) - 2) = 
            SUBSTRING(LOWER(p2.ign), 1, LEAST(LENGTH(p1.ign), LENGTH(p2.ign)) - 2)
            OR
            -- One is substring of the other (with reasonable length)
            (LENGTH(p1.ign) > 5 AND LENGTH(p2.ign) > 5 AND (
              LOWER(p1.ign) LIKE CONCAT('%', LOWER(p2.ign), '%') OR
              LOWER(p2.ign) LIKE CONCAT('%', LOWER(p1.ign), '%')
            ))
          )
        )
      )
      ORDER BY rs.nickname, p1.ign
    `);
    
    console.log(`Found ${similarIgns.length} potential similar IGN pairs`);
    
    for (const dup of similarIgns) {
      console.log(`\n📋 Similar IGN pair found:`);
      console.log(`  Player 1: ID=${dup.id1}, IGN="${dup.ign1}", Discord=${dup.discord_id1}`);
      console.log(`  Player 2: ID=${dup.id2}, IGN="${dup.ign2}", Discord=${dup.discord_id2}`);
      console.log(`  Server: ${dup.server_name}`);
      
      // Get economy balances for both players
      const [balance1] = await pool.query('SELECT balance FROM economy WHERE player_id = ?', [dup.id1]);
      const [balance2] = await pool.query('SELECT balance FROM economy WHERE player_id = ?', [dup.id2]);
      
      const bal1 = balance1[0]?.balance || 0;
      const bal2 = balance2[0]?.balance || 0;
      
      console.log(`  Balance 1: ${bal1}`);
      console.log(`  Balance 2: ${bal2}`);
      
      // Determine which player to keep (prefer Discord-linked, then highest balance)
      let keepId, mergeId, keepIgn, mergeIgn;
      
      if (dup.discord_id1 && !dup.discord_id2) {
        keepId = dup.id1;
        mergeId = dup.id2;
        keepIgn = dup.ign1;
        mergeIgn = dup.ign2;
        console.log(`  🎯 Keeping: ID=${keepId}, IGN="${keepIgn}" (has Discord ID)`);
      } else if (dup.discord_id2 && !dup.discord_id1) {
        keepId = dup.id2;
        mergeId = dup.id1;
        keepIgn = dup.ign2;
        mergeIgn = dup.ign1;
        console.log(`  🎯 Keeping: ID=${keepId}, IGN="${keepIgn}" (has Discord ID)`);
      } else if (bal1 >= bal2) {
        keepId = dup.id1;
        mergeId = dup.id2;
        keepIgn = dup.ign1;
        mergeIgn = dup.ign2;
        console.log(`  🎯 Keeping: ID=${keepId}, IGN="${keepIgn}" (higher balance)`);
      } else {
        keepId = dup.id2;
        mergeId = dup.id1;
        keepIgn = dup.ign2;
        mergeIgn = dup.ign1;
        console.log(`  🎯 Keeping: ID=${keepId}, IGN="${keepIgn}" (higher balance)`);
      }
      
      console.log(`  🗑️ Merging: ID=${mergeId}, IGN="${mergeIgn}"`);
      
      // Merge the balances
      const totalBalance = bal1 + bal2;
      await pool.query('UPDATE economy SET balance = ? WHERE player_id = ?', [totalBalance, keepId]);
      
      // Deactivate the duplicate record
      await pool.query(
        'UPDATE players SET is_active = false, unlinked_at = CURRENT_TIMESTAMP, unlink_reason = "Merged similar IGN duplicate" WHERE id = ?',
        [mergeId]
      );
      
      // Delete the duplicate economy record
      await pool.query('DELETE FROM economy WHERE player_id = ?', [mergeId]);
      
      console.log(`  ✅ Merged successfully! Total balance: ${totalBalance}`);
      totalDuplicatesFound++;
      totalDuplicatesFixed++;
      totalBalanceMerged += Math.min(bal1, bal2);
    }
    
    // 3. Summary report
    console.log('\n🎉 Duplicate player cleanup completed!');
    console.log('📊 Summary:');
    console.log(`  - Total duplicates found: ${totalDuplicatesFound}`);
    console.log(`  - Total records merged: ${totalDuplicatesFixed}`);
    console.log(`  - Total balance preserved: ${totalBalanceMerged}`);
    
    // 4. Final verification - check for any remaining obvious duplicates
    console.log('\n🔍 Final verification...');
    const [remainingDuplicates] = await pool.query(`
      SELECT 
        discord_id,
        COUNT(*) as count
      FROM players 
      WHERE discord_id IS NOT NULL 
      AND is_active = true
      GROUP BY discord_id 
      HAVING COUNT(*) > 1
    `);
    
    if (remainingDuplicates.length > 0) {
      console.log(`⚠️ Warning: ${remainingDuplicates.length} Discord users still have multiple active records`);
      for (const dup of remainingDuplicates) {
        console.log(`  - Discord ID: ${dup.discord_id} (${dup.count} records)`);
      }
    } else {
      console.log('✅ No remaining Discord ID duplicates found!');
    }
    
  } catch (error) {
    console.error('❌ Error fixing duplicate player records:', error);
  } finally {
    await pool.end();
  }
}

// Run the comprehensive fix
fixAllDuplicatePlayers();
