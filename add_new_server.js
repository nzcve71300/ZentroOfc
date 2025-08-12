const pool = require('./src/db');

async function addNewServer() {
  try {
    console.log('🔧 Adding new server...');
    
    const serverDetails = {
      nickname: 'New Server', // You can change this name
      ip: '176.57.171.134',
      port: 31716,
      password: 'lKGGy6xx'
    };
    
    // First, let's check what guilds exist
    console.log('\n📋 Step 1: Checking existing guilds...');
    const [guilds] = await pool.query('SELECT * FROM guilds ORDER BY id');
    console.log(`Found ${guilds.length} guilds:`);
    guilds.forEach((guild, index) => {
      console.log(`${index + 1}. ${guild.name} (Discord ID: ${guild.discord_id})`);
    });
    
    if (guilds.length === 0) {
      console.log('❌ No guilds found! Need to add a guild first.');
      return;
    }
    
    // Use the first guild (or you can specify which one)
    const guildId = guilds[0].id;
    console.log(`\n📋 Step 2: Using guild: ${guilds[0].name} (ID: ${guildId})`);
    
    // Check if server already exists
    console.log('\n📋 Step 3: Checking if server already exists...');
    const [existingServer] = await pool.query(
      'SELECT * FROM rust_servers WHERE ip = ? AND port = ?',
      [serverDetails.ip, serverDetails.port]
    );
    
    if (existingServer.length > 0) {
      console.log(`⚠️ Server already exists: ${existingServer[0].nickname}`);
      console.log('Updating server details...');
      
      const [updateResult] = await pool.query(
        'UPDATE rust_servers SET nickname = ?, password = ? WHERE ip = ? AND port = ?',
        [serverDetails.nickname, serverDetails.password, serverDetails.ip, serverDetails.port]
      );
      console.log(`✅ Updated ${updateResult.affectedRows} server record`);
    } else {
      // Generate a unique server ID
      const serverId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add the new server
      console.log('\n📋 Step 4: Adding new server...');
      const [insertResult] = await pool.query(
        'INSERT INTO rust_servers (id, guild_id, nickname, ip, port, password, rcon_password) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [serverId, guildId, serverDetails.nickname, serverDetails.ip, serverDetails.port, serverDetails.password, serverDetails.password]
      );
      console.log(`✅ Added new server with ID: ${serverId}`);
    }
    
    // Verify the server was added/updated
    console.log('\n📋 Step 5: Verifying server configuration...');
    const [verifyServer] = await pool.query(
      'SELECT rs.*, g.name as guild_name, g.discord_id as guild_discord_id FROM rust_servers rs LEFT JOIN guilds g ON rs.guild_id = g.id WHERE rs.ip = ? AND rs.port = ?',
      [serverDetails.ip, serverDetails.port]
    );
    
    if (verifyServer.length > 0) {
      const server = verifyServer[0];
      console.log('✅ Server configuration verified:');
      console.log(`   ID: ${server.id}`);
      console.log(`   Nickname: ${server.nickname}`);
      console.log(`   IP: ${server.ip}:${server.port}`);
      console.log(`   Password: ${server.password}`);
      console.log(`   Guild: ${server.guild_name} (${server.guild_discord_id})`);
      console.log(`   Created: ${server.created_at}`);
    }
    
    // Test autocomplete query
    console.log('\n📋 Step 6: Testing autocomplete functionality...');
    const [autocompleteServers] = await pool.query(
      'SELECT nickname FROM rust_servers WHERE guild_id = ? AND nickname LIKE ? LIMIT 25',
      [guildId, '%']
    );
    
    console.log(`Found ${autocompleteServers.length} servers for autocomplete:`);
    autocompleteServers.forEach(server => {
      console.log(`   - ${server.nickname}`);
    });
    
    // Check if our new server appears in autocomplete
    const newServerInAutocomplete = autocompleteServers.find(s => s.nickname === serverDetails.nickname);
    if (newServerInAutocomplete) {
      console.log(`✅ New server "${serverDetails.nickname}" appears in autocomplete!`);
    } else {
      console.log(`❌ New server "${serverDetails.nickname}" NOT found in autocomplete`);
    }
    
    console.log('\n🎯 SUMMARY:');
    console.log('✅ Server added/updated successfully');
    console.log('✅ Server should appear in command autocomplete');
    console.log('🔄 Restart the bot with: pm2 restart zentro-bot');
    console.log('📡 The bot will attempt to connect to the server on restart');
    
  } catch (error) {
    console.error('❌ Error adding server:', error);
  } finally {
    await pool.end();
  }
}

addNewServer(); 