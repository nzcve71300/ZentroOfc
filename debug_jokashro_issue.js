const pool = require('./src/db');

async function debugJokashroIssue() {
  try {
    console.log('🔍 Debugging jokashro Issue...\n');

    const targetIgn = 'jokashro';
    const guildId = '1403300500719538227'; // Mals Mayhem 1
    const userDiscordId = '1169277320708767869'; // The user trying to link
    
    console.log(`1. Checking if jokashro exists in the database...`);
    
    // Check if jokashro exists anywhere
    const [jokashroRecords] = await pool.query(`
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

    console.log(`Found ${jokashroRecords.length} records for IGN "${targetIgn}":`);
    jokashroRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. Discord ID: "${record.discord_id}"`);
      console.log(`      Server: ${record.nickname}`);
      console.log(`      Guild: ${record.guild_discord_id}`);
      console.log(`      Discord ID (hex): ${record.hex_value}`);
      console.log(`      Discord ID (length): ${record.length}`);
      console.log(`      Linked: ${record.linked_at}`);
      console.log('');
    });

    console.log(`2. Checking the user trying to link (Discord ID: ${userDiscordId})...`);
    
    // Check if this user has any existing links
    const [userRecords] = await pool.query(`
      SELECT 
        p.*,
        rs.nickname,
        g.discord_id as guild_discord_id
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON p.guild_id = g.id
      WHERE p.discord_id = ?
      AND p.is_active = true
      ORDER BY p.linked_at DESC
    `, [userDiscordId]);

    console.log(`User ${userDiscordId} has ${userRecords.length} active links:`);
    userRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. IGN: "${record.ign}"`);
      console.log(`      Server: ${record.nickname}`);
      console.log(`      Guild: ${record.guild_discord_id}`);
      console.log(`      Linked: ${record.linked_at}`);
      console.log('');
    });

    console.log(`3. Testing the exact linking scenario...`);
    
    // Simulate what happens when this user tries to link to jokashro
    console.log(`Testing linking scenario:`);
    console.log(`   Guild: ${guildId} (Mals Mayhem 1)`);
    console.log(`   User Discord ID: ${userDiscordId}`);
    console.log(`   Target IGN: ${targetIgn}`);
    
    // Check if this user has any active links in this guild
    const [userGuildLinks] = await pool.query(`
      SELECT p.*, rs.nickname 
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
      AND p.discord_id = ? 
      AND p.is_active = true
    `, [guildId, userDiscordId]);

    console.log(`\nCRITICAL CHECK 1: User ${userDiscordId} has ${userGuildLinks.length} active links in Mals Mayhem 1 guild:`);
    userGuildLinks.forEach(link => {
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
    `, [guildId, targetIgn]);

    console.log(`\nCRITICAL CHECK 2: IGN "${targetIgn}" has ${activeIgnLinks.length} active links in Mals Mayhem 1 guild:`);
    activeIgnLinks.forEach(link => {
      console.log(`   - Discord ID: "${link.discord_id}" on ${link.nickname}`);
    });

    console.log(`\n4. ANALYSIS:`);
    
    if (userGuildLinks.length > 0) {
      console.log(`❌ USER ALREADY LINKED:`);
      console.log(`   - User ${userDiscordId} is already linked to "${userGuildLinks[0].ign}" in this guild`);
      console.log(`   - This triggers the "ONE-TIME LINKING" rule`);
      console.log(`   - The user needs to contact admin to unlink their current IGN first`);
    } else if (activeIgnLinks.length > 0) {
      console.log(`❌ IGN ALREADY TAKEN:`);
      console.log(`   - IGN "${targetIgn}" is already linked to Discord ID "${activeIgnLinks[0].discord_id}"`);
      console.log(`   - This means someone else is using this IGN`);
      console.log(`   - The user needs to use a different IGN or contact admin`);
    } else {
      console.log(`✅ NO CONFLICTS:`);
      console.log(`   - User ${userDiscordId} has no active links in this guild`);
      console.log(`   - IGN "${targetIgn}" is not linked to anyone in this guild`);
      console.log(`   - Linking should work fine`);
      console.log(`   - If it's still failing, there might be another issue`);
    }

    console.log(`\n5. RECOMMENDATION:`);
    if (userGuildLinks.length > 0) {
      console.log(`   The user is already linked to "${userGuildLinks[0].ign}" in this guild`);
      console.log(`   They need to use /unlink or contact admin to unlink first`);
    } else if (activeIgnLinks.length > 0) {
      console.log(`   IGN "${targetIgn}" is already taken by Discord ID "${activeIgnLinks[0].discord_id}"`);
      console.log(`   The user needs to use a different IGN`);
    } else {
      console.log(`   No conflicts found - linking should work`);
      console.log(`   If it's still failing, there might be a bug in the linking logic`);
    }

  } catch (error) {
    console.error('❌ Error debugging jokashro issue:', error);
  } finally {
    await pool.end();
  }
}

debugJokashroIssue();
