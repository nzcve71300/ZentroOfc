const pool = require('./src/db');

async function fixDuplicatePlayers() {
  try {
    console.log('🔧 SSH: Fixing Duplicate Player Records...');

    const testGuildId = '1379533411009560626'; // Snowy Billiards 2x
    const testPlayer = 'CrashPompano643';
    const testDiscordId = '1252993829007528086';
    const testServerId = '1754690822459_bxb3nuglj';

    // Find all records for this player
    console.log('\n📋 Finding all records for this player...');
    const [allRecords] = await pool.query(
      `SELECT id, discord_id, ign, is_active, server_id, linked_at, unlinked_at 
       FROM players 
       WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND (LOWER(ign) = LOWER(?) OR discord_id = ?)
       ORDER BY id`,
      [testGuildId, testPlayer, testDiscordId]
    );

    console.log(`Found ${allRecords.length} record(s):`);
    allRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.id}, Discord: ${record.discord_id}, IGN: ${record.ign}, Active: ${record.is_active}, Server: ${record.server_id}`);
      console.log(`      Linked: ${record.linked_at}, Unlinked: ${record.unlinked_at}`);
    });

    // Identify duplicates
    const activeRecords = allRecords.filter(r => r.is_active);
    const inactiveRecords = allRecords.filter(r => !r.is_active);
    const withDiscordId = allRecords.filter(r => r.discord_id !== null);
    const withoutDiscordId = allRecords.filter(r => r.discord_id === null);

    console.log(`\n📊 Analysis:`);
    console.log(`   Active records: ${activeRecords.length}`);
    console.log(`   Inactive records: ${inactiveRecords.length}`);
    console.log(`   With Discord ID: ${withDiscordId.length}`);
    console.log(`   Without Discord ID: ${withoutDiscordId.length}`);

    // Strategy: Keep the best record, remove duplicates
    console.log('\n🔧 Fixing duplicates...');

    // Find the best record to keep
    let recordToKeep = null;
    let recordsToDelete = [];

    if (withDiscordId.length > 0) {
      // Prefer active record with Discord ID
      recordToKeep = withDiscordId.find(r => r.is_active) || withDiscordId[0];
      recordsToDelete = allRecords.filter(r => r.id !== recordToKeep.id);
    } else if (activeRecords.length > 0) {
      // Keep the active record
      recordToKeep = activeRecords[0];
      recordsToDelete = allRecords.filter(r => r.id !== recordToKeep.id);
    } else {
      // Keep the most recent record
      recordToKeep = allRecords[allRecords.length - 1];
      recordsToDelete = allRecords.filter(r => r.id !== recordToKeep.id);
    }

    console.log(`Record to keep: ID ${recordToKeep.id} (Discord: ${recordToKeep.discord_id}, IGN: ${recordToKeep.ign}, Active: ${recordToKeep.is_active})`);
    console.log(`Records to delete: ${recordsToDelete.length}`);

    // Delete duplicate records
    for (const record of recordsToDelete) {
      console.log(`🗑️  Deleting duplicate record ID ${record.id}`);
      
      // First delete any economy records linked to this player
      await pool.query('DELETE FROM economy WHERE player_id = ?', [record.id]);
      console.log(`   Deleted economy records for player ${record.id}`);
      
      // Delete the player record
      await pool.query('DELETE FROM players WHERE id = ?', [record.id]);
      console.log(`   Deleted player record ${record.id}`);
    }

    // Now fix the remaining record
    console.log(`\n🔧 Fixing the remaining record (ID ${recordToKeep.id})...`);
    
    if (recordToKeep.discord_id === null || !recordToKeep.is_active) {
      await pool.query(
        `UPDATE players 
         SET discord_id = ?, is_active = true, linked_at = CURRENT_TIMESTAMP, ign = ?
         WHERE id = ?`,
        [testDiscordId, testPlayer, recordToKeep.id]
      );
      console.log('✅ Updated record with correct Discord ID and activated it');
    } else {
      console.log('✅ Record is already correct');
    }

    // Create economy record if it doesn't exist
    console.log('\n💰 Ensuring economy record exists...');
    const [economyCheck] = await pool.query('SELECT id FROM economy WHERE player_id = ?', [recordToKeep.id]);
    
    if (economyCheck.length === 0) {
      const [guildIdResult] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [testGuildId]);
      const guildIdInternal = guildIdResult[0].id;
      
      await pool.query(
        'INSERT INTO economy (player_id, guild_id, balance) VALUES (?, ?, ?)',
        [recordToKeep.id, guildIdInternal, 0]
      );
      console.log('✅ Created economy record');
    } else {
      console.log('✅ Economy record already exists');
    }

    // Verify the final state
    console.log('\n✅ Final verification...');
    const [finalRecord] = await pool.query('SELECT * FROM players WHERE id = ?', [recordToKeep.id]);
    const finalPlayer = finalRecord[0];
    
    console.log(`Final record:`);
    console.log(`   ID: ${finalPlayer.id}`);
    console.log(`   Discord ID: ${finalPlayer.discord_id}`);
    console.log(`   IGN: ${finalPlayer.ign}`);
    console.log(`   Active: ${finalPlayer.is_active}`);
    console.log(`   Server: ${finalPlayer.server_id}`);

    // Test /unlink query
    console.log('\n🧪 Testing /unlink query...');
    const [unlinkTest] = await pool.query(
      `SELECT id, discord_id, ign, is_active 
       FROM players 
       WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND LOWER(ign) = LOWER(?) 
       AND is_active = true`,
      [testGuildId, testPlayer]
    );

    if (unlinkTest.length > 0) {
      console.log('✅ /unlink query will now find the player');
    } else {
      console.log('❌ /unlink query still won\'t find the player');
    }

    console.log('\n🎉 Duplicate player fix completed!');
    console.log('💡 Now test:');
    console.log('1. /unlink CrashPompano643 - should work');
    console.log('2. Regular /link - should work without duplicate errors');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixDuplicatePlayers().catch(console.error);