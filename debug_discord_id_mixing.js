const pool = require('./src/db');
const { compareDiscordIds, normalizeDiscordId } = require('./src/utils/discordUtils');

async function debugDiscordIdMixing() {
  try {
    console.log('🔍 Debugging Discord ID Mixing Issue...\n');

    // The problematic Discord ID from the diagnostic
    const problematicDiscordId = '1241672654193426434';
    
    console.log(`1. Investigating Discord ID: ${problematicDiscordId}\n`);

    // Check ALL records for this Discord ID
    const [allRecords] = await pool.query(`
      SELECT p.*, rs.nickname, g.discord_id as guild_discord_id
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON p.guild_id = g.id
      WHERE p.discord_id = ?
      ORDER BY p.linked_at DESC
    `, [problematicDiscordId]);

    console.log(`Found ${allRecords.length} total records for Discord ID ${problematicDiscordId}:`);
    allRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. IGN: "${record.ign}"`);
      console.log(`      Server: ${record.nickname}`);
      console.log(`      Guild: ${record.guild_discord_id}`);
      console.log(`      Discord ID: "${record.discord_id}"`);
      console.log(`      Active: ${record.is_active}`);
      console.log(`      Linked: ${record.linked_at}`);
      console.log('');
    });

    // Check if there are any other Discord IDs that might be getting mixed up
    console.log('2. Checking for Discord ID format issues...');
    
    const [discordIdFormats] = await pool.query(`
      SELECT discord_id, COUNT(*) as count
      FROM players 
      WHERE discord_id IS NOT NULL 
      GROUP BY discord_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 10
    `);

    console.log(`Found ${discordIdFormats.length} Discord IDs with multiple records:`);
    discordIdFormats.forEach(format => {
      console.log(`   Discord ID: "${format.discord_id}" has ${format.count} records`);
    });

    // Check for potential Discord ID corruption
    console.log('\n3. Checking for Discord ID corruption...');
    
    const [corruptedIds] = await pool.query(`
      SELECT discord_id, COUNT(*) as count
      FROM players 
      WHERE discord_id IS NOT NULL 
      AND (LENGTH(discord_id) < 17 OR LENGTH(discord_id) > 20)
      GROUP BY discord_id
      LIMIT 10
    `);

    console.log(`Found ${corruptedIds.length} potentially corrupted Discord IDs:`);
    corruptedIds.forEach(corrupt => {
      console.log(`   Discord ID: "${corrupt.discord_id}" (Length: ${corrupt.discord_id.length}) has ${corrupt.count} records`);
    });

    // Test the exact comparison logic
    console.log('\n4. Testing Discord ID comparison logic...');
    
    const testIds = [
      '1241672654193426434',
      '1241672654193426434 ',
      ' 1241672654193426434',
      '1241672654193426434\n',
      '1241672654193426434\t'
    ];

    testIds.forEach((id, index) => {
      const normalized = normalizeDiscordId(id);
      const comparison = compareDiscordIds(problematicDiscordId, id);
      console.log(`   Test ${index + 1}: "${id}" -> Normalized: "${normalized}" -> Match: ${comparison}`);
    });

    // Check if there are any invisible characters or encoding issues
    console.log('\n5. Checking for invisible characters...');
    
    const [invisibleCharTest] = await pool.query(`
      SELECT discord_id, HEX(discord_id) as hex_value
      FROM players 
      WHERE discord_id = ?
      LIMIT 5
    `, [problematicDiscordId]);

    invisibleCharTest.forEach(test => {
      console.log(`   Discord ID: "${test.discord_id}" -> Hex: ${test.hex_value}`);
    });

    console.log('\n6. CRITICAL FINDING:');
    console.log('   The bot is treating different Discord users as the same person!');
    console.log('   This suggests either:');
    console.log('   - Discord ID storage corruption');
    console.log('   - Comparison logic failure');
    console.log('   - Invisible characters in Discord IDs');
    console.log('   - Database encoding issues');

  } catch (error) {
    console.error('❌ Error debugging Discord ID mixing:', error);
  } finally {
    await pool.end();
  }
}

debugDiscordIdMixing();
