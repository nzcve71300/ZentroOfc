const pool = require('./src/db');

async function fixServerGuildId() {
  try {
    console.log('🔧 Fixing server guild ID association...');
    
    const serverIP = '176.57.171.134';
    const serverPort = 31716;
    const correctGuildDiscordId = '1348735121481535548';
    
    // First, find the correct guild
    console.log('\n📋 Step 1: Finding the correct guild...');
    const [guilds] = await pool.query(
      'SELECT * FROM guilds WHERE discord_id = ?',
      [correctGuildDiscordId]
    );
    
    if (guilds.length === 0) {
      console.log(`❌ Guild with Discord ID ${correctGuildDiscordId} not found!`);
      console.log('Available guilds:');
      const [allGuilds] = await pool.query('SELECT * FROM guilds ORDER BY id');
      allGuilds.forEach((guild, index) => {
        console.log(`${index + 1}. ${guild.name} (Discord ID: ${guild.discord_id})`);
      });
      return;
    }
    
    const targetGuild = guilds[0];
    console.log(`✅ Found guild: ${targetGuild.name} (ID: ${targetGuild.id})`);
    
    // Find the server
    console.log('\n📋 Step 2: Finding the server...');
    const [servers] = await pool.query(
      'SELECT * FROM rust_servers WHERE ip = ? AND port = ?',
      [serverIP, serverPort]
    );
    
    if (servers.length === 0) {
      console.log('❌ Server not found!');
      return;
    }
    
    const server = servers[0];
    console.log(`Found server: ${server.nickname} (ID: ${server.id})`);
    console.log(`Current Guild ID: ${server.guild_id}`);
    
    // Update the server's guild_id to the correct guild
    console.log(`\n📋 Step 3: Updating server to guild: ${targetGuild.name} (ID: ${targetGuild.id})`);
    const [updateResult] = await pool.query(
      'UPDATE rust_servers SET guild_id = ? WHERE id = ?',
      [targetGuild.id, server.id]
    );
    
    console.log(`✅ Updated ${updateResult.affectedRows} server record`);
    
    // Verify the update
    console.log('\n📋 Step 4: Verifying the update...');
    const [verifyServer] = await pool.query(
      'SELECT rs.*, g.name as guild_name, g.discord_id as guild_discord_id FROM rust_servers rs LEFT JOIN guilds g ON rs.guild_id = g.id WHERE rs.id = ?',
      [server.id]
    );
    
    if (verifyServer.length > 0) {
      const updatedServer = verifyServer[0];
      console.log('✅ Server configuration verified:');
      console.log(`   ID: ${updatedServer.id}`);
      console.log(`   Nickname: ${updatedServer.nickname}`);
      console.log(`   IP: ${updatedServer.ip}:${updatedServer.port}`);
      console.log(`   Guild: ${updatedServer.guild_name} (${updatedServer.guild_discord_id})`);
    }
    
    // Test autocomplete query for the correct guild
    console.log('\n📋 Step 5: Testing autocomplete functionality...');
    const [autocompleteServers] = await pool.query(
      'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25',
      [targetGuild.id, '%']
    );
    
    console.log(`Found ${autocompleteServers.length} servers for autocomplete in guild ${targetGuild.name}:`);
    autocompleteServers.forEach(server => {
      console.log(`   - ${server.nickname}`);
    });
    
    // Check if our server appears in autocomplete
    const serverInAutocomplete = autocompleteServers.find(s => s.nickname === server.nickname);
    if (serverInAutocomplete) {
      console.log(`✅ Server "${server.nickname}" appears in autocomplete!`);
    } else {
      console.log(`❌ Server "${server.nickname}" NOT found in autocomplete`);
    }
    
    // Also test the autocomplete query that the bot actually uses
    console.log('\n📋 Step 6: Testing bot autocomplete query...');
    const [botAutocompleteServers] = await pool.query(
      'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
      [correctGuildDiscordId, '%']
    );
    
    console.log(`Found ${botAutocompleteServers.length} servers for bot autocomplete:`);
    botAutocompleteServers.forEach(server => {
      console.log(`   - ${server.nickname}`);
    });
    
    const serverInBotAutocomplete = botAutocompleteServers.find(s => s.nickname === server.nickname);
    if (serverInBotAutocomplete) {
      console.log(`✅ Server "${server.nickname}" appears in bot autocomplete!`);
    } else {
      console.log(`❌ Server "${server.nickname}" NOT found in bot autocomplete`);
    }
    
    console.log('\n🎯 SUMMARY:');
    console.log('✅ Server guild association fixed');
    console.log('✅ Server should now appear in command autocomplete');
    console.log('🔄 Restart the bot with: pm2 restart zentro-bot');
    
  } catch (error) {
    console.error('❌ Error fixing server guild:', error);
  } finally {
    await pool.end();
  }
}

fixServerGuildId(); 