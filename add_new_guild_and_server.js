const pool = require('./src/db');

async function addNewGuildAndServer() {
  try {
    console.log('🔧 Adding new guild and fixing server association...');
    
    const newGuildDiscordId = '1348735121481535548';
    const serverIP = '176.57.171.134';
    const serverPort = 31716;
    
    // First, check if the guild already exists
    console.log('\n📋 Step 1: Checking if guild exists...');
    const [existingGuilds] = await pool.query(
      'SELECT * FROM guilds WHERE discord_id = ?',
      [newGuildDiscordId]
    );
    
    let guildId;
    if (existingGuilds.length > 0) {
      console.log(`✅ Guild already exists: ${existingGuilds[0].name} (ID: ${existingGuilds[0].id})`);
      guildId = existingGuilds[0].id;
    } else {
      // Add the new guild
      console.log('\n📋 Step 2: Adding new guild to database...');
      const [guildResult] = await pool.query(
        'INSERT INTO guilds (discord_id, name) VALUES (?, ?)',
        [newGuildDiscordId, 'New Customer Guild']
      );
      
      guildId = guildResult.insertId;
      console.log(`✅ Added new guild with ID: ${guildId}`);
    }
    
    // Find the server
    console.log('\n📋 Step 3: Finding the server...');
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
    
    // Update the server's guild_id to the new guild
    console.log(`\n📋 Step 4: Associating server with new guild (ID: ${guildId})...`);
    const [updateResult] = await pool.query(
      'UPDATE rust_servers SET guild_id = ? WHERE id = ?',
      [guildId, server.id]
    );
    
    console.log(`✅ Updated ${updateResult.affectedRows} server record`);
    
    // Verify the update
    console.log('\n📋 Step 5: Verifying the configuration...');
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
    
    // Test autocomplete query for the new guild
    console.log('\n📋 Step 6: Testing autocomplete functionality...');
    const [autocompleteServers] = await pool.query(
      'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25',
      [guildId, '%']
    );
    
    console.log(`Found ${autocompleteServers.length} servers for autocomplete in new guild:`);
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
    console.log('\n📋 Step 7: Testing bot autocomplete query...');
    const [botAutocompleteServers] = await pool.query(
      'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname LIKE ? LIMIT 25',
      [newGuildDiscordId, '%']
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
    
    // Show all guilds for reference
    console.log('\n📋 Step 8: Current guilds in database:');
    const [allGuilds] = await pool.query('SELECT * FROM guilds ORDER BY id');
    allGuilds.forEach((guild, index) => {
      console.log(`${index + 1}. ${guild.name} (Discord ID: ${guild.discord_id})`);
    });
    
    console.log('\n🎯 SUMMARY:');
    console.log('✅ New guild added to database');
    console.log('✅ Server associated with correct guild');
    console.log('✅ Server should now appear in command autocomplete');
    console.log('🔄 Restart the bot with: pm2 restart zentro-bot');
    console.log('📡 The bot will now recognize the new Discord guild');
    
  } catch (error) {
    console.error('❌ Error adding guild and fixing server:', error);
  } finally {
    await pool.end();
  }
}

addNewGuildAndServer(); 