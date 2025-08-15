const pool = require('./src/db');

async function restoreUpriseServer() {
  try {
    console.log('🔧 Restoring UPRISE 3X server...');

    // Your original guild_id
    const yourGuildId = '1302510805853536298';
    
    // 1. Check what servers exist now
    console.log('\n1. Checking current servers...');
    const [allServers] = await pool.query(
      'SELECT * FROM rust_servers WHERE nickname = ?',
      ['UPRISE 3X']
    );
    
    console.log(`Found ${allServers.length} UPRISE 3X servers:`);
    allServers.forEach((server, index) => {
      console.log(`   Server ${index + 1}:`);
      console.log(`   - ID: ${server.id}`);
      console.log(`   - Guild ID: ${server.guild_id}`);
      console.log(`   - IP: ${server.ip}:${server.port}`);
    });

    // 2. Check if we need to create the server
    const existingServer = allServers.find(s => s.guild_id === yourGuildId);
    
    if (!existingServer) {
      console.log('\n2. No server found with your guild_id. Creating new server...');
      
      // Check if your guild exists
      const [guildResult] = await pool.query(
        'SELECT * FROM guilds WHERE discord_id = ?',
        [yourGuildId]
      );
      
      let guildDbId;
      if (guildResult.length === 0) {
        console.log('Creating guild entry...');
        const [insertResult] = await pool.query(
          'INSERT INTO guilds (discord_id, name) VALUES (?, ?)',
          [yourGuildId, 'UPRISE Guild']
        );
        guildDbId = insertResult.insertId;
        console.log(`✅ Guild created with ID: ${guildDbId}`);
      } else {
        guildDbId = guildResult[0].id;
        console.log(`✅ Using existing guild ID: ${guildDbId}`);
      }
      
      // Generate new server ID
      const serverId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create the server
      await pool.query(`
        INSERT INTO rust_servers (
          id, guild_id, nickname, ip, port, password, rcon_password, rcon_port, currency_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        serverId, guildDbId, 'UPRISE 3X', '149.102.132.219', 30216, 'JPMGiS0u', 'JPMGiS0u', 30216, 'coins'
      ]);
      
      console.log('✅ Server created successfully');
      
      // Create ZORP defaults
      await pool.query(`
        INSERT INTO zorp_defaults (
          server_id, size, color_online, color_offline, color_yellow,
          radiation, delay, expire, min_team, max_team, enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        serverId, 75, '0,255,0', '255,0,0', '255,255,0',
        0, 5, 126000, 1, 8, 1
      ]);
      
      console.log('✅ ZORP defaults created');
      
    } else {
      console.log('\n2. Server exists with your guild_id. Updating RCON settings...');
      
      await pool.query(`
        UPDATE rust_servers 
        SET rcon_port = ?, rcon_password = ?
        WHERE id = ?
      `, [30216, 'JPMGiS0u', existingServer.id]);
      
      console.log('✅ Server updated');
    }

    // 3. Clean up any servers with wrong guild_id
    console.log('\n3. Cleaning up servers with incorrect guild_id...');
    const [cleanupResult] = await pool.query(`
      DELETE FROM rust_servers 
      WHERE nickname = ? AND guild_id != ?
    `, ['UPRISE 3X', guildDbId || existingServer.guild_id]);
    
    if (cleanupResult.affectedRows > 0) {
      console.log(`✅ Removed ${cleanupResult.affectedRows} incorrect servers`);
    }

    // 4. Final verification
    console.log('\n4. Final verification...');
    const [finalResult] = await pool.query(`
      SELECT rs.*, g.discord_id as guild_discord_id
      FROM rust_servers rs 
      LEFT JOIN guilds g ON rs.guild_id = g.id 
      WHERE rs.nickname = ?
    `, ['UPRISE 3X']);

    console.log('📋 Final server status:');
    finalResult.forEach((server, index) => {
      console.log(`   Server ${index + 1}:`);
      console.log(`   - ID: ${server.id}`);
      console.log(`   - Guild DB ID: ${server.guild_id}`);
      console.log(`   - Guild Discord ID: ${server.guild_discord_id}`);
      console.log(`   - IP: ${server.ip}:${server.port}`);
      console.log(`   - RCON: ${server.ip}:${server.rcon_port}`);
      console.log(`   - RCON Password: ${server.rcon_password}`);
    });

    if (finalResult.length === 1 && finalResult[0].guild_discord_id === yourGuildId) {
      console.log('\n✅ Perfect! UPRISE 3X server is correctly configured');
    } else {
      console.log('\n⚠️  Something might still need adjustment');
    }

    console.log('\n🎉 UPRISE 3X server restore completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Restart bot: pm2 restart zentro-bot');
    console.log('2. Test /edit-zorp command in Discord');

  } catch (error) {
    console.error('❌ Error restoring server:', error);
  } finally {
    process.exit(0);
  }
}

// Run the function
restoreUpriseServer();
