const pool = require('./src/db');

async function addUpriseServer() {
  try {
    console.log('🚀 Adding UPRISE 3X server...');

    // Server details
    const serverData = {
      ip: '149.102.132.219',
      port: 30216,
      password: 'JPMGiS0u',
      nickname: 'UPRISE 3X',
      guildId: '1302510805853536298'
    };

    console.log('📋 Server details:');
    console.log(`- Name: ${serverData.nickname}`);
    console.log(`- IP: ${serverData.ip}:${serverData.port}`);
    console.log(`- Guild ID: ${serverData.guildId}`);

    // 1. Check if guild exists
    console.log('\n1. Checking guild...');
    const [guildResult] = await pool.query(
      'SELECT * FROM guilds WHERE discord_id = ?',
      [serverData.guildId]
    );

    let guildDbId;
    if (guildResult.length === 0) {
      console.log('⚠️  Guild not found, creating new guild entry...');
      const [insertResult] = await pool.query(
        'INSERT INTO guilds (discord_id, name) VALUES (?, ?)',
        [serverData.guildId, 'UPRISE Guild']
      );
      guildDbId = insertResult.insertId;
      console.log('✅ Guild created with ID:', guildDbId);
    } else {
      guildDbId = guildResult[0].id;
      console.log('✅ Guild found with ID:', guildDbId);
    }

    // 2. Check if server already exists
    console.log('\n2. Checking for existing server...');
    const [existingServer] = await pool.query(
      'SELECT * FROM rust_servers WHERE ip = ? AND port = ? AND guild_id = ?',
      [serverData.ip, serverData.port, guildDbId]
    );

    if (existingServer.length > 0) {
      console.log('⚠️  Server already exists! Updating details...');
      await pool.query(
        'UPDATE rust_servers SET nickname = ?, password = ? WHERE id = ?',
        [serverData.nickname, serverData.password, existingServer[0].id]
      );
      console.log('✅ Server updated successfully!');
      return;
    }

    // 3. Generate unique server ID
    const serverId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`\n3. Generated server ID: ${serverId}`);

    // 4. Insert server
    console.log('\n4. Adding server to database...');
    await pool.query(`
      INSERT INTO rust_servers (
        id, ip, port, password, nickname, guild_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      serverId,
      serverData.ip,
      serverData.port,
      serverData.password,
      serverData.nickname,
      guildDbId
    ]);

    console.log('✅ Server added successfully!');

    // 5. Create default ZORP settings
    console.log('\n5. Creating default ZORP settings...');
    await pool.query(`
      INSERT INTO zorp_defaults (
        server_id, size, color_online, color_offline, color_yellow,
        radiation, delay, expire, min_team, max_team, enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      serverId, 75, '0,255,0', '255,0,0', '255,255,0',
      0, 5, 126000, 1, 8, 1
    ]);

    console.log('✅ ZORP defaults created!');

    // 6. Test connection
    console.log('\n6. Testing RCON connection...');
    try {
      const { sendRconCommand } = require('./src/rcon');
      const testResult = await sendRconCommand(serverData.ip, serverData.port, serverData.password, 'status');
      console.log('✅ RCON connection successful!');
      console.log('📊 Server status response received');
    } catch (rconError) {
      console.log('⚠️  RCON connection failed:', rconError.message);
      console.log('💡 Check if the server is online and RCON details are correct');
    }

    // 7. Verification
    console.log('\n7. Verifying server registration...');
    const [verifyResult] = await pool.query(`
      SELECT rs.*, g.discord_id 
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.id 
      WHERE rs.nickname = ? AND g.discord_id = ?
    `, [serverData.nickname, serverData.guildId]);

    if (verifyResult.length > 0) {
      console.log('✅ Server verification successful!');
      console.log('📋 Server details in database:');
      console.log(`   - ID: ${verifyResult[0].id}`);
      console.log(`   - Name: ${verifyResult[0].nickname}`);
      console.log(`   - IP: ${verifyResult[0].ip}:${verifyResult[0].port}`);
      console.log(`   - Guild: ${verifyResult[0].discord_id}`);
    } else {
      console.log('❌ Server verification failed!');
    }

    console.log('\n🎉 UPRISE 3X server setup completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Restart the bot: pm2 restart zentro-bot');
    console.log('2. Test commands like /edit-zorp and /add-shop-item');
    console.log('3. The server should now appear in autocomplete');

  } catch (error) {
    console.error('❌ Error adding server:', error);
  } finally {
    process.exit(0);
  }
}

// Run the function
addUpriseServer();
