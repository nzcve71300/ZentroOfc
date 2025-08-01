const pool = require('./src/db');

async function makeCoinflipHarder() {
  try {
    console.log('🪙 Making coinflip more challenging...');
    
    const serverId = '1753965211295_c5pfupu9';
    
    console.log(`🔍 Server ID: ${serverId}`);
    
    // Make coinflip more difficult with house edge and adjusted odds
    const coinflipConfigs = [
      { setup: 'coinflip', option: 'min_max_bet', option_value: '5,5000' },
      { setup: 'coinflip', option: 'enabled', option_value: 'true' },
      { setup: 'coinflip', option: 'house_edge', option_value: '0.15' }, // 15% house edge (was 0%)
      { setup: 'coinflip', option: 'payout_multiplier', option_value: '1.7' }, // Lower payout (was 2.0)
      { setup: 'coinflip', option: 'win_probability', option_value: '0.42' } // 42% win chance (was 50%)
    ];
    
    console.log('🔧 Updating coinflip configurations for higher difficulty...');
    
    for (const config of coinflipConfigs) {
      await pool.query(
        'INSERT INTO eco_games (server_id, setup, option, option_value) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE option_value = VALUES(option_value)',
        [serverId, config.setup, config.option, config.option_value]
      );
      console.log(`✅ Set ${config.setup}.${config.option} = ${config.option_value}`);
    }
    
    // Also update eco_games_config table
    const coinflipConfigsNew = [
      { setting_name: 'coinflip_toggle', setting_value: 'true' },
      { setting_name: 'coinflip_min', setting_value: '5' },
      { setting_name: 'coinflip_max', setting_value: '5000' },
      { setting_name: 'coinflip_house_edge', setting_value: '0.15' },
      { setting_name: 'coinflip_payout', setting_value: '1.7' }
    ];
    
    for (const config of coinflipConfigsNew) {
      await pool.query(
        'INSERT INTO eco_games_config (server_id, setting_name, setting_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [serverId, config.setting_name, config.setting_value]
      );
      console.log(`✅ Set ${config.setting_name} = ${config.setting_value}`);
    }
    
    // Verify configurations
    const [verifyEcoGames] = await pool.query(
      'SELECT * FROM eco_games WHERE server_id = ? AND setup = "coinflip" ORDER BY option',
      [serverId]
    );
    
    console.log('\n📋 Updated eco_games table configurations:');
    verifyEcoGames.forEach(config => {
      console.log(`   ${config.setup}.${config.option}: ${config.option_value}`);
    });
    
    console.log('\n🎉 Coinflip difficulty increased!');
    console.log('💡 New coinflip settings:');
    console.log('   - 42% win probability (was 50%)');
    console.log('   - 15% house edge (was 0%)');
    console.log('   - 1.7x payout on win (was 2.0x)');
    console.log('   - Bet range: 5-5,000 coins');
    console.log('   - Much more challenging!');
    
    console.log('\n🚀 Next steps:');
    console.log('   1. Restart your bot to apply the new settings');
    console.log('   2. Test with: /coinflip server:Rise 3x amount:100 side:heads');
    console.log('   3. You should win much less frequently now!');
    
  } catch (error) {
    console.error('❌ Error updating coinflip difficulty:', error);
  } finally {
    await pool.end();
  }
}

makeCoinflipHarder(); 