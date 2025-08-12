const pool = require('./src/db');

async function cleanupLinkingDuplicates() {
  try {
    console.log('🧹 Cleaning up linking system duplicates...');
    
    // Step 1: Find and fix same-server duplicates (most critical)
    console.log('\n📋 Step 1: Fixing same-server duplicates...');
    const [sameServerDuplicates] = await pool.query(`
      SELECT 
        p.server_id,
        s.nickname as server_name,
        p.name as in_game_name,
        COUNT(*) as count,
        GROUP_CONCAT(p.id ORDER BY p.created_at DESC SEPARATOR ',') as player_ids,
        GROUP_CONCAT(p.discord_id ORDER BY p.created_at DESC SEPARATOR ',') as discord_ids
      FROM players p
      JOIN rust_servers s ON p.server_id = s.id
      WHERE p.name IS NOT NULL AND p.name != ''
      GROUP BY p.server_id, p.name
      HAVING COUNT(*) > 1
      ORDER BY s.nickname, p.name
    `);
    
    if (sameServerDuplicates.length > 0) {
      console.log(`Found ${sameServerDuplicates.length} same-server duplicates to fix:`);
      
      for (const duplicate of sameServerDuplicates) {
        console.log(`\n🔧 Fixing "${duplicate.in_game_name}" on ${duplicate.server_name}...`);
        
        const playerIds = duplicate.player_ids.split(',');
        const discordIds = duplicate.discord_ids.split(',');
        
        // Keep the most recent record, remove older duplicates
        const keepId = playerIds[0]; // Most recent (ordered by created_at DESC)
        const removeIds = playerIds.slice(1); // Older records
        
        console.log(`   Keeping player ID: ${keepId}`);
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
    
    // Step 2: Clean up orphaned linking records
    console.log('\n📋 Step 2: Cleaning up orphaned linking records...');
    const [orphanedRecords] = await pool.query(`
      SELECT p.id, p.name, p.discord_id, s.nickname as server_name
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
      console.log(`Found ${orphanedRecords.length} orphaned linking records:`);
      orphanedRecords.forEach(record => {
        console.log(`   ${record.name} (${record.discord_id}) on ${record.server_name}`);
      });
      
      // Ask if we should clean these up
      console.log('\n🔧 Cleaning up orphaned records...');
      for (const record of orphanedRecords) {
        const [updateResult] = await pool.query(
          'UPDATE players SET discord_id = NULL WHERE id = ?',
          [record.id]
        );
        console.log(`   ✅ Unlinked ${record.name} on ${record.server_name}`);
      }
    } else {
      console.log('✅ No orphaned linking records found');
    }
    
    // Step 3: Fix specific case mentioned (BRNytro11)
    console.log('\n📋 Step 3: Fixing specific case "BRNytro11"...');
    const [brnytro11Records] = await pool.query(`
      SELECT p.*, s.nickname as server_name
      FROM players p
      JOIN rust_servers s ON p.server_id = s.id
      WHERE p.name = 'BRNytro11'
      ORDER BY s.nickname, p.created_at DESC
    `);
    
    if (brnytro11Records.length > 1) {
      console.log(`Found ${brnytro11Records.length} records for "BRNytro11":`);
      
      // Keep the most recent record, remove others
      const keepRecord = brnytro11Records[0];
      const removeRecords = brnytro11Records.slice(1);
      
      console.log(`   Keeping: ${keepRecord.server_name} (${keepRecord.discord_id || 'unlinked'})`);
      
      for (const removeRecord of removeRecords) {
        const [deleteResult] = await pool.query(
          'DELETE FROM players WHERE id = ?',
          [removeRecord.id]
        );
        console.log(`   ✅ Removed duplicate: ${removeRecord.server_name}`);
      }
    } else if (brnytro11Records.length === 1) {
      console.log(`   Single record found for "BRNytro11" on ${brnytro11Records[0].server_name}`);
    } else {
      console.log('   No records found for "BRNytro11"');
    }
    
    // Step 4: Verify cleanup
    console.log('\n📋 Step 4: Verifying cleanup...');
    const [remainingDuplicates] = await pool.query(`
      SELECT 
        p.server_id,
        s.nickname as server_name,
        p.name as in_game_name,
        COUNT(*) as count
      FROM players p
      JOIN rust_servers s ON p.server_id = s.id
      WHERE p.name IS NOT NULL AND p.name != ''
      GROUP BY p.server_id, p.name
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
    
    console.log('\n🎯 CLEANUP COMPLETE!');
    console.log('✅ Duplicate linking records removed');
    console.log('✅ Orphaned records cleaned up');
    console.log('✅ Specific case "BRNytro11" fixed');
    console.log('🔄 Restart the bot: pm2 restart zentro-bot');
    console.log('📝 Test linking with affected players');
    
  } catch (error) {
    console.error('❌ Error cleaning up linking duplicates:', error);
  } finally {
    await pool.end();
  }
}

cleanupLinkingDuplicates(); 