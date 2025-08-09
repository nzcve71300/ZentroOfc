const pool = require('./src/db');

async function fixGuildIds() {
  try {
    console.log('🔧 SSH: Fixing Guild ID Mismatch...');

    // Server to Guild ID mappings
    const serverGuildMappings = {
      'Emperor 3x': '1342235198175182921',
      'Rise 3x': '1391149977434329230', 
      'Snowy Billiards 2x': '1379533411009560626',
      'Shadows 3x': '1391209638308872254'
    };

    console.log('\n📋 Guild ID Updates to Apply:');
    Object.entries(serverGuildMappings).forEach(([server, guildId]) => {
      console.log(`   ${server} -> ${guildId}`);
    });

    // First, check current state
    console.log('\n🔍 Current Database State:');
    const [currentServers] = await pool.query('SELECT id, nickname, guild_id FROM rust_servers');
    const [currentGuilds] = await pool.query('SELECT id, discord_id, name FROM guilds');
    
    console.log('\nCurrent Servers:');
    currentServers.forEach(server => {
      console.log(`   ${server.nickname}: guild_id=${server.guild_id}`);
    });
    
    console.log('\nCurrent Guilds:');
    currentGuilds.forEach(guild => {
      console.log(`   ID=${guild.id}, Discord ID=${guild.discord_id}, Name=${guild.name}`);
    });

    // Step 1: Ensure all required guilds exist
    console.log('\n🏗️ Step 1: Ensuring guilds exist...');
    for (const [serverName, discordId] of Object.entries(serverGuildMappings)) {
      try {
        await pool.query(
          'INSERT INTO guilds (discord_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
          [discordId, `Guild for ${serverName}`]
        );
        console.log(`✅ Guild ensured for ${serverName} (${discordId})`);
      } catch (error) {
        console.error(`❌ Error ensuring guild for ${serverName}:`, error.message);
      }
    }

    // Step 2: Update rust_servers table with correct guild_id references
    console.log('\n🔄 Step 2: Updating server guild references...');
    for (const [serverName, discordId] of Object.entries(serverGuildMappings)) {
      try {
        // Get the internal guild ID for this discord ID
        const [guildResult] = await pool.query(
          'SELECT id FROM guilds WHERE discord_id = ?',
          [discordId]
        );
        
        if (guildResult.length === 0) {
          console.error(`❌ Guild not found for Discord ID ${discordId}`);
          continue;
        }
        
        const guildId = guildResult[0].id;
        
        // Update the server's guild_id
        const [updateResult] = await pool.query(
          'UPDATE rust_servers SET guild_id = ? WHERE nickname = ?',
          [guildId, serverName]
        );
        
        if (updateResult.affectedRows > 0) {
          console.log(`✅ Updated ${serverName} -> guild_id=${guildId} (Discord: ${discordId})`);
        } else {
          console.log(`⚠️  Server ${serverName} not found in database`);
        }
      } catch (error) {
        console.error(`❌ Error updating ${serverName}:`, error.message);
      }
    }

    // Step 3: Verify the changes
    console.log('\n✅ Step 3: Verifying changes...');
    const [updatedServers] = await pool.query(`
      SELECT rs.id, rs.nickname, rs.guild_id, g.discord_id 
      FROM rust_servers rs 
      LEFT JOIN guilds g ON rs.guild_id = g.id
    `);
    
    console.log('\nUpdated Server Configuration:');
    updatedServers.forEach(server => {
      const expectedDiscordId = serverGuildMappings[server.nickname];
      const match = server.discord_id === expectedDiscordId;
      console.log(`   ${server.nickname}:`);
      console.log(`     Guild ID: ${server.guild_id}`);
      console.log(`     Discord ID: ${server.discord_id}`);
      console.log(`     Expected: ${expectedDiscordId}`);
      console.log(`     Status: ${match ? '✅ CORRECT' : '❌ MISMATCH'}`);
    });

    // Step 4: Update any existing player records to use correct guild_id
    console.log('\n🔄 Step 4: Updating player records...');
    for (const [serverName, discordId] of Object.entries(serverGuildMappings)) {
      try {
        const [guildResult] = await pool.query(
          'SELECT id FROM guilds WHERE discord_id = ?',
          [discordId]
        );
        
        if (guildResult.length === 0) continue;
        
        const correctGuildId = guildResult[0].id;
        
        const [serverResult] = await pool.query(
          'SELECT id FROM rust_servers WHERE nickname = ?',
          [serverName]
        );
        
        if (serverResult.length === 0) continue;
        
        const serverId = serverResult[0].id;
        
        // Update players table
        const [playerUpdateResult] = await pool.query(
          'UPDATE players SET guild_id = ? WHERE server_id = ?',
          [correctGuildId, serverId]
        );
        
        if (playerUpdateResult.affectedRows > 0) {
          console.log(`✅ Updated ${playerUpdateResult.affectedRows} player records for ${serverName}`);
        }
        
      } catch (error) {
        console.error(`❌ Error updating player records for ${serverName}:`, error.message);
      }
    }

    console.log('\n🎉 Guild ID fix completed!');
    console.log('💡 Try running the /link command again - it should now find your servers.');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixGuildIds().catch(console.error);