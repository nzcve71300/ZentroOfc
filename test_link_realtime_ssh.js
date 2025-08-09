const pool = require('./src/db');

async function testLinkRealtime() {
  try {
    console.log('🔍 SSH: Testing /link Command in Real-time...');

    // Test the exact scenario from the logs
    const testGuildId = '1379533411009560626'; // Snowy Billiards 2x
    const testDiscordId = '1252993829007528086';
    const testIgn = 'nzcve7130';

    console.log(`\n🧪 Testing /link execution:`);
    console.log(`   Guild ID: ${testGuildId}`);
    console.log(`   Discord ID: ${testDiscordId}`);
    console.log(`   IGN: ${testIgn}`);

    // Step 1: Get all servers for this guild (exact query from link.js line 23-26)
    console.log('\n📋 Step 1: Get all servers for this guild...');
    const [servers] = await pool.query(
      'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
      [testGuildId]
    );

    console.log(`Result: Found ${servers.length} server(s)`);
    if (servers.length === 0) {
      console.log('❌ ERROR: This is where "No Server Found" occurs!');
      console.log('   Message: "No Rust server found for this Discord. Contact an admin."');
      return;
    } else {
      console.log('✅ Servers found:');
      servers.forEach(server => {
        console.log(`   - ${server.nickname} (ID: ${server.id})`);
      });
    }

    // Step 2: Check if Discord ID is already linked to a different IGN
    console.log('\n📋 Step 2: Check existing Discord links...');
    const [existingDiscordLinks] = await pool.query(
      `SELECT p.*, rs.nickname 
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND p.discord_id = ? 
       AND p.is_active = true
       AND LOWER(p.ign) != LOWER(?)`,
      [testGuildId, testDiscordId, testIgn]
    );

    console.log(`Result: Found ${existingDiscordLinks.length} existing Discord link(s)`);
    if (existingDiscordLinks.length > 0) {
      console.log('❌ ERROR: Discord already linked to different IGN');
      const serverList = existingDiscordLinks.map(p => p.nickname).join(', ');
      console.log(`   Message: "Your Discord is already linked to a different in-game name on: ${serverList}"`);
      return;
    }

    // Step 3: Check if IGN is already linked to a different Discord ID
    console.log('\n📋 Step 3: Check existing IGN links...');
    const [existingIgnLinks] = await pool.query(
      `SELECT p.*, rs.nickname 
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND LOWER(p.ign) = LOWER(?) 
       AND p.discord_id != ? 
       AND p.is_active = true`,
      [testGuildId, testIgn, testDiscordId]
    );

    console.log(`Result: Found ${existingIgnLinks.length} existing IGN link(s)`);
    if (existingIgnLinks.length > 0) {
      console.log('❌ ERROR: IGN already linked to different Discord');
      const serverList = existingIgnLinks.map(p => p.nickname).join(', ');
      console.log(`   Message: "This in-game name is already linked to another Discord account on: ${serverList}"`);
      return;
    }

    // Step 4: Check if this exact link already exists
    console.log('\n📋 Step 4: Check exact link exists...');
    const [existingExactLink] = await pool.query(
      `SELECT p.*, rs.nickname 
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND p.discord_id = ? 
       AND LOWER(p.ign) = LOWER(?) 
       AND p.is_active = true`,
      [testGuildId, testDiscordId, testIgn]
    );

    console.log(`Result: Found ${existingExactLink.length} exact link(s)`);
    if (existingExactLink.length > 0) {
      console.log('❌ ERROR: Exact link already exists');
      const serverList = existingExactLink.map(p => p.nickname).join(', ');
      console.log(`   Message: "You are already linked to **${testIgn}** on: ${serverList}"`);
      return;
    }

    // Step 5: Success - should show confirmation
    console.log('\n✅ SUCCESS: All checks passed!');
    console.log('   The /link command should show the confirmation dialog:');
    console.log(`   "Are you sure you want to link to **${testIgn}**?"`);
    console.log(`   "This will link your account across **${servers.length} server(s)**:"`);
    servers.forEach(server => {
      console.log(`   • ${server.nickname}`);
    });

    // Test all guild IDs
    console.log('\n🔄 Testing all guild IDs...');
    const allGuildIds = [
      '1342235198175182921', // Emperor 3x
      '1391149977434329230', // Rise 3x
      '1379533411009560626', // Snowy Billiards 2x
      '1391209638308872254'  // Shadows 3x
    ];

    for (const guildId of allGuildIds) {
      const [testServers] = await pool.query(
        'SELECT id, nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) ORDER BY nickname',
        [guildId]
      );
      
      console.log(`   Guild ${guildId}: ${testServers.length} server(s) - ${testServers.length > 0 ? '✅ WORKS' : '❌ NO SERVERS'}`);
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testLinkRealtime().catch(console.error);