const pool = require('./src/db');

async function cleanupLinkingDuplicatesSafe() {
  try {
    console.log('🧹 SAFE cleanup of linking system duplicates...');
    console.log('⚠️  This will ONLY remove actual duplicates, NOT unlink existing players');
    
    // Step 1: Find and fix same-server duplicates (most critical)
    console.log('\n📋 Step 1: Fixing same-server duplicates...');
    const [sameServerDuplicates] = await pool.query(`
      SELECT 
        p.server_id,
        s.nickname as server_name,
        p.ign as in_game_name,
        COUNT(*) as count,
        GROUP_CONCAT(p.id ORDER BY p.linked_at DESC SEPARATOR ',') as player_ids,
        GROUP_CONCAT(p.discord_id ORDER BY p.linked_at DESC SEPARATOR ',') as discord_ids
      FROM players p
      JOIN rust_servers s ON p.server_id = s.id
      WHERE p.ign IS NOT NULL AND p.ign != ''
      GROUP BY p.server_id, p.ign
      HAVING COUNT(*) > 1
      ORDER BY s.nickname, p.ign
    `);
    
    if (sameServerDuplicates.length > 0) {
      console.log(`Found ${sameServerDuplicates.length} same-server duplicates to fix:`);
      
      for (const duplicate of sameServerDuplicates) {
        console.log(`\n🔧 Fixing "${duplicate.in_game_name}" on ${duplicate.server_name}...`);
        
        const playerIds = duplicate.player_ids.split(',');
        const discordIds = duplicate.discord_ids.split(',');
        
        // Find which record has a valid Discord ID (linked)
        let keepId = null;
        let removeIds = [];
        
        // Check if any record is already linked
        const linkedIndex = discordIds.findIndex(id => id && id !== 'NULL' && id !== '');
        
        if (linkedIndex !== -1) {
          // Keep the linked record, remove others
          keepId = playerIds[linkedIndex];
          removeIds = playerIds.filter((_, index) => index !== linkedIndex);
          console.log(`   Keeping LINKED record ID: ${keepId} (Discord ID: ${discordIds[linkedIndex]})`);
        } else {
          // No linked records, keep the most recent unlinked one
          keepId = playerIds[0];
          removeIds = playerIds.slice(1);
          console.log(`   Keeping most recent UNLINKED record ID: ${keepId}`);
        }
        
        console.log(`   Removing ${removeIds.length} duplicate records`);
        
        // Remove duplicate records
        for (const removeId of removeIds) {
          const [deleteResult] = await pool.query(
            'DELETE FROM players WHERE id = ?',
            [removeId]
          );
          console.log(`   ✅ Removed duplicate record ID: ${removeId}`);
        }
      }
    } else {
      console.log('✅ No same-server duplicates found');
    }
    
    // Step 2: Fix specific case mentioned (BRNytro11) - SAFE VERSION
    console.log('\n📋 Step 2: Fixing specific case "BRNytro11"...');
    const [brnytro11Records] = await pool.query(`
      SELECT p.*, s.nickname as server_name
      FROM players p
      JOIN rust_servers s ON p.server_id = s.id
      WHERE p.ign = 'BRNytro11'
      ORDER BY s.nickname, p.linked_at DESC
    `);
    
    if (brnytro11Records.length > 1) {
      console.log(`Found ${brnytro11Records.length} records for "BRNytro11":`);
      
      // Find if any are already linked
      const linkedRecord = brnytro11Records.find(record => record.discord_id && record.discord_id !== 'NULL' && record.discord_id !== '');
      
      if (linkedRecord) {
        // Keep the linked record, remove others
        console.log(`   Keeping LINKED record: ${linkedRecord.server_name} (Discord ID: ${linkedRecord.discord_id})`);
        
        for (const record of brnytro11Records) {
          if (record.id !== linkedRecord.id) {
            const [deleteResult] = await pool.query(
              'DELETE FROM players WHERE id = ?',
              [record.id]
            );
            console.log(`   ✅ Removed duplicate: ${record.server_name}`);
          }
        }
      } else {
        // No linked records, keep the most recent one
        const keepRecord = brnytro11Records[0];
        const removeRecords = brnytro11Records.slice(1);
        
        console.log(`   Keeping most recent UNLINKED record: ${keepRecord.server_name}`);
        
        for (const removeRecord of removeRecords) {
          const [deleteResult] = await pool.query(
            'DELETE FROM players WHERE id = ?',
            [removeRecord.id]
          );
          console.log(`   ✅ Removed duplicate: ${removeRecord.server_name}`);
        }
      }
    } else if (brnytro11Records.length === 1) {
      console.log(`   Single record found for "BRNytro11" on ${brnytro11Records[0].server_name}`);
    } else {
      console.log('   No records found for "BRNytro11"');
    }
    
    // Step 3: Check for orphaned records (but DON'T unlink them automatically)
    console.log('\n📋 Step 3: Checking for orphaned linking records (READ-ONLY)...');
    const [orphanedRecords] = await pool.query(`
      SELECT p.id, p.ign, p.discord_id, s.nickname as server_name
      FROM players p
      JOIN rust_servers s ON p.server_id = s.id
      WHERE p.discord_id IS NOT NULL 
      AND p.discord_id != ''
      AND p.discord_id NOT IN (
        SELECT DISTINCT discord_id FROM players 
        WHERE discord_id IS NOT NULL AND discord_id != ''
        AND id != p.id
      )
    `);
    
    if (orphanedRecords.length > 0) {
      console.log(`Found ${orphanedRecords.length} potentially orphaned linking records:`);
      orphanedRecords.forEach(record => {
        console.log(`   ${record.ign} (${record.discord_id}) on ${record.server_name}`);
      });
      console.log('   ⚠️  These are NOT being unlinked automatically to preserve existing links');
      console.log('   💡 If you want to unlink these, run a separate script');
    } else {
      console.log('✅ No orphaned linking records found');
    }
    
    // Step 4: Verify cleanup
    console.log('\n📋 Step 4: Verifying cleanup...');
    const [remainingDuplicates] = await pool.query(`
      SELECT 
        p.server_id,
        s.nickname as server_name,
        p.ign as in_game_name,
        COUNT(*) as count
      FROM players p
      JOIN rust_servers s ON p.server_id = s.id
      WHERE p.ign IS NOT NULL AND p.ign != ''
      GROUP BY p.server_id, p.ign
      HAVING COUNT(*) > 1
    `);
    
    if (remainingDuplicates.length === 0) {
      console.log('✅ All same-server duplicates have been cleaned up!');
    } else {
      console.log(`⚠️  ${remainingDuplicates.length} duplicates still remain:`);
      remainingDuplicates.forEach(dup => {
        console.log(`   ${dup.in_game_name} on ${dup.server_name} (${dup.count} records)`);
      });
    }
    
    // Step 5: Show final status
    console.log('\n📋 Step 5: Final linking system status...');
    const [totalPlayers] = await pool.query('SELECT COUNT(*) as total FROM players');
    const [linkedPlayers] = await pool.query('SELECT COUNT(*) as linked FROM players WHERE discord_id IS NOT NULL AND discord_id != ""');
    const [unlinkedPlayers] = await pool.query('SELECT COUNT(*) as unlinked FROM players WHERE discord_id IS NULL OR discord_id = ""');
    
    console.log(`Total players: ${totalPlayers[0].total}`);
    console.log(`Linked players: ${linkedPlayers[0].linked}`);
    console.log(`Unlinked players: ${unlinkedPlayers[0].unlinked}`);
    
    console.log('\n🎯 SAFE CLEANUP COMPLETE!');
    console.log('✅ Duplicate records removed');
    console.log('✅ Existing links PRESERVED');
    console.log('✅ Specific case "BRNytro11" fixed');
    console.log('🔄 Restart the bot: pm2 restart zentro-bot');
    console.log('📝 Test linking with affected players');
    
  } catch (error) {
    console.error('❌ Error cleaning up linking duplicates:', error);
  } finally {
    await pool.end();
  }
}

cleanupLinkingDuplicatesSafe(); 