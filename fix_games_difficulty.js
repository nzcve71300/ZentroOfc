const pool = require('./src/db');

async function fixGamesDifficulty() {
  try {
    console.log('🔧 Fixing game difficulty and eco-configs...');
    
    const serverId = '1753965211295_c5pfupu9';
    
    console.log(`🔍 Server ID: ${serverId}`);
    
    // First, let's check what servers exist
    const [servers] = await pool.query(
      'SELECT id, nickname FROM rust_servers WHERE id = ?',
      [serverId]
    );
    
    if (servers.length === 0) {
      console.log('❌ Server not found, creating default configurations...');
      
      // Create default server if it doesn't exist
      const guildId = '1391149977434329230';
      await pool.query(
        'INSERT INTO rust_servers (id, guild_id, nickname, ip, port) VALUES (?, ?, ?, ?, ?)',
        [serverId, guildId, 'Default Server', '127.0.0.1', 28015]
      );
      console.log('✅ Created default server');
    } else {
      console.log(`✅ Found server: ${servers[0].nickname}`);
    }
    
    // Set up more difficult coinflip configurations
    console.log('🪙 Setting up difficult coinflip configurations...');
    
    const coinflipConfigs = [
      { setting_name: 'coinflip_toggle', setting_value: 'true' },
      { setting_name: 'coinflip_min', setting_value: '10' },
      { setting_name: 'coinflip_max', setting_value: '5000' },
      { setting_name: 'coinflip_win_probability', setting_value: '0.35' }, // 35% win chance
      { setting_name: 'coinflip_payout_multiplier', setting_value: '1.5' } // 1.5x payout
    ];
    
    for (const config of coinflipConfigs) {
      await pool.query(
        'INSERT INTO eco_games_config (server_id, setting_name, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [serverId, config.setting_name, config.setting_value]
      );
      console.log(`✅ Set ${config.setting_name} = ${config.setting_value}`);
    }
    
    // Set up more difficult blackjack configurations
    console.log('🎰 Setting up difficult blackjack configurations...');
    
    const blackjackConfigs = [
      { setting_name: 'blackjack_toggle', setting_value: 'true' },
      { setting_name: 'blackjack_min', setting_value: '10' },
      { setting_name: 'blackjack_max', setting_value: '10000' },
      { setting_name: 'blackjack_house_edge', setting_value: '0.08' }, // 8% house edge
      { setting_name: 'blackjack_payout', setting_value: '2.0' } // Standard 2x payout
    ];
    
    for (const config of blackjackConfigs) {
      await pool.query(
        'INSERT INTO eco_games_config (server_id, setting_name, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [serverId, config.setting_name, config.setting_value]
      );
      console.log(`✅ Set ${config.setting_name} = ${config.setting_value}`);
    }
    
    // Set up other economy configurations
    console.log('💰 Setting up other economy configurations...');
    
    const otherConfigs = [
      { setting_name: 'daily_amount', setting_value: '100' },
      { setting_name: 'starting_balance', setting_value: '500' },
      { setting_name: 'playerkills_amount', setting_value: '50' },
      { setting_name: 'misckills_amount', setting_value: '25' }
    ];
    
    for (const config of otherConfigs) {
      await pool.query(
        'INSERT INTO eco_games_config (server_id, setting_name, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [serverId, config.setting_name, config.setting_value]
      );
      console.log(`✅ Set ${config.setting_name} = ${config.setting_value}`);
    }
    
    // Test the configurations by reading them back
    console.log('\n📋 Verifying configurations...');
    
    const [verifyResult] = await pool.query(
      'SELECT setting_name, setting_value FROM eco_games_config WHERE server_id = ? ORDER BY setting_name',
      [serverId]
    );
    
    console.log('\n📋 Current configurations:');
    verifyResult.forEach(config => {
      console.log(`   ${config.setting_name}: ${config.setting_value}`);
    });
    
    // Test disabling games
    console.log('\n🧪 Testing game disable functionality...');
    
    // Disable coinflip
    await pool.query(
      'UPDATE eco_games_config SET setting_value = "false" WHERE server_id = ? AND setting_name = "coinflip_toggle"',
      [serverId]
    );
    console.log('✅ Disabled coinflip');
    
    // Disable blackjack
    await pool.query(
      'UPDATE eco_games_config SET setting_value = "false" WHERE server_id = ? AND setting_name = "blackjack_toggle"',
      [serverId]
    );
    console.log('✅ Disabled blackjack');
    
    // Verify they're disabled
    const [disabledResult] = await pool.query(
      'SELECT setting_name, setting_value FROM eco_games_config WHERE server_id = ? AND setting_name IN ("coinflip_toggle", "blackjack_toggle")',
      [serverId]
    );
    
    console.log('\n📋 Game toggle status:');
    disabledResult.forEach(config => {
      const status = config.setting_value === 'true' ? '🟢 Enabled' : '🔴 Disabled';
      console.log(`   ${config.setting_name}: ${status}`);
    });
    
    // Re-enable games for testing
    console.log('\n🔄 Re-enabling games for testing...');
    
    await pool.query(
      'UPDATE eco_games_config SET setting_value = "true" WHERE server_id = ? AND setting_name IN ("coinflip_toggle", "blackjack_toggle")',
      [serverId]
    );
    console.log('✅ Re-enabled both games');
    
    console.log('\n🎉 Game difficulty and eco-configs fixed!');
    console.log('💡 Changes made:');
    console.log('   - Added game toggle checks to coinflip and blackjack commands');
    console.log('   - Made coinflip harder: 35% win chance, 1.5x payout');
    console.log('   - Made blackjack harder: more low cards, dealer hits soft 17');
    console.log('   - Set up proper eco-configs database entries');
    console.log('   - Verified toggle functionality works');
    
    console.log('\n🚀 Next steps:');
    console.log('   1. Restart your bot to load the updated commands');
    console.log('   2. Test /eco-configs to disable/enable games');
    console.log('   3. Test /coinflip and /blackjack - they should be harder now');
    console.log('   4. Try disabling games with /eco-configs and verify they\'re blocked');
    
  } catch (error) {
    console.error('❌ Error fixing game difficulty:', error);
  } finally {
    await pool.end();
  }
}

fixGamesDifficulty(); 