const pool = require('./src/db');

async function debugDiscordUserMixing() {
  try {
    console.log('🔍 Debugging Discord User Mixing Issue...\n');

    // The problematic case
    const guildId = '1403300500719538227'; // Mals Mayhem 1
    const discordId = '1241672654193426434';
    const targetIgn = 'Hamstercookie0';
    
    console.log(`1. Investigating the problematic case:`);
    console.log(`   Guild: ${guildId} (Mals Mayhem 1)`);
    console.log(`   Discord ID: ${discordId}`);
    console.log(`   Target IGN: ${targetIgn}`);
    console.log('');

    // Check what Discord user this Discord ID actually belongs to
    console.log('2. Checking what Discord user this Discord ID belongs to...');
    
    // Get all records for this Discord ID across all guilds
    const [allRecords] = await pool.query(`
      SELECT p.*, rs.nickname, g.discord_id as guild_discord_id
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON p.guild_id = g.id
      WHERE p.discord_id = ?
      ORDER BY p.linked_at DESC
    `, [discordId]);

    console.log(`Found ${allRecords.length} total records for Discord ID ${discordId}:`);
    allRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. IGN: "${record.ign}"`);
      console.log(`      Server: ${record.nickname}`);
      console.log(`      Guild: ${record.guild_discord_id}`);
      console.log(`      Linked: ${record.linked_at}`);
      console.log('');
    });

    // Check if there are any records for Hamstercookie0
    console.log('3. Checking if Hamstercookie0 exists in the database...');
    
    const [hamsterRecords] = await pool.query(`
      SELECT p.*, rs.nickname, g.discord_id as guild_discord_id
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON p.guild_id = g.id
      WHERE LOWER(p.ign) = LOWER(?)
      ORDER BY p.linked_at DESC
    `, [targetIgn]);

    console.log(`Found ${hamsterRecords.length} records for IGN "${targetIgn}":`);
    hamsterRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. Discord ID: "${record.discord_id}"`);
      console.log(`      Server: ${record.nickname}`);
      console.log(`      Guild: ${record.guild_discord_id}`);
      console.log(`      Linked: ${record.linked_at}`);
      console.log('');
    });

    // Check if there are any Discord IDs that might be getting mixed up
    console.log('4. Checking for Discord ID conflicts or corruption...');
    
    // Look for any Discord IDs that might be similar or corrupted
    const [similarIds] = await pool.query(`
      SELECT discord_id, COUNT(*) as count
      FROM players 
      WHERE discord_id IS NOT NULL 
      AND discord_id LIKE ?
      GROUP BY discord_id
      ORDER BY count DESC
      LIMIT 10
    `, [`%${discordId.slice(-6)}%`]); // Look for IDs ending with similar digits

    console.log(`Found ${similarIds.length} Discord IDs with similar endings:`);
    similarIds.forEach(id => {
      console.log(`   Discord ID: "${id.discord_id}" has ${id.count} records`);
    });

    // Check for potential Discord ID truncation or corruption
    console.log('\n5. Checking for Discord ID truncation...');
    
    const [truncatedIds] = await pool.query(`
      SELECT discord_id, LENGTH(discord_id) as length, COUNT(*) as count
      FROM players 
      WHERE discord_id IS NOT NULL 
      AND LENGTH(discord_id) < 17
      GROUP BY discord_id, LENGTH(discord_id)
      ORDER BY count DESC
      LIMIT 10
    `);

    console.log(`Found ${truncatedIds.length} potentially truncated Discord IDs:`);
    truncatedIds.forEach(id => {
      console.log(`   Discord ID: "${id.discord_id}" (Length: ${id.length}) has ${id.count} records`);
    });

    // Check if there are any invisible characters or encoding issues
    console.log('\n6. Checking for invisible characters in Discord IDs...');
    
    const [invisibleCharTest] = await pool.query(`
      SELECT discord_id, HEX(discord_id) as hex_value, LENGTH(discord_id) as length
      FROM players 
      WHERE discord_id = ?
      LIMIT 5
    `, [discordId]);

    invisibleCharTest.forEach(test => {
      console.log(`   Discord ID: "${test.discord_id}" (Length: ${test.length}) -> Hex: ${test.hex_value}`);
    });

    console.log('\n7. CRITICAL ANALYSIS:');
    console.log('   The issue appears to be that different Discord users are being');
    console.log('   assigned the same Discord ID in the database.');
    console.log('   This could be caused by:');
    console.log('   - Discord ID truncation during storage');
    console.log('   - Database encoding issues');
    console.log('   - Bot logic errors in Discord ID handling');
    console.log('   - Race conditions during linking');
    console.log('   - Invisible characters corrupting the Discord ID');

    console.log('\n8. RECOMMENDATIONS:');
    console.log('   - Check the Discord ID column type in the database');
    console.log('   - Verify Discord ID storage format');
    console.log('   - Add validation to ensure Discord IDs are unique');
    console.log('   - Check for any bot logic that might be corrupting Discord IDs');
    console.log('   - Add logging to track Discord ID changes');

  } catch (error) {
    console.error('❌ Error debugging Discord user mixing:', error);
  } finally {
    await pool.end();
  }
}

debugDiscordUserMixing();
