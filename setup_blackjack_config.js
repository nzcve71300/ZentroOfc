const pool = require('./src/db');

async function setupBlackjackConfig() {
  try {
    console.log('🎰 Setting up blackjack configuration...');
    
    const serverId = '1753965211295_c5pfupu9'; // Your server ID
    const guildId = '1391149977434329230'; // Your guild ID
    
    console.log(`🔍 Server ID: ${serverId}`);
    console.log(`🔍 Guild ID: ${guildId}`);
    
    // Check if server exists
    const [serverResult] = await pool.query(
      'SELECT * FROM rust_servers WHERE id = ?',
      [serverId]
    );
    
    if (serverResult.length === 0) {
      console.log('❌ Server not found in rust_servers table');
      return;
    }
    
    console.log(`✅ Found server: ${serverResult[0].nickname}`);
    
    // Set up blackjack configuration
    const blackjackConfigs = [
      { setting_name: 'blackjack_toggle', setting_value: 'true' },
      { setting_name: 'blackjack_min_bet', setting_value: '1' },
      { setting_name: 'blackjack_max_bet', setting_value: '10000' },
      { setting_name: 'blackjack_payout', setting_value: '2.0' }
    ];
    
    console.log('🔧 Inserting blackjack configurations...');
    
    for (const config of blackjackConfigs) {
      await pool.query(
        'INSERT INTO eco_games_config (server_id, setting_name, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [serverId, config.setting_name, config.setting_value]
      );
      console.log(`✅ Set ${config.setting_name} = ${config.setting_value}`);
    }
    
    // Verify the configurations
    const [verifyResult] = await pool.query(
      'SELECT * FROM eco_games_config WHERE server_id = ? AND setting_name LIKE "blackjack%"',
      [serverId]
    );
    
    console.log('\n📋 Blackjack configurations:');
    verifyResult.forEach(config => {
      console.log(`   ${config.setting_name}: ${config.setting_value}`);
    });
    
    console.log('\n🎉 Blackjack configuration complete!');
    console.log('💡 You should now be able to use /blackjack command');
    
  } catch (error) {
    console.error('❌ Error setting up blackjack config:', error);
  } finally {
    await pool.end();
  }
}

setupBlackjackConfig(); 