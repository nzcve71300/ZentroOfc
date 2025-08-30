const pool = require('./src/db');

async function debugHamstercookieIssue() {
  try {
    console.log('🔍 Debugging Hamstercookie0 Issue...\n');

    const targetIgn = 'Hamstercookie0';
    const problematicDiscordId = '1241672654193426434';
    
    console.log(`1. Checking if Hamstercookie0 exists in the database...`);
    
    // Check if Hamstercookie0 exists anywhere
    const [hamsterRecords] = await pool.query(`
      SELECT 
        p.*,
        rs.nickname,
        g.discord_id as guild_discord_id,
        HEX(p.discord_id) as hex_value,
        LENGTH(p.discord_id) as length
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
      console.log(`      Discord ID (hex): ${record.hex_value}`);
      console.log(`      Discord ID (length): ${record.length}`);
      console.log(`      Linked: ${record.linked_at}`);
      console.log('');
    });

    console.log(`2. Checking the problematic Discord ID ${problematicDiscordId}...`);
    
    // Check what Discord user this Discord ID belongs to
    const [problematicRecords] = await pool.query(`
      SELECT 
        p.*,
        rs.nickname,
        g.discord_id as guild_discord_id
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON p.guild_id = g.id
      WHERE p.discord_id = ?
      ORDER BY p.linked_at DESC
    `, [problematicDiscordId]);

    console.log(`Discord ID ${problematicDiscordId} has ${problematicRecords.length} records:`);
    problematicRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. IGN: "${record.ign}"`);
      console.log(`      Server: ${record.nickname}`);
      console.log(`      Guild: ${record.guild_discord_id}`);
      console.log(`      Linked: ${record.linked_at}`);
      console.log('');
    });

    console.log(`3. Testing the exact linking scenario...`);
    
    // Simulate the exact linking scenario that's failing
    const testGuildId = '1403300500719538227'; // Mals Mayhem 1 guild
    const testDiscordId = '1241672654193426434'; // Your Discord ID
    const testIgn = 'Hamstercookie0'; // The IGN that's failing
    
    console.log(`Testing linking scenario:`);
    console.log(`   Guild: ${testGuildId} (Mals Mayhem 1)`);
    console.log(`   Discord ID: ${testDiscordId} (Your ID)`);
    console.log(`   Target IGN: ${testIgn} (Different person)`);
    
    // Check if this Discord ID has any active links in this guild
    const [activeDiscordLinks] = await pool.query(`
      SELECT p.*, rs.nickname 
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
      AND p.discord_id = ? 
      AND p.is_active = true
    `, [testGuildId, testDiscordId]);

    console.log(`\nCRITICAL CHECK 1: Discord ID ${testDiscordId} has ${activeDiscordLinks.length} active links in this guild:`);
    activeDiscordLinks.forEach(link => {
      console.log(`   - IGN: "${link.ign}" on ${link.nickname}`);
    });

    // Check if this IGN is actively linked to anyone in this guild
    const [activeIgnLinks] = await pool.query(`
      SELECT p.*, rs.nickname 
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
      AND LOWER(p.ign) = LOWER(?) 
      AND p.is_active = true
    `, [testGuildId, testIgn]);

    console.log(`\nCRITICAL CHECK 2: IGN "${testIgn}" has ${activeIgnLinks.length} active links in this guild:`);
    activeIgnLinks.forEach(link => {
      console.log(`   - Discord ID: "${link.discord_id}" on ${link.nickname}`);
    });

    console.log(`\n4. ANALYSIS:`);
    
    if (activeDiscordLinks.length > 0 && activeIgnLinks.length === 0) {
      console.log(`❌ PROBLEM IDENTIFIED:`);
      console.log(`   - You (Discord ID ${testDiscordId}) are already linked to "${activeDiscordLinks[0].ign}" on ${activeDiscordLinks[0].nickname}`);
      console.log(`   - Hamstercookie0 is NOT linked to anyone in this guild`);
      console.log(`   - The bot is blocking Hamstercookie0 because YOU are already linked`);
      console.log(`   - This is the "ONE-TIME LINKING" rule being applied incorrectly`);
      console.log(`   - Hamstercookie0 should be able to link, but the bot thinks they're you`);
    } else if (activeIgnLinks.length > 0) {
      console.log(`❌ PROBLEM IDENTIFIED:`);
      console.log(`   - Hamstercookie0 is already linked to Discord ID "${activeIgnLinks[0].discord_id}"`);
      console.log(`   - This means someone else is using the IGN Hamstercookie0`);
      console.log(`   - The bot is correctly blocking this case`);
    } else {
      console.log(`✅ NO CONFLICTS FOUND:`);
      console.log(`   - You have no active links in this guild`);
      console.log(`   - Hamstercookie0 is not linked to anyone`);
      console.log(`   - Linking should work fine`);
    }

    console.log(`\n5. RECOMMENDATION:`);
    console.log(`   The issue is that the bot is applying "ONE-TIME LINKING" per guild`);
    console.log(`   instead of per server. You should be able to link different IGNs on different servers.`);
    console.log(`   The fix is to change the linking logic to be per-server instead of per-guild.`);

  } catch (error) {
    console.error('❌ Error debugging Hamstercookie0 issue:', error);
  } finally {
    await pool.end();
  }
}

debugHamstercookieIssue();
