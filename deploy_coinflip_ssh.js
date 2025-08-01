const pool = require('./src/db');

async function deployCoinflip() {
  try {
    console.log('🪙 Deploying coinflip system...');
    
    const serverId = '1753965211295_c5pfupu9';
    
    console.log(`🔍 Server ID: ${serverId}`);
    
    // First, let's check if the eco_games table exists and has coinflip config
    console.log('🔧 Checking existing configurations...');
    
    const [existingConfigs] = await pool.query(
      'SELECT * FROM eco_games WHERE server_id = ? AND setup = "coinflip"',
      [serverId]
    );
    
    console.log(`📋 Found ${existingConfigs.length} existing coinflip configs`);
    
    // Set up coinflip configuration in eco_games table (legacy format)
    const coinflipConfigs = [
      { setup: 'coinflip', option: 'min_max_bet', option_value: '5,5000' },
      { setup: 'coinflip', option: 'enabled', option_value: 'true' },
      { setup: 'coinflip', option: 'house_edge', option_value: '0.00' },
      { setup: 'coinflip', option: 'payout_multiplier', option_value: '2.0' }
    ];
    
    console.log('🔧 Creating coinflip configurations in eco_games table...');
    
    for (const config of coinflipConfigs) {
      await pool.query(
        'INSERT INTO eco_games (server_id, setup, option, option_value) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE option_value = VALUES(option_value)',
        [serverId, config.setup, config.option, config.option_value]
      );
      console.log(`✅ Set ${config.setup}.${config.option} = ${config.option_value}`);
    }
    
    // Also set up in eco_games_config table (new format)
    console.log('🔧 Creating coinflip configurations in eco_games_config table...');
    
    const coinflipConfigsNew = [
      { setting_name: 'coinflip_toggle', setting_value: 'true' },
      { setting_name: 'coinflip_min', setting_value: '5' },
      { setting_name: 'coinflip_max', setting_value: '5000' }
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
    
    const [verifyEcoGamesConfig] = await pool.query(
      'SELECT * FROM eco_games_config WHERE server_id = ? AND setting_name LIKE "coinflip%" ORDER BY setting_name',
      [serverId]
    );
    
    console.log('\n📋 eco_games table configurations:');
    verifyEcoGames.forEach(config => {
      console.log(`   ${config.setup}.${config.option}: ${config.option_value}`);
    });
    
    console.log('\n📋 eco_games_config table configurations:');
    verifyEcoGamesConfig.forEach(config => {
      console.log(`   ${config.setting_name}: ${config.setting_value}`);
    });
    
    console.log('\n🎉 Coinflip deployment complete!');
    console.log('💡 Coinflip features:');
    console.log('   - 50/50 odds (0% house edge)');
    console.log('   - 2x payout on win');
    console.log('   - Bet range: 5-5,000 coins');
    console.log('   - Rich 3D coin display');
    console.log('   - Public messages (no ephemeral)');
    console.log('   - 30 second auto-flip timeout');
    console.log('   - Available in /eco-games-setup');
    
    console.log('\n🚀 Next steps:');
    console.log('   1. Restart your bot to load the new coinflip command');
    console.log('   2. Test with: /coinflip server:Rise 3x amount:100 side:heads');
    console.log('   3. Configure with: /eco-games-setup server:Rise 3x setup:Coinflip On/Off option:on');
    
  } catch (error) {
    console.error('❌ Error deploying coinflip:', error);
  } finally {
    await pool.end();
  }
}

deployCoinflip(); 