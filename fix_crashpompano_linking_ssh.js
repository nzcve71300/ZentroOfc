const pool = require('./src/db');

async function fixCrashPompanoLinking() {
  try {
    console.log('🔧 SSH: Fixing CrashPompano643 Linking Issues...');

    const testGuildId = '1379533411009560626'; // Snowy Billiards 2x
    const crashPompanoIgn = 'CrashPompano643';
    const crashPompanoDiscordId = '1078482807027941426'; // From the error log
    const serverId = '1754690822459_bxb3nuglj';

    console.log(`\n🧪 Working with:`);
    console.log(`   Guild ID: ${testGuildId}`);
    console.log(`   IGN: ${crashPompanoIgn}`);
    console.log(`   Discord ID: ${crashPompanoDiscordId}`);
    console.log(`   Server ID: ${serverId}`);

    // Find all records for this IGN
    console.log('\n📋 Finding all records for IGN "CrashPompano643"...');
    const [ignRecords] = await pool.query(
      `SELECT id, discord_id, ign, is_active, server_id, linked_at, unlinked_at 
       FROM players 
       WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND LOWER(ign) = LOWER(?)
       ORDER BY id`,
      [testGuildId, crashPompanoIgn]
    );

    console.log(`Found ${ignRecords.length} record(s) for IGN "${crashPompanoIgn}":`);
    ignRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.id}, Discord: ${record.discord_id}, Active: ${record.is_active}`);
      console.log(`      Linked: ${record.linked_at}, Unlinked: ${record.unlinked_at}`);
    });

    // Find records for the Discord ID trying to link
    console.log(`\n📋 Finding records for Discord ID "${crashPompanoDiscordId}"...`);
    const [discordRecords] = await pool.query(
      `SELECT id, discord_id, ign, is_active, server_id 
       FROM players 
       WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND discord_id = ?`,
      [testGuildId, crashPompanoDiscordId]
    );

    console.log(`Found ${discordRecords.length} record(s) for Discord ID "${crashPompanoDiscordId}":`);
    discordRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. ID: ${record.id}, IGN: ${record.ign}, Active: ${record.is_active}`);
    });

    // Strategy: Create a proper active record for CrashPompano643
    console.log('\n🔧 Creating proper record for CrashPompano643...');

    // First, deactivate any existing records for this IGN
    if (ignRecords.length > 0) {
      console.log('🔄 Deactivating existing records for this IGN...');
      await pool.query(
        `UPDATE players 
         SET is_active = false, unlinked_at = CURRENT_TIMESTAMP 
         WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
         AND LOWER(ign) = LOWER(?)`,
        [testGuildId, crashPompanoIgn]
      );
      console.log('✅ Deactivated existing records');
    }

    // Create a new active record
    console.log('🔄 Creating new active record...');
    try {
      const [insertResult] = await pool.query(
        `INSERT INTO players (guild_id, server_id, discord_id, ign, linked_at, is_active) 
         VALUES ((SELECT id FROM guilds WHERE discord_id = ?), ?, ?, ?, CURRENT_TIMESTAMP, true)`,
        [testGuildId, serverId, crashPompanoDiscordId, crashPompanoIgn]
      );
      
      const newPlayerId = insertResult.insertId;
      console.log(`✅ Created new player record with ID: ${newPlayerId}`);

      // Create economy record
      console.log('💰 Creating economy record...');
      const [guildIdResult] = await pool.query('SELECT id FROM guilds WHERE discord_id = ?', [testGuildId]);
      const guildIdInternal = guildIdResult[0].id;
      
      await pool.query(
        'INSERT INTO economy (player_id, guild_id, balance) VALUES (?, ?, ?)',
        [newPlayerId, guildIdInternal, 0]
      );
      console.log('✅ Created economy record');

    } catch (insertError) {
      if (insertError.code === 'ER_DUP_ENTRY') {
        console.log('⚠️  Record already exists, trying to reactivate...');
        
        // Find and reactivate existing record
        const [existingRecord] = await pool.query(
          `SELECT id FROM players 
           WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
           AND server_id = ? 
           AND discord_id = ? 
           AND LOWER(ign) = LOWER(?)`,
          [testGuildId, serverId, crashPompanoDiscordId, crashPompanoIgn]
        );
        
        if (existingRecord.length > 0) {
          await pool.query(
            `UPDATE players 
             SET is_active = true, linked_at = CURRENT_TIMESTAMP, unlinked_at = NULL 
             WHERE id = ?`,
            [existingRecord[0].id]
          );
          console.log('✅ Reactivated existing record');
        }
      } else {
        throw insertError;
      }
    }

    // Test /unlink query
    console.log('\n🧪 Testing /unlink query for CrashPompano643...');
    const [unlinkTest] = await pool.query(
      `SELECT id, discord_id, ign, is_active 
       FROM players 
       WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND LOWER(ign) = LOWER(?) 
       AND is_active = true`,
      [testGuildId, crashPompanoIgn]
    );

    if (unlinkTest.length > 0) {
      console.log('✅ /unlink CrashPompano643 will now work');
      console.log(`   Found record: ID ${unlinkTest[0].id}, Discord: ${unlinkTest[0].discord_id}`);
    } else {
      console.log('❌ /unlink query still won\'t find the player');
    }

    // Test /link for the Discord ID
    console.log('\n🧪 Testing /link for Discord ID...');
    const [linkTest] = await pool.query(
      `SELECT COUNT(*) as count FROM players 
       WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND server_id = ? 
       AND discord_id = ? 
       AND LOWER(ign) = LOWER(?)`,
      [testGuildId, serverId, crashPompanoDiscordId, crashPompanoIgn]
    );

    if (linkTest[0].count > 0) {
      console.log('✅ /link should now work without duplicate errors');
    } else {
      console.log('❌ /link might still have issues');
    }

    console.log('\n🎉 CrashPompano643 linking fix completed!');
    console.log('💡 Now test:');
    console.log(`1. /unlink ${crashPompanoIgn} - should work`);
    console.log(`2. User with Discord ID ${crashPompanoDiscordId} can try /link again`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixCrashPompanoLinking().catch(console.error);