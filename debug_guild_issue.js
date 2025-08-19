const pool = require('./src/db');

async function debugGuildIssue() {
  try {
    console.log('🔍 Debugging guild issue...');
    
    const playerIgn = 'XsLdSsG';
    const guildId = '1391149977434329230'; // Your guild ID
    
    // Check guild exists
    console.log(`\n🔍 Checking if guild ${guildId} exists:`);
    const [guildCheck] = await pool.query(
      'SELECT * FROM guilds WHERE discord_id = ?',
      [guildId]
    );
    
    if (guildCheck.length > 0) {
      console.log(`✅ Guild found: ID ${guildCheck[0].id}, Name: ${guildCheck[0].name}`);
    } else {
      console.log(`❌ Guild ${guildId} NOT FOUND in database!`);
      return;
    }
    
    // Check servers in this guild
    console.log(`\n🔍 Checking servers in guild ${guildId}:`);
    const [servers] = await pool.query(
      'SELECT * FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?)',
      [guildId]
    );
    
    console.log(`📋 Found ${servers.length} servers:`);
    for (const server of servers) {
      console.log(`   Server: ${server.nickname} (ID: ${server.id})`);
    }
    
    // Now run the EXACT same query as the link command
    console.log(`\n🔍 Running EXACT link command query for IGN ${playerIgn}:`);
    const [anyIgnLinks] = await pool.query(`
      SELECT p.*, rs.nickname 
      FROM players p
      JOIN rust_servers rs ON p.server_id = rs.id
      WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
      AND LOWER(p.ign) = LOWER(?)`,
      [guildId, playerIgn]
    );
    
    console.log(`📋 Link command query result: ${anyIgnLinks.length} records`);
    
    for (const record of anyIgnLinks) {
      console.log(`\n📝 Found record:`);
      console.log(`   Record ID: ${record.id}`);
      console.log(`   Server: ${record.nickname}`);
      console.log(`   Discord ID: ${record.discord_id || 'NULL'}`);
      console.log(`   Active: ${record.is_active}`);
      console.log(`   Guild ID: ${record.guild_id}`);
    }
    
    // Check if the error might be coming from a different guild's server with the same name
    console.log(`\n🔍 Checking for servers named "SHADOWS 3X" in other guilds:`);
    const [shadowServers] = await pool.query(
      'SELECT rs.*, g.discord_id as guild_discord_id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE rs.nickname LIKE "%SHADOWS%"'
    );
    
    console.log(`📋 Found ${shadowServers.length} "SHADOWS" servers:`);
    for (const server of shadowServers) {
      console.log(`   Server: ${server.nickname} (Guild: ${server.guild_discord_id}, Server ID: ${server.id})`);
    }
    
    // Check if XsLdSsG exists on any of these servers
    for (const server of shadowServers) {
      const [playerCheck] = await pool.query(
        'SELECT * FROM players WHERE server_id = ? AND LOWER(ign) = LOWER(?)',
        [server.id, playerIgn]
      );
      
      if (playerCheck.length > 0) {
        console.log(`\n⚠️ Found ${playerIgn} on ${server.nickname} (Guild: ${server.guild_discord_id}):`);
        for (const player of playerCheck) {
          console.log(`   Discord ID: ${player.discord_id}, Active: ${player.is_active}`);
        }
      }
    }
    
    console.log('\n🎯 DIAGNOSIS COMPLETE!');
    
  } catch (error) {
    console.error('❌ Error debugging guild issue:', error);
  } finally {
    await pool.end();
  }
}

debugGuildIssue();
