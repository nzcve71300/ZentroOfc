const pool = require('./src/db');

async function verifyMultitenantIssue() {
  try {
    console.log('🔍 Verifying multi-tenant issue...');
    
    const playerIgn = 'XsLdSsG';
    const currentGuildId = '1391149977434329230';  // Guild where they're trying to link
    const existingGuildId = '1376030083038318743'; // Guild where they're already linked
    
    console.log(`\n📋 Multi-tenant verification:`);
    console.log(`Player IGN: ${playerIgn}`);
    console.log(`Current Guild (trying to link): ${currentGuildId}`);
    console.log(`Existing Guild (already linked): ${existingGuildId}`);
    
    // Check both guilds
    const [currentGuild] = await pool.query('SELECT * FROM guilds WHERE discord_id = ?', [currentGuildId]);
    const [existingGuild] = await pool.query('SELECT * FROM guilds WHERE discord_id = ?', [existingGuildId]);
    
    console.log(`\n🏛️ Guild Information:`);
    console.log(`Current Guild: ${currentGuild[0]?.name || 'NOT FOUND'} (DB ID: ${currentGuild[0]?.id || 'N/A'})`);
    console.log(`Existing Guild: ${existingGuild[0]?.name || 'NOT FOUND'} (DB ID: ${existingGuild[0]?.id || 'N/A'})`);
    
    // Check servers in each guild
    console.log(`\n🖥️ Servers per guild:`);
    
    if (currentGuild[0]) {
      const [currentServers] = await pool.query('SELECT * FROM rust_servers WHERE guild_id = ?', [currentGuild[0].id]);
      console.log(`Current Guild servers: ${currentServers.length}`);
      currentServers.forEach(server => {
        console.log(`  - ${server.nickname} (${server.id})`);
      });
    }
    
    if (existingGuild[0]) {
      const [existingServers] = await pool.query('SELECT * FROM rust_servers WHERE guild_id = ?', [existingGuild[0].id]);
      console.log(`Existing Guild servers: ${existingServers.length}`);
      existingServers.forEach(server => {
        console.log(`  - ${server.nickname} (${server.id})`);
      });
    }
    
    // Run the exact link command queries for both guilds
    console.log(`\n🔍 Link command queries:`);
    
    // Query for current guild (should find 0)
    const [currentGuildQuery] = await pool.query(`
      SELECT p.*, rs.nickname 
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
      AND LOWER(p.ign) = LOWER(?)`,
      [currentGuildId, playerIgn]
    );
    
    console.log(`Current Guild Query: ${currentGuildQuery.length} records found`);
    if (currentGuildQuery.length > 0) {
      console.log(`  ⚠️ UNEXPECTED! Found records in current guild:`);
      currentGuildQuery.forEach(record => {
        console.log(`    - ${record.ign} on ${record.nickname} (Active: ${record.is_active})`);
      });
    } else {
      console.log(`  ✅ Expected: No records in current guild`);
    }
    
    // Query for existing guild (should find 1)
    const [existingGuildQuery] = await pool.query(`
      SELECT p.*, rs.nickname 
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
      AND LOWER(p.ign) = LOWER(?)`,
      [existingGuildId, playerIgn]
    );
    
    console.log(`Existing Guild Query: ${existingGuildQuery.length} records found`);
    if (existingGuildQuery.length > 0) {
      console.log(`  ✅ Expected: Found records in existing guild:`);
      existingGuildQuery.forEach(record => {
        console.log(`    - ${record.ign} on ${record.nickname} (Active: ${record.is_active})`);
      });
    }
    
    // The mystery: Why is the error showing "SHADOWS 3X"?
    console.log(`\n🔍 Mystery Investigation:`);
    console.log(`The error message shows "SHADOWS 3X" but the current guild query found ${currentGuildQuery.length} records.`);
    
    if (currentGuildQuery.length === 0) {
      console.log(`❓ If the query found 0 records, the link should succeed.`);
      console.log(`❓ The error might be coming from a different part of the code.`);
      console.log(`❓ OR there might be a bug in the error handling logic.`);
    }
    
    // Check if the error might be coming from the confirmation handler
    console.log(`\n💡 SOLUTION:`);
    console.log(`This is working correctly as a multi-tenant system.`);
    console.log(`${playerIgn} should be able to link in the current guild (${currentGuildId}).`);
    console.log(`Their existing link in the other guild (${existingGuildId}) should not interfere.`);
    
    if (currentGuild[0] && currentGuild[0].id && currentServers && currentServers.length > 0) {
      console.log(`\n✅ The current guild has servers, so linking should work.`);
    } else if (currentGuild[0] && (!currentServers || currentServers.length === 0)) {
      console.log(`\n❌ PROBLEM FOUND: Current guild has no servers!`);
      console.log(`   Solution: Add a server to the current guild using /setup-server`);
    } else {
      console.log(`\n❌ PROBLEM FOUND: Current guild doesn't exist in database!`);
      console.log(`   Solution: Run /setup-server to create the guild and add a server`);
    }
    
  } catch (error) {
    console.error('❌ Error verifying multi-tenant issue:', error);
  } finally {
    await pool.end();
  }
}

verifyMultitenantIssue();
