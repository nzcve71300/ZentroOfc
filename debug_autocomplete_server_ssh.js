const pool = require('./src/db');

async function debugAutocompleteServer() {
  try {
    console.log('🔍 Debugging autocomplete server issue...');
    
    const guildDiscordId = '1406308741628039228';
    const serverIp = '176.57.160.193';
    const rconPort = 28016;
    
    console.log(`\n📋 Looking for guild: ${guildDiscordId}`);
    console.log(`📋 Looking for server: ${serverIp}:${rconPort}`);
    
    // 1. Check if guild exists
    const [guilds] = await pool.query(
      'SELECT * FROM guilds WHERE discord_id = ?',
      [guildDiscordId]
    );
    
    if (guilds.length === 0) {
      console.log('❌ Guild not found in database!');
      console.log('🔧 Creating guild record...');
      
      await pool.query(
        'INSERT INTO guilds (discord_id, name) VALUES (?, ?)',
        [guildDiscordId, 'Auto-created Guild']
      );
      
      const [newGuilds] = await pool.query(
        'SELECT * FROM guilds WHERE discord_id = ?',
        [guildDiscordId]
      );
      
      console.log('✅ Guild created:', newGuilds[0]);
    } else {
      console.log('✅ Guild found:', guilds[0]);
    }
    
    // Get the guild record (either existing or newly created)
    const [guildRecord] = await pool.query(
      'SELECT * FROM guilds WHERE discord_id = ?',
      [guildDiscordId]
    );
    
    const guildId = guildRecord[0].id;
    console.log(`\n🔑 Guild database ID: ${guildId}`);
    
    // 2. Check if server exists
    const [servers] = await pool.query(
      'SELECT * FROM rust_servers WHERE guild_id = ? AND ip = ? AND port = ?',
      [guildId, serverIp, rconPort]
    );
    
    console.log(`\n🖥️  Servers found with IP ${serverIp}:${rconPort}:`, servers.length);
    
    if (servers.length === 0) {
      console.log('❌ Server not found in database!');
      console.log('🔧 This explains why autocomplete is not working.');
      console.log('\n💡 The server was not properly added to the database.');
      console.log('   You need to run /setup-server again with the correct details.');
    } else {
      console.log('✅ Server found:', servers[0]);
      
      // 3. Test the autocomplete query
      console.log('\n🧪 Testing autocomplete query...');
      
      const [autocompleteResult] = await pool.query(
        'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) LIMIT 25',
        [guildDiscordId]
      );
      
      console.log('📝 Autocomplete results:', autocompleteResult);
      
      if (autocompleteResult.length === 0) {
        console.log('❌ No servers returned by autocomplete query!');
        console.log('🔧 This indicates a problem with the guild_id mapping.');
      } else {
        console.log('✅ Autocomplete should be working with these servers:');
        autocompleteResult.forEach((server, index) => {
          console.log(`   ${index + 1}. ${server.nickname}`);
        });
      }
    }
    
    // 4. Show all servers for this guild
    console.log('\n📊 All servers for this guild:');
    const [allServers] = await pool.query(
      'SELECT * FROM rust_servers WHERE guild_id = ?',
      [guildId]
    );
    
    if (allServers.length === 0) {
      console.log('   No servers found for this guild.');
    } else {
      allServers.forEach((server, index) => {
        console.log(`   ${index + 1}. ${server.nickname} (${server.ip}:${server.port}) - ID: ${server.id}`);
      });
    }
    
    // 5. Check for any servers with similar IP
    console.log('\n🔍 Checking for servers with similar IP...');
    const [similarServers] = await pool.query(
      'SELECT rs.*, g.discord_id FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE rs.ip = ?',
      [serverIp]
    );
    
    if (similarServers.length > 0) {
      console.log('📋 Found servers with same IP:');
      similarServers.forEach((server, index) => {
        console.log(`   ${index + 1}. ${server.nickname} - Guild: ${server.discord_id} (${server.ip}:${server.port})`);
      });
    } else {
      console.log('   No servers found with this IP.');
    }
    
    console.log('\n🎯 DIAGNOSIS COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (servers.length === 0) {
      console.log('❌ ISSUE FOUND: Server was not properly added to database');
      console.log('💡 SOLUTION: Run /setup-server command again in Discord with:');
      console.log(`   • Server IP: ${serverIp}`);
      console.log(`   • RCON Port: ${rconPort}`);
      console.log('   • RCON Password: YBmsQvwS');
      console.log('   • Give it a proper nickname (not "Unknown" or "Placeholder")');
    } else if (autocompleteResult.length === 0) {
      console.log('❌ ISSUE FOUND: Guild mapping problem');
      console.log('💡 SOLUTION: There\'s a mismatch between Discord guild ID and database guild ID');
    } else {
      console.log('✅ NO ISSUES FOUND: Server should appear in autocomplete');
      console.log('💡 If it\'s still not working, try:');
      console.log('   1. Restart the Discord bot');
      console.log('   2. Wait a few minutes for Discord to update slash commands');
      console.log('   3. Try typing part of the server nickname in autocomplete');
    }
    
  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  } finally {
    await pool.end();
  }
}

debugAutocompleteServer();

