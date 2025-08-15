const pool = require('./src/db');

async function fixUpriseServer() {
  try {
    console.log('🔧 Fixing UPRISE 3X server registration...');

    const guildId = '1302510805853536298';
    const serverName = 'UPRISE 3X';

    // 1. Check current servers
    console.log('\n1. Current UPRISE 3X servers in database:');
    const [currentServers] = await pool.query(
      'SELECT * FROM rust_servers WHERE nickname = ?',
      [serverName]
    );
    
    currentServers.forEach((server, index) => {
      console.log(`   Server ${index + 1}:`);
      console.log(`   - ID: ${server.id}`);
      console.log(`   - Guild ID: ${server.guild_id}`);
      console.log(`   - IP: ${server.ip}:${server.port}`);
      console.log(`   - RCON Port: ${server.rcon_port}`);
    });

    // 2. Find the correct guild
    console.log('\n2. Finding correct guild...');
    const [guildResult] = await pool.query(
      'SELECT * FROM guilds WHERE discord_id = ?',
      [guildId]
    );

    if (guildResult.length === 0) {
      console.log('❌ Guild not found!');
      return;
    }

    const correctGuildDbId = guildResult[0].id;
    console.log(`✅ Found guild with DB ID: ${correctGuildDbId}`);

    // 3. Keep the first server (it has the correct guild_id format) and update it
    const keepServer = currentServers.find(s => s.guild_id === guildId);
    
    if (keepServer) {
      console.log(`\n3. Updating existing server: ${keepServer.id}`);
      
      // Update the server with correct RCON port
      await pool.query(`
        UPDATE rust_servers 
        SET rcon_port = ?, rcon_password = ?
        WHERE id = ?
      `, [30216, 'JPMGiS0u', keepServer.id]);
      
      console.log('✅ Updated server with correct RCON details');
      
      // 4. Remove duplicate servers
      const duplicateServers = currentServers.filter(s => s.id !== keepServer.id);
      
      for (const duplicate of duplicateServers) {
        console.log(`\n4. Removing duplicate server: ${duplicate.id}`);
        
        // Remove ZORP defaults for duplicate
        await pool.query('DELETE FROM zorp_defaults WHERE server_id = ?', [duplicate.id]);
        console.log('   - Removed ZORP defaults');
        
        // Remove server
        await pool.query('DELETE FROM rust_servers WHERE id = ?', [duplicate.id]);
        console.log('   - Removed server entry');
      }
      
      // 5. Ensure ZORP defaults exist for the correct server
      console.log('\n5. Checking ZORP defaults...');
      const [zorpDefaults] = await pool.query(
        'SELECT * FROM zorp_defaults WHERE server_id = ?',
        [keepServer.id]
      );
      
      if (zorpDefaults.length === 0) {
        console.log('Creating ZORP defaults for correct server...');
        await pool.query(`
          INSERT INTO zorp_defaults (
            server_id, size, color_online, color_offline, color_yellow,
            radiation, delay, expire, min_team, max_team, enabled
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          keepServer.id, 75, '0,255,0', '255,0,0', '255,255,0',
          0, 5, 126000, 1, 8, 1
        ]);
        console.log('✅ ZORP defaults created');
      } else {
        console.log('✅ ZORP defaults already exist');
      }
      
    } else {
      console.log('❌ No server found with correct guild_id format!');
      return;
    }

    // 6. Clean up the incorrect guild entry we created
    console.log('\n6. Cleaning up incorrect guild entry...');
    await pool.query('DELETE FROM guilds WHERE id = ? AND discord_id != ?', [476, guildId]);
    console.log('✅ Cleaned up incorrect guild entry');

    // 7. Final verification
    console.log('\n7. Final verification...');
    const [finalResult] = await pool.query(`
      SELECT rs.*, g.discord_id as guild_discord_id
      FROM rust_servers rs 
      JOIN guilds g ON rs.guild_id = g.discord_id 
      WHERE rs.nickname = ? AND g.discord_id = ?
    `, [serverName, guildId]);

    if (finalResult.length > 0) {
      const server = finalResult[0];
      console.log('✅ Server verification successful!');
      console.log('📋 Final server details:');
      console.log(`   - ID: ${server.id}`);
      console.log(`   - Name: ${server.nickname}`);
      console.log(`   - IP: ${server.ip}:${server.port}`);
      console.log(`   - RCON: ${server.ip}:${server.rcon_port}`);
      console.log(`   - Guild: ${server.guild_discord_id}`);
    } else {
      console.log('❌ Server verification failed!');
    }

    console.log('\n🎉 UPRISE 3X server fix completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Restart the bot: pm2 restart zentro-bot');
    console.log('2. Test Discord commands - UPRISE 3X should appear in autocomplete');

  } catch (error) {
    console.error('❌ Error fixing server:', error);
  } finally {
    process.exit(0);
  }
}

// Run the function
fixUpriseServer();
