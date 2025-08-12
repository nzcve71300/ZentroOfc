const pool = require('./src/db');

async function fixServerNickname() {
  try {
    console.log('🔧 Fixing server nickname...');
    
    const serverIP = '176.57.171.134';
    const serverPort = 31716;
    const correctNickname = 'BLOODRUST';
    
    // Find the server
    console.log('\n📋 Step 1: Finding the server...');
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
    console.log(`Current nickname: ${server.nickname}`);
    console.log(`Target nickname: ${correctNickname}`);
    
    if (server.nickname === correctNickname) {
      console.log('✅ Server nickname is already correct!');
      return;
    }
    
    // Update the server nickname
    console.log(`\n📋 Step 2: Updating server nickname to "${correctNickname}"...`);
    const [updateResult] = await pool.query(
      'UPDATE rust_servers SET nickname = ? WHERE id = ?',
      [correctNickname, server.id]
    );
    
    console.log(`✅ Updated ${updateResult.affectedRows} server record`);
    
    // Verify the update
    console.log('\n📋 Step 3: Verifying the update...');
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
    
    // Test autocomplete query to make sure it still works
    console.log('\n📋 Step 4: Testing autocomplete functionality...');
    const [autocompleteServers] = await pool.query(
      'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25',
      [server.guild_id, '%']
    );
    
    console.log(`Found ${autocompleteServers.length} servers for autocomplete:`);
    autocompleteServers.forEach(server => {
      console.log(`   - ${server.nickname}`);
    });
    
    // Check if our server appears in autocomplete with the correct name
    const serverInAutocomplete = autocompleteServers.find(s => s.nickname === correctNickname);
    if (serverInAutocomplete) {
      console.log(`✅ Server "${correctNickname}" appears in autocomplete!`);
    } else {
      console.log(`❌ Server "${correctNickname}" NOT found in autocomplete`);
    }
    
    console.log('\n🎯 SUMMARY:');
    console.log('✅ Server nickname updated to BLOODRUST');
    console.log('✅ Server should now appear in command autocomplete with correct name');
    console.log('🔄 Restart the bot with: pm2 restart zentro-bot');
    
  } catch (error) {
    console.error('❌ Error fixing server nickname:', error);
  } finally {
    await pool.end();
  }
}

fixServerNickname(); 