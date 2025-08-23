const pool = require('./src/db');

async function debugProfileIssue() {
  try {
    console.log('🔍 Debugging Profile Issue...');
    
    const discordGuildId = '1342235198175182921';
    const discordId = '1252993829007528086';
    const serverIdFromButton = '1754071898933';
    
    console.log('\n📋 Parameters from button:');
    console.log(`   Discord Guild ID: ${discordGuildId}`);
    console.log(`   Discord ID: ${discordId}`);
    console.log(`   Server ID from button: ${serverIdFromButton}`);
    
    // Check if guild exists
    console.log('\n📋 Step 1: Checking guild...');
    const [guildResult] = await pool.query(
      'SELECT id, discord_id, name FROM guilds WHERE discord_id = ?',
      [discordGuildId]
    );
    
    if (guildResult.length === 0) {
      console.log('❌ Guild not found in database');
      return;
    }
    
    const guild = guildResult[0];
    console.log(`✅ Guild found: ${guild.name} (Internal ID: ${guild.id})`);
    
    // Check all servers for this guild
    console.log('\n📋 Step 2: Checking servers for this guild...');
    const [serversResult] = await pool.query(
      'SELECT id, nickname FROM rust_servers WHERE guild_id = ?',
      [guild.id]
    );
    
    console.log(`Found ${serversResult.length} servers:`);
    serversResult.forEach(server => {
      console.log(`   - ${server.nickname} (ID: ${server.id})`);
    });
    
    // Check if the server ID from button matches any server
    const matchingServer = serversResult.find(s => s.id === serverIdFromButton);
    if (matchingServer) {
      console.log(`✅ Server ID from button matches: ${matchingServer.nickname}`);
    } else {
      console.log(`❌ Server ID from button (${serverIdFromButton}) doesn't match any server`);
    }
    
    // Check all players for this Discord ID
    console.log('\n📋 Step 3: Checking all players for this Discord ID...');
    const [playersResult] = await pool.query(
      `SELECT p.*, rs.nickname as server_name
       FROM players p
       JOIN rust_servers rs ON p.server_id = rs.id
       WHERE p.guild_id = ? AND p.discord_id = ? AND p.is_active = true`,
      [guild.id, discordId]
    );
    
    console.log(`Found ${playersResult.length} players for Discord ID ${discordId}:`);
    playersResult.forEach(player => {
      console.log(`   - ${player.ign} on ${player.server_name} (Server ID: ${player.server_id})`);
    });
    
    // Try the exact query from handleRustInfo
    console.log('\n📋 Step 4: Testing exact query from handleRustInfo...');
    const [exactQueryResult] = await pool.query(
      `SELECT p.*
       FROM players p
       WHERE p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)
       AND p.discord_id = ?
       AND p.server_id = ?
       AND p.is_active = true`,
      [discordGuildId, discordId, serverIdFromButton]
    );
    
    console.log(`Exact query result: ${exactQueryResult.length} players found`);
    
    if (exactQueryResult.length === 0) {
      console.log('\n🔍 Debugging why query failed...');
      
      // Check each condition separately
      const [guildCheck] = await pool.query(
        'SELECT id FROM guilds WHERE discord_id = ?',
        [discordGuildId]
      );
      console.log(`   Guild check: ${guildCheck.length} found`);
      
      if (guildCheck.length > 0) {
        const [playerCheck] = await pool.query(
          'SELECT * FROM players WHERE guild_id = ? AND discord_id = ? AND is_active = true',
          [guildCheck[0].id, discordId]
        );
        console.log(`   Player check: ${playerCheck.length} found`);
        
        if (playerCheck.length > 0) {
          const [serverCheck] = await pool.query(
            'SELECT * FROM players WHERE guild_id = ? AND discord_id = ? AND server_id = ? AND is_active = true',
            [guildCheck[0].id, discordId, serverIdFromButton]
          );
          console.log(`   Server check: ${serverCheck.length} found`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

debugProfileIssue();
