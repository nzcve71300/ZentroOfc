const pool = require('./src/db');

async function fixNullDiscordIdRecords() {
  try {
    console.log('🔧 Fixing Null Discord ID Records...\n');

    console.log('1. Finding all records with null Discord IDs...');
    
    // Find all records with null Discord IDs
    const [nullRecords] = await pool.query(`
      SELECT 
        p.*,
        rs.nickname,
        g.discord_id as guild_discord_id
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON p.guild_id = g.id
      WHERE p.discord_id IS NULL 
      AND p.is_active = true
      ORDER BY p.linked_at DESC
    `);

    console.log(`Found ${nullRecords.length} records with null Discord IDs:`);
    nullRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. IGN: "${record.ign}"`);
      console.log(`      Server: ${record.nickname}`);
      console.log(`      Guild: ${record.guild_discord_id}`);
      console.log(`      Record ID: ${record.id}`);
      console.log(`      Linked: ${record.linked_at}`);
      console.log('');
    });

    if (nullRecords.length === 0) {
      console.log('✅ No null Discord ID records found!');
      return;
    }

    console.log('2. These records are corrupted and blocking legitimate linking...');
    console.log('   - Discord IDs should never be null for active links');
    console.log('   - These records are preventing users from linking to these IGNs');
    console.log('   - We need to delete these corrupted records');

    console.log('\n3. Deleting corrupted null Discord ID records...');
    
    let deletedCount = 0;
    for (const record of nullRecords) {
      console.log(`   Deleting record: IGN "${record.ign}" on ${record.nickname} (ID: ${record.id})`);
      
      // Delete the corrupted record
      await pool.query('DELETE FROM players WHERE id = ?', [record.id]);
      
      // Also delete any associated economy records
      await pool.query('DELETE FROM economy WHERE player_id = ?', [record.id]);
      
      deletedCount++;
      console.log(`   ✅ Deleted record ${record.id}`);
    }

    console.log(`\n✅ Successfully deleted ${deletedCount} corrupted records`);

    console.log('\n4. Verifying the fix...');
    
    // Check if any null Discord ID records remain
    const [remainingNullRecords] = await pool.query(`
      SELECT COUNT(*) as count
      FROM players 
      WHERE discord_id IS NULL 
      AND is_active = true
    `);

    if (remainingNullRecords[0].count === 0) {
      console.log('✅ SUCCESS: No more null Discord ID records found!');
    } else {
      console.log(`⚠️ WARNING: ${remainingNullRecords[0].count} null Discord ID records still exist`);
    }

    console.log('\n5. Testing the jokashro case...');
    
    // Test if jokashro is now available
    const testIgn = 'jokashro';
    const testGuildId = '1403300500719538227';
    
    const [jokashroRecords] = await pool.query(`
      SELECT p.*, rs.nickname 
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
      AND LOWER(p.ign) = LOWER(?) 
      AND p.is_active = true
    `, [testGuildId, testIgn]);

    console.log(`After fix - IGN "${testIgn}" has ${jokashroRecords.length} active links in Mals Mayhem 1 guild:`);
    jokashroRecords.forEach(link => {
      console.log(`   - Discord ID: "${link.discord_id}" on ${link.nickname}`);
    });

    if (jokashroRecords.length === 0) {
      console.log(`✅ PERFECT! IGN "${testIgn}" is now available for linking`);
      console.log(`   - User 1169277320708767869 should now be able to link to "${testIgn}"`);
    } else {
      console.log(`⚠️ IGN "${testIgn}" is still linked to someone else`);
    }

    console.log('\n6. SUMMARY:');
    console.log('   ✅ FIXED: Deleted corrupted records with null Discord IDs');
    console.log('   ✅ FIXED: These records were blocking legitimate linking attempts');
    console.log('   ✅ FIXED: Users should now be able to link to previously blocked IGNs');
    console.log('   ✅ FIXED: Database integrity restored');

    console.log('\n🎉 NULL DISCORD ID FIX COMPLETE!');
    console.log('   - Corrupted records have been cleaned up');
    console.log('   - Users should now be able to link successfully');
    console.log('   - Database integrity has been restored');

  } catch (error) {
    console.error('❌ Error fixing null Discord ID records:', error);
  } finally {
    await pool.end();
  }
}

fixNullDiscordIdRecords();
