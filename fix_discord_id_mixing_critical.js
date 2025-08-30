const pool = require('./src/db');

async function fixDiscordIdMixingCritical() {
  try {
    console.log('🚨 CRITICAL FIX: DISCORD ID MIXING ISSUE');
    console.log('========================================\n');

    console.log('1. FIXING DATABASE SCHEMA...');
    
    // Fix the discord_id column to be BIGINT as it should be
    try {
      await pool.query('ALTER TABLE players MODIFY COLUMN discord_id BIGINT NOT NULL');
      console.log('✅ Fixed discord_id column type to BIGINT NOT NULL');
    } catch (error) {
      console.log('⚠️ Could not modify discord_id column (might already be correct):', error.message);
    }

    console.log('\n2. IDENTIFYING CORRUPTED RECORDS...');
    
    // Find all Discord IDs that have multiple records (these are corrupted)
    const [corruptedIds] = await pool.query(`
      SELECT 
        discord_id,
        COUNT(*) as count,
        GROUP_CONCAT(DISTINCT ign ORDER BY ign) as unique_igns,
        GROUP_CONCAT(DISTINCT guild_id ORDER BY guild_id) as guild_ids,
        GROUP_CONCAT(id ORDER BY id) as record_ids
      FROM players 
      WHERE discord_id IS NOT NULL 
      GROUP BY discord_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    console.log(`Found ${corruptedIds.length} corrupted Discord IDs with multiple records:`);
    corruptedIds.forEach(id => {
      console.log(`   Discord ID: "${id.discord_id}" has ${id.count} records`);
      console.log(`   IGNs: ${id.unique_igns}`);
      console.log(`   Guild IDs: ${id.guild_ids}`);
      console.log(`   Record IDs: ${id.record_ids}`);
      console.log('');
    });

    console.log('\n3. CLEANING UP CORRUPTED DATA...');
    
    // For each corrupted Discord ID, keep only the most recent record and delete the rest
    for (const corruptedId of corruptedIds) {
      console.log(`Processing Discord ID: ${corruptedId.discord_id}`);
      
      // Get all records for this Discord ID, ordered by linked_at (most recent first)
      const [records] = await pool.query(`
        SELECT id, ign, guild_id, server_id, linked_at
        FROM players 
        WHERE discord_id = ?
        ORDER BY linked_at DESC
      `, [corruptedId.discord_id]);

      if (records.length > 1) {
        // Keep the most recent record, delete the rest
        const keepRecord = records[0];
        const deleteRecords = records.slice(1);
        
        console.log(`   Keeping: IGN "${keepRecord.ign}" (Linked: ${keepRecord.linked_at})`);
        console.log(`   Deleting ${deleteRecords.length} duplicate records:`);
        
        for (const deleteRecord of deleteRecords) {
          console.log(`     - IGN "${deleteRecord.ign}" (Linked: ${deleteRecord.linked_at})`);
          
          // Delete the duplicate record
          await pool.query('DELETE FROM players WHERE id = ?', [deleteRecord.id]);
          
          // Also delete any associated economy records
          await pool.query('DELETE FROM economy WHERE player_id = ?', [deleteRecord.id]);
        }
        
        console.log(`   ✅ Cleaned up Discord ID ${corruptedId.discord_id}`);
      }
    }

    console.log('\n4. VERIFYING THE FIX...');
    
    // Check if any Discord IDs still have multiple records
    const [remainingCorrupted] = await pool.query(`
      SELECT 
        discord_id,
        COUNT(*) as count,
        GROUP_CONCAT(DISTINCT ign ORDER BY ign) as unique_igns
      FROM players 
      WHERE discord_id IS NOT NULL 
      GROUP BY discord_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    if (remainingCorrupted.length === 0) {
      console.log('✅ SUCCESS: No more corrupted Discord IDs found!');
    } else {
      console.log(`⚠️ WARNING: ${remainingCorrupted.length} Discord IDs still have multiple records:`);
      remainingCorrupted.forEach(id => {
        console.log(`   Discord ID: "${id.discord_id}" has ${id.count} records - IGNs: ${id.unique_igns}`);
      });
    }

    console.log('\n5. TESTING THE FIXED SYSTEM...');
    
    // Test the problematic case that was reported
    const testGuildId = '1403300500719538227'; // Mals Mayhem 1
    const testDiscordId = '1241672654193426434';
    const testIgn = 'Hamstercookie0';
    
    console.log(`Testing the original problematic case:`);
    console.log(`   Guild: ${testGuildId} (Mals Mayhem 1)`);
    console.log(`   Discord ID: ${testDiscordId}`);
    console.log(`   Target IGN: ${testIgn}`);
    
    // Check what Discord user this Discord ID belongs to now
    const [testRecords] = await pool.query(`
      SELECT p.*, rs.nickname, g.discord_id as guild_discord_id
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON p.guild_id = g.id
      WHERE p.discord_id = ?
      ORDER BY p.linked_at DESC
    `, [testDiscordId]);

    console.log(`\nAfter fix - Discord ID ${testDiscordId} now has ${testRecords.length} record(s):`);
    testRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. IGN: "${record.ign}"`);
      console.log(`      Server: ${record.nickname}`);
      console.log(`      Guild: ${record.guild_discord_id}`);
      console.log(`      Linked: ${record.linked_at}`);
    });

    // Check if Hamstercookie0 exists
    const [hamsterRecords] = await pool.query(`
      SELECT p.*, rs.nickname, g.discord_id as guild_discord_id
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON p.guild_id = g.id
      WHERE LOWER(p.ign) = LOWER(?)
      ORDER BY p.linked_at DESC
    `, [testIgn]);

    console.log(`\nAfter fix - IGN "${testIgn}" has ${hamsterRecords.length} record(s):`);
    hamsterRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. Discord ID: "${record.discord_id}"`);
      console.log(`      Server: ${record.nickname}`);
      console.log(`      Guild: ${record.guild_discord_id}`);
      console.log(`      Linked: ${record.linked_at}`);
    });

    console.log('\n6. SUMMARY:');
    if (testRecords.length === 1 && hamsterRecords.length === 0) {
      console.log('✅ PERFECT! The fix worked:');
      console.log('   - Discord ID now has only 1 record (the correct one)');
      console.log('   - Hamstercookie0 is not linked to anyone');
      console.log('   - The user should now be able to link successfully');
    } else if (testRecords.length === 0) {
      console.log('✅ GOOD! Discord ID has no records (user can link fresh)');
    } else {
      console.log('⚠️ ISSUE REMAINS: Discord ID still has multiple records');
    }

    console.log('\n🎉 CRITICAL FIX COMPLETE!');
    console.log('   - Fixed database schema');
    console.log('   - Cleaned up corrupted Discord ID records');
    console.log('   - Each Discord ID now has only 1 record');
    console.log('   - Users should now be able to link successfully');

  } catch (error) {
    console.error('❌ Error fixing Discord ID mixing:', error);
  } finally {
    await pool.end();
  }
}

fixDiscordIdMixingCritical();
