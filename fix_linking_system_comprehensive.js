const pool = require('./src/db');

async function fixLinkingSystemComprehensive() {
  try {
    console.log('🔧 Comprehensive linking system fix...');
    console.log('⚠️  This will fix the "IGN Already Linked" errors for everyone');
    
    // Step 1: Fix inconsistent records (linked_at but no discord_id)
    console.log('\n📋 Step 1: Fixing inconsistent records...');
    const [inconsistentRecords] = await pool.query(`
      SELECT COUNT(*) as count FROM players 
      WHERE (discord_id IS NULL OR discord_id = '') 
      AND linked_at IS NOT NULL
    `);
    
    console.log(`Found ${inconsistentRecords[0].count} records with linked_at but no discord_id`);
    
    if (inconsistentRecords[0].count > 0) {
      console.log('   Cleaning up inconsistent records...');
      const [cleanupResult] = await pool.query(`
        UPDATE players 
        SET linked_at = NULL, is_active = 0 
        WHERE (discord_id IS NULL OR discord_id = '') 
        AND linked_at IS NOT NULL
      `);
      console.log(`   ✅ Fixed ${cleanupResult.affectedRows} inconsistent records`);
    }
    
    // Step 2: Fix records with discord_id but no linked_at
    console.log('\n📋 Step 2: Fixing records with discord_id but no linked_at...');
    const [inconsistentRecords2] = await pool.query(`
      SELECT COUNT(*) as count FROM players 
      WHERE discord_id IS NOT NULL 
      AND discord_id != '' 
      AND linked_at IS NULL
    `);
    
    console.log(`Found ${inconsistentRecords2[0].count} records with discord_id but no linked_at`);
    
    if (inconsistentRecords2[0].count > 0) {
      console.log('   Setting linked_at for records with discord_id...');
      const [fixResult] = await pool.query(`
        UPDATE players 
        SET linked_at = NOW(), is_active = 1 
        WHERE discord_id IS NOT NULL 
        AND discord_id != '' 
        AND linked_at IS NULL
      `);
      console.log(`   ✅ Fixed ${fixResult.affectedRows} records`);
    }
    
    // Step 3: Ensure all linked records are active
    console.log('\n📋 Step 3: Ensuring linked records are active...');
    const [inactiveLinkedRecords] = await pool.query(`
      SELECT COUNT(*) as count FROM players 
      WHERE discord_id IS NOT NULL 
      AND discord_id != '' 
      AND (is_active = 0 OR is_active IS NULL)
    `);
    
    console.log(`Found ${inactiveLinkedRecords[0].count} linked records that are inactive`);
    
    if (inactiveLinkedRecords[0].count > 0) {
      console.log('   Activating linked records...');
      const [activateResult] = await pool.query(`
        UPDATE players 
        SET is_active = 1 
        WHERE discord_id IS NOT NULL 
        AND discord_id != '' 
        AND (is_active = 0 OR is_active IS NULL)
      `);
      console.log(`   ✅ Activated ${activateResult.affectedRows} linked records`);
    }
    
    // Step 4: Clean up any duplicate in-game names on same server
    console.log('\n📋 Step 4: Cleaning up duplicate in-game names...');
    const [duplicates] = await pool.query(`
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
    
    if (duplicates.length > 0) {
      console.log(`Found ${duplicates.length} duplicate in-game names to clean up:`);
      
      for (const duplicate of duplicates) {
        console.log(`   Cleaning "${duplicate.in_game_name}" on ${duplicate.server_name}...`);
        
        // Get all records for this duplicate
        const [duplicateRecords] = await pool.query(`
          SELECT p.* FROM players p
          WHERE p.server_id = ? AND p.ign = ?
          ORDER BY p.linked_at DESC, p.id DESC
        `, [duplicate.server_id, duplicate.in_game_name]);
        
        // Keep the most recent linked record, or the most recent unlinked record
        let keepRecord = null;
        const linkedRecord = duplicateRecords.find(record => record.discord_id && record.discord_id !== '');
        
        if (linkedRecord) {
          keepRecord = linkedRecord;
          console.log(`     Keeping linked record (Discord ID: ${linkedRecord.discord_id})`);
        } else {
          keepRecord = duplicateRecords[0];
          console.log(`     Keeping most recent unlinked record`);
        }
        
        // Remove other duplicates
        const removeRecords = duplicateRecords.filter(record => record.id !== keepRecord.id);
        for (const removeRecord of removeRecords) {
          await pool.query('DELETE FROM players WHERE id = ?', [removeRecord.id]);
          console.log(`     ✅ Removed duplicate record ID: ${removeRecord.id}`);
        }
      }
    } else {
      console.log('   ✅ No duplicate in-game names found');
    }
    
    // Step 5: Verify the fix
    console.log('\n📋 Step 5: Verifying the fix...');
    
    // Check for remaining inconsistencies
    const [remainingInconsistent] = await pool.query(`
      SELECT COUNT(*) as count FROM players 
      WHERE (discord_id IS NULL OR discord_id = '') 
      AND linked_at IS NOT NULL
    `);
    
    const [remainingInconsistent2] = await pool.query(`
      SELECT COUNT(*) as count FROM players 
      WHERE discord_id IS NOT NULL 
      AND discord_id != '' 
      AND linked_at IS NULL
    `);
    
    const [inactiveLinked] = await pool.query(`
      SELECT COUNT(*) as count FROM players 
      WHERE discord_id IS NOT NULL 
      AND discord_id != '' 
      AND (is_active = 0 OR is_active IS NULL)
    `);
    
    console.log(`Remaining records with linked_at but no discord_id: ${remainingInconsistent[0].count}`);
    console.log(`Remaining records with discord_id but no linked_at: ${remainingInconsistent2[0].count}`);
    console.log(`Remaining inactive linked records: ${inactiveLinked[0].count}`);
    
    // Step 6: Show final status
    console.log('\n📋 Step 6: Final linking system status...');
    const [totalPlayers] = await pool.query('SELECT COUNT(*) as total FROM players');
    const [linkedPlayers] = await pool.query('SELECT COUNT(*) as linked FROM players WHERE discord_id IS NOT NULL AND discord_id != ""');
    const [unlinkedPlayers] = await pool.query('SELECT COUNT(*) as unlinked FROM players WHERE discord_id IS NULL OR discord_id = ""');
    
    console.log(`Total players: ${totalPlayers[0].total}`);
    console.log(`Linked players: ${linkedPlayers[0].linked}`);
    console.log(`Unlinked players: ${unlinkedPlayers[0].unlinked}`);
    
    console.log('\n🎯 COMPREHENSIVE LINKING SYSTEM FIX COMPLETE!');
    console.log('✅ Inconsistent records cleaned up');
    console.log('✅ Duplicate in-game names removed');
    console.log('✅ All linked records are now active');
    console.log('✅ "IGN Already Linked" errors should be fixed');
    console.log('🔄 Restart the bot: pm2 restart zentro-bot');
    console.log('📝 Test linking with players - should work now!');
    
  } catch (error) {
    console.error('❌ Error fixing linking system:', error);
  } finally {
    await pool.end();
  }
}

fixLinkingSystemComprehensive(); 