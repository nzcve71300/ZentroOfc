const pool = require('./src/db');

async function setupCoinflip() {
  try {
    console.log('🪙 Setting up coinflip configuration...');
    
    const serverId = '1753965211295_c5pfupu9';
    
    console.log(`🔍 Server ID: ${serverId}`);
    
    // Set up coinflip configuration
    const coinflipConfigs = [
      { setup: 'coinflip', option: 'min_max_bet', option_value: '5,5000' }, // Bet limits
      { setup: 'coinflip', option: 'enabled', option_value: 'true' },
      { setup: 'coinflip', option: 'house_edge', option_value: '0.00' }, // 0% house edge (50/50)
      { setup: 'coinflip', option: 'payout_multiplier', option_value: '2.0' }, // 2x payout
      { setup: 'coinflip', option: 'max_consecutive_wins', option_value: '20' }, // High limit
      { setup: 'coinflip', option: 'animation_duration', option_value: '3' }, // 3 seconds
      { setup: 'coinflip', option: 'sound_effects', option_value: 'false' }, // No sound
      { setup: 'coinflip', option: 'auto_flip_timeout', option_value: '30' }, // 30 second timeout
      { setup: 'coinflip', option: 'min_balance_required', option_value: '10' }, // Minimum balance
      { setup: 'coinflip', option: 'max_daily_games', option_value: '100' }, // Daily limit
      { setup: 'coinflip', option: 'bonus_rounds', option_value: 'false' }, // No bonus rounds
      { setup: 'coinflip', option: 'progressive_jackpot', option_value: 'false' }, // No progressive
      { setup: 'coinflip', option: 'streak_multiplier', option_value: 'false' }, // No streak bonus
      { setup: 'coinflip', option: 'insurance_enabled', option_value: 'false' }, // No insurance
      { setup: 'coinflip', option: 'double_down_enabled', option_value: 'false' } // No double down
    ];
    
    console.log('🔧 Creating coinflip configurations...');
    
    for (const config of coinflipConfigs) {
      await pool.query(
        'INSERT INTO eco_games (server_id, setup, option, option_value) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE option_value = VALUES(option_value)',
        [serverId, config.setup, config.option, config.option_value]
      );
      console.log(`✅ Set ${config.setup}.${config.option} = ${config.option_value}`);
    }
    
    // Verify configurations
    const [verifyResult] = await pool.query(
      'SELECT * FROM eco_games WHERE server_id = ? AND setup = "coinflip" ORDER BY option',
      [serverId]
    );
    
    console.log('\n📋 Coinflip configurations:');
    verifyResult.forEach(config => {
      console.log(`   ${config.setup}.${config.option}: ${config.option_value}`);
    });
    
    console.log('\n🎉 Coinflip setup complete!');
    console.log('💡 Coinflip features:');
    console.log('   - 50/50 odds (0% house edge)');
    console.log('   - 2x payout on win');
    console.log('   - Bet range: 5-5,000 coins');
    console.log('   - Rich 3D coin display');
    console.log('   - Public messages (no ephemeral)');
    console.log('   - 30 second auto-flip timeout');
    console.log('   - 100 daily games limit');
    
  } catch (error) {
    console.error('❌ Error setting up coinflip:', error);
  } finally {
    await pool.end();
  }
}

setupCoinflip(); 