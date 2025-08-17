const pool = require('./src/db');

async function fixAutocompleteServer() {
  try {
    console.log('🔧 Fixing autocomplete server issue...');
    
    const guildDiscordId = '1406308741628039228';
    const serverIp = '176.57.160.193';
    const rconPort = 28016;
    const rconPassword = 'YBmsQvwS';
    const serverNickname = 'Main Server'; // You can change this to whatever you want
    
    console.log(`\n📋 Server details:`);
    console.log(`   IP: ${serverIp}`);
    console.log(`   Port: ${rconPort}`);
    console.log(`   RCON Password: ${rconPassword}`);
    console.log(`   Guild Discord ID: ${guildDiscordId}`);
    console.log(`   Nickname: ${serverNickname}`);
    
    // 1. Ensure guild exists
    console.log('\n🔧 Step 1: Ensuring guild exists...');
    await pool.query(
      'INSERT INTO guilds (discord_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
      [guildDiscordId, 'Auto-fixed Guild']
    );
    
    const [guildRecord] = await pool.query(
      'SELECT * FROM guilds WHERE discord_id = ?',
      [guildDiscordId]
    );
    
    const guildId = guildRecord[0].id;
    console.log(`✅ Guild ID: ${guildId}`);
    
    // 2. Check if server already exists
    console.log('\n🔧 Step 2: Checking for existing server...');
    const [existingServers] = await pool.query(
      'SELECT * FROM rust_servers WHERE guild_id = ? AND ip = ? AND port = ?',
      [guildId, serverIp, rconPort]
    );
    
    if (existingServers.length > 0) {
      console.log('✅ Server already exists:', existingServers[0]);
      
      // Update the server if it has a placeholder nickname
      const existingServer = existingServers[0];
      if (existingServer.nickname.toLowerCase().includes('unknown') || 
          existingServer.nickname.toLowerCase().includes('placeholder') ||
          existingServer.nickname === 'Server') {
        
        console.log('🔧 Updating server nickname from placeholder...');
        await pool.query(
          'UPDATE rust_servers SET nickname = ?, rcon_password = ? WHERE id = ?',
          [serverNickname, rconPassword, existingServer.id]
        );
        console.log(`✅ Updated server nickname to: ${serverNickname}`);
      }
    } else {
      console.log('❌ Server not found, creating new server...');
      
      // Generate a unique server ID
      const serverId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add the server
      await pool.query(
        'INSERT INTO rust_servers (id, guild_id, nickname, ip, port, password, rcon_password) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [serverId, guildId, serverNickname, serverIp, rconPort, rconPassword, rconPassword]
      );
      
      console.log(`✅ Created new server with ID: ${serverId}`);
    }
    
    // 3. Verify autocomplete query works
    console.log('\n🔧 Step 3: Testing autocomplete query...');
    const [autocompleteTest] = await pool.query(
      'SELECT nickname FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) LIMIT 25',
      [guildDiscordId]
    );
    
    console.log('📝 Autocomplete results:');
    if (autocompleteTest.length === 0) {
      console.log('❌ Still no results from autocomplete query!');
    } else {
      autocompleteTest.forEach((server, index) => {
        console.log(`   ${index + 1}. ${server.nickname}`);
      });
      console.log('✅ Autocomplete should now work!');
    }
    
    // 4. Clean up any duplicate or placeholder servers
    console.log('\n🔧 Step 4: Cleaning up placeholder servers...');
    const [placeholderServers] = await pool.query(
      'SELECT * FROM rust_servers WHERE guild_id = ? AND (nickname LIKE "%placeholder%" OR nickname LIKE "%unknown%" OR nickname = "Server")',
      [guildId]
    );
    
    if (placeholderServers.length > 0) {
      console.log(`🧹 Found ${placeholderServers.length} placeholder servers to clean up:`);
      
      for (const server of placeholderServers) {
        // Only delete if it's not the server we just fixed/created
        if (server.ip !== serverIp || server.port !== rconPort) {
          console.log(`   Deleting: ${server.nickname} (${server.ip}:${server.port})`);
          await pool.query('DELETE FROM rust_servers WHERE id = ?', [server.id]);
        } else {
          console.log(`   Keeping: ${server.nickname} (${server.ip}:${server.port}) - this is your real server`);
        }
      }
    } else {
      console.log('✅ No placeholder servers found.');
    }
    
    // 5. Final verification
    console.log('\n🔧 Step 5: Final verification...');
    const [finalServers] = await pool.query(
      'SELECT * FROM rust_servers WHERE guild_id = ?',
      [guildId]
    );
    
    console.log('\n📊 Final server list for your guild:');
    finalServers.forEach((server, index) => {
      console.log(`   ${index + 1}. ${server.nickname} (${server.ip}:${server.port}) - ID: ${server.id}`);
    });
    
    console.log('\n🎯 FIX COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Your server should now appear in autocomplete!');
    console.log('\n💡 Next steps:');
    console.log('   1. Restart your Discord bot (pm2 restart zentro-bot or similar)');
    console.log('   2. Wait 1-2 minutes for Discord to update slash commands');
    console.log('   3. Try using any command with server autocomplete');
    console.log(`   4. Type "${serverNickname.substring(0, 3)}" to see if it appears`);
    console.log('\n🔍 If it still doesn\'t work:');
    console.log('   - Check that the bot has proper database permissions');
    console.log('   - Verify the bot is connected to the correct database');
    console.log('   - Try running /setup-server again in Discord as a backup');
    
  } catch (error) {
    console.error('❌ Error during fix:', error);
  } finally {
    await pool.end();
  }
}

fixAutocompleteServer();

