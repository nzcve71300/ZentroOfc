const pool = require('./src/db');

async function addEmp2Server() {
  try {
    console.log('🔧 Adding EMP2 server...');
    
    // Server details
    const serverDetails = {
      ip: '81.0.247.39',
      port: 29816,
      password: 'UNeyTVw',
      nickname: 'EMP2',
      guildDiscordId: '1379533411009560626'
    };
    
    console.log(`📋 Server details:`);
    console.log(`   IP: ${serverDetails.ip}:${serverDetails.port}`);
    console.log(`   Password: ${serverDetails.password}`);
    console.log(`   Nickname: ${serverDetails.nickname}`);
    console.log(`   Guild Discord ID: ${serverDetails.guildDiscordId}`);
    
    // Step 1: Find the guild
    console.log('\n📋 Step 1: Finding guild...');
    const [guilds] = await pool.query(
      'SELECT * FROM guilds WHERE discord_id = ?',
      [serverDetails.guildDiscordId]
    );
    
    if (guilds.length === 0) {
      console.log('❌ Guild not found! Creating new guild...');
      const [newGuild] = await pool.query(
        'INSERT INTO guilds (discord_id, name) VALUES (?, ?)',
        [serverDetails.guildDiscordId, 'EMP2 Guild']
      );
      console.log(`✅ Created new guild with ID: ${newGuild.insertId}`);
      var guildId = newGuild.insertId;
    } else {
      const guild = guilds[0];
      console.log(`✅ Found guild: ${guild.name} (ID: ${guild.id})`);
      var guildId = guild.id;
    }
    
    // Step 2: Check if server already exists
    console.log('\n📋 Step 2: Checking if server already exists...');
    const [existingServers] = await pool.query(
      'SELECT * FROM rust_servers WHERE ip = ? AND port = ?',
      [serverDetails.ip, serverDetails.port]
    );
    
    let serverId;
    if (existingServers.length > 0) {
      // Update existing server
      const server = existingServers[0];
      console.log(`⚠️ Server already exists: ${server.nickname}`);
      console.log('   Updating server details...');
      
      const [updateResult] = await pool.query(
        'UPDATE rust_servers SET nickname = ?, password = ?, guild_id = ? WHERE id = ?',
        [serverDetails.nickname, serverDetails.password, guildId, server.id]
      );
      
      serverId = server.id;
      console.log(`✅ Updated server: ${serverDetails.nickname}`);
    } else {
      // Create new server
      console.log('   Creating new server...');
      const serverIdValue = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const [insertResult] = await pool.query(
        'INSERT INTO rust_servers (id, nickname, ip, port, password, guild_id) VALUES (?, ?, ?, ?, ?, ?)',
        [serverIdValue, serverDetails.nickname, serverDetails.ip, serverDetails.port, serverDetails.password, guildId]
      );
      
      serverId = serverIdValue;
      console.log(`✅ Created new server: ${serverDetails.nickname}`);
    }
    
    // Step 3: Verify server configuration
    console.log('\n📋 Step 3: Verifying server configuration...');
    const [serverConfig] = await pool.query(
      'SELECT rs.*, g.discord_id as guild_discord_id, g.name as guild_name FROM rust_servers rs LEFT JOIN guilds g ON rs.guild_id = g.id WHERE rs.id = ?',
      [serverId]
    );
    
    if (serverConfig.length > 0) {
      const server = serverConfig[0];
      console.log(`✅ Server configuration verified:`);
      console.log(`   ID: ${server.id}`);
      console.log(`   Nickname: ${server.nickname}`);
      console.log(`   IP: ${server.ip}:${server.port}`);
      console.log(`   Password: ${server.password}`);
      console.log(`   Guild: ${server.guild_name} (${server.guild_discord_id})`);
    } else {
      console.log('❌ Server configuration verification failed');
      return;
    }
    
    // Step 4: Test autocomplete functionality
    console.log('\n📋 Step 4: Testing autocomplete functionality...');
    const [autocompleteServers] = await pool.query(`
      SELECT rs.nickname, rs.id
      FROM rust_servers rs
      JOIN guilds g ON rs.guild_id = g.id
      WHERE g.discord_id = ?
      ORDER BY rs.nickname
    `, [serverDetails.guildDiscordId]);
    
    console.log(`Found ${autocompleteServers.length} servers for autocomplete:`);
    autocompleteServers.forEach((server, index) => {
      console.log(`   ${index + 1}. ${server.nickname} (${server.id})`);
    });
    
    // Check if our server is in the list
    const foundServer = autocompleteServers.find(s => s.nickname === serverDetails.nickname);
    if (foundServer) {
      console.log(`✅ Server "${serverDetails.nickname}" found in autocomplete`);
    } else {
      console.log(`❌ Server "${serverDetails.nickname}" NOT found in autocomplete`);
    }
    
    console.log('\n🎯 SUMMARY:');
    console.log('✅ Server added/updated successfully');
    console.log('✅ Server should appear in command autocomplete');
    console.log('🔄 Restart the bot with: pm2 restart zentro-bot');
    console.log('📡 The bot will attempt to connect to the server on restart');
    
  } catch (error) {
    console.error('❌ Error adding EMP2 server:', error);
  } finally {
    await pool.end();
  }
}

addEmp2Server(); 