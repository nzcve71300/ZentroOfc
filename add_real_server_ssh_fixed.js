const pool = require('./src/db');

async function addRealServer() {
  try {
    console.log('🔧 Adding real server and cleaning up placeholder...');
    
    const guildId = '1391149977434329230';
    const serverDetails = {
      id: '1753965211295_c5pfupu9', // Add the required ID
      nickname: 'Rise 3x',
      ip: '149.102.132.219',
      port: 30216,
      rcon_password: 'JPMGiS0u'
    };
    
    // First, remove any placeholder servers
    console.log('🗑️ Removing placeholder servers...');
    const [placeholderServers] = await pool.query(
      'SELECT * FROM rust_servers WHERE ip LIKE "%placeholder%" OR ip LIKE "%PLACEHOLDER%" OR nickname LIKE "%Unknown%" OR nickname LIKE "%placeholder%"'
    );
    
    for (const server of placeholderServers) {
      // Remove related data first
      await pool.query('DELETE FROM eco_games WHERE server_id = ?', [server.id]);
      await pool.query('DELETE FROM eco_games_config WHERE server_id = ?', [server.id]);
      await pool.query('DELETE FROM players WHERE server_id = ?', [server.id]);
      await pool.query('DELETE FROM economy WHERE player_id IN (SELECT id FROM players WHERE server_id = ?)', [server.id]);
      await pool.query('DELETE FROM transactions WHERE player_id IN (SELECT id FROM players WHERE server_id = ?)', [server.id]);
      
      // Remove the server
      await pool.query('DELETE FROM rust_servers WHERE id = ?', [server.id]);
      console.log(`✅ Removed placeholder server: ${server.nickname}`);
    }
    
    // Check if guild exists
    const [guilds] = await pool.query(
      'SELECT * FROM guilds WHERE discord_id = ?',
      [guildId]
    );
    
    let guildRecord;
    if (guilds.length === 0) {
      console.log('📋 Creating guild record...');
      const [result] = await pool.query(
        'INSERT INTO guilds (discord_id, name) VALUES (?, ?)',
        [guildId, 'Zentro Guild']
      );
      guildRecord = { id: result.insertId };
      console.log(`✅ Created guild record with ID: ${guildRecord.id}`);
    } else {
      guildRecord = guilds[0];
      console.log(`✅ Found existing guild record: ${guildRecord.name || 'Unknown'}`);
    }
    
    // Check if server already exists
    const [existingServers] = await pool.query(
      'SELECT * FROM rust_servers WHERE nickname = ? AND guild_id = ?',
      [serverDetails.nickname, guildRecord.id]
    );
    
    if (existingServers.length > 0) {
      console.log('🔄 Updating existing server...');
      await pool.query(
        'UPDATE rust_servers SET ip = ?, port = ?, rcon_password = ? WHERE id = ?',
        [serverDetails.ip, serverDetails.port, serverDetails.rcon_password, existingServers[0].id]
      );
      console.log(`✅ Updated server: ${serverDetails.nickname}`);
    } else {
      console.log('➕ Adding new server...');
      const [result] = await pool.query(
        'INSERT INTO rust_servers (id, guild_id, nickname, ip, port, rcon_password) VALUES (?, ?, ?, ?, ?, ?)',
        [serverDetails.id, guildRecord.id, serverDetails.nickname, serverDetails.ip, serverDetails.port, serverDetails.rcon_password]
      );
      console.log(`✅ Added server: ${serverDetails.nickname} with ID: ${serverDetails.id}`);
    }
    
    // Get the server ID
    const [serverResult] = await pool.query(
      'SELECT * FROM rust_servers WHERE nickname = ? AND guild_id = ?',
      [serverDetails.nickname, guildRecord.id]
    );
    
    if (serverResult.length > 0) {
      const serverId = serverResult[0].id;
      console.log(`\n🔧 Setting up configurations for server ID: ${serverId}`);
      
      // Set up coinflip configurations
      const coinflipConfigs = [
        { setup: 'coinflip', option: 'min_max_bet', option_value: '5,5000' },
        { setup: 'coinflip', option: 'enabled', option_value: 'true' },
        { setup: 'coinflip', option: 'house_edge', option_value: '0.15' },
        { setup: 'coinflip', option: 'payout_multiplier', option_value: '1.7' },
        { setup: 'coinflip', option: 'win_probability', option_value: '0.42' }
      ];
      
      for (const config of coinflipConfigs) {
        await pool.query(
          'INSERT INTO eco_games (server_id, setup, option, option_value) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE option_value = VALUES(option_value)',
          [serverId, config.setup, config.option, config.option_value]
        );
      }
      console.log('✅ Set up coinflip configurations');
      
      // Set up blackjack configurations
      const blackjackConfigs = [
        { setup: 'blackjack', option: 'min_max_bet', option_value: '5,10000' },
        { setup: 'blackjack', option: 'enabled', option_value: 'true' },
        { setup: 'blackjack', option: 'house_edge', option_value: '0.03' },
        { setup: 'blackjack', option: 'payout_multiplier', option_value: '2.0' }
      ];
      
      for (const config of blackjackConfigs) {
        await pool.query(
          'INSERT INTO eco_games (server_id, setup, option, option_value) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE option_value = VALUES(option_value)',
          [serverId, config.setup, config.option, config.option_value]
        );
      }
      console.log('✅ Set up blackjack configurations');
      
      // Set up eco_games_config table
      const ecoConfigs = [
        { setting_name: 'coinflip_toggle', setting_value: 'true' },
        { setting_name: 'coinflip_min', setting_value: '5' },
        { setting_name: 'coinflip_max', setting_value: '5000' },
        { setting_name: 'blackjack_toggle', setting_value: 'true' },
        { setting_name: 'blackjack_min', setting_value: '5' },
        { setting_name: 'blackjack_max', setting_value: '10000' },
        { setting_name: 'daily_amount', setting_value: '100' }
      ];
      
      for (const config of ecoConfigs) {
        await pool.query(
          'INSERT INTO eco_games_config (server_id, setting_name, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
          [serverId, config.setting_name, config.setting_value]
        );
      }
      console.log('✅ Set up eco_games_config');
    }
    
    // Verify everything
    const [finalServers] = await pool.query(
      'SELECT rs.* FROM rust_servers rs JOIN guilds g ON rs.guild_id = g.id WHERE g.discord_id = ?',
      [guildId]
    );
    
    console.log('\n📋 Final server configuration:');
    finalServers.forEach(server => {
      console.log(`   ✅ Server: ${server.nickname}`);
      console.log(`      ID: ${server.id}`);
      console.log(`      IP: ${server.ip}:${server.port}`);
      console.log(`      RCON Password: ${server.rcon_password ? 'Set' : 'Not set'}`);
    });
    
    console.log('\n🎉 Real server setup complete!');
    console.log('💡 Next steps:');
    console.log('   1. Restart your bot');
    console.log('   2. Test commands like: /coinflip, /blackjack, /daily');
    console.log('   3. The placeholder errors should be gone!');
    
  } catch (error) {
    console.error('❌ Error setting up real server:', error);
  } finally {
    await pool.end();
  }
}

addRealServer(); 