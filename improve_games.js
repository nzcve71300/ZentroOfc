const pool = require('./src/db');

async function improveGames() {
  try {
    console.log('🎮 Improving game difficulty and configurations...');
    
    const serverId = '1753965211295_c5pfupu9';
    
    console.log(`🔍 Server ID: ${serverId}`);
    
    // Make blackjack more difficult by adjusting the card distribution
    console.log('🎰 Making blackjack more difficult...');
    
    // Update blackjack configuration to be more challenging
    const blackjackConfigs = [
      { setup: 'blackjack', option: 'min_max_bet', option_value: '10,5000' }, // Higher minimum bet
      { setup: 'blackjack', option: 'enabled', option_value: 'true' },
      { setup: 'blackjack', option: 'difficulty', option_value: 'hard' }, // New difficulty setting
      { setup: 'blackjack', option: 'dealer_advantage', option_value: '0.15' }, // 15% dealer advantage
      { setup: 'blackjack', option: 'blackjack_payout', option_value: '2.0' }, // Standard blackjack payout
      { setup: 'blackjack', option: 'insurance_enabled', option_value: 'false' }, // No insurance for difficulty
      { setup: 'blackjack', option: 'double_down_enabled', option_value: 'false' }, // No double down for difficulty
      { setup: 'blackjack', option: 'split_enabled', option_value: 'false' }, // No split for difficulty
      { setup: 'blackjack', option: 'surrender_enabled', option_value: 'false' }, // No surrender for difficulty
      { setup: 'blackjack', option: 'dealer_hits_soft_17', option_value: 'true' }, // Dealer hits soft 17
      { setup: 'blackjack', option: 'dealer_peeks_blackjack', option_value: 'true' }, // Dealer peeks for blackjack
      { setup: 'blackjack', option: 'deck_count', option_value: '1' }, // Single deck for more predictable odds
      { setup: 'blackjack', option: 'shuffle_frequency', option_value: 'every_hand' }, // Shuffle every hand
      { setup: 'blackjack', option: 'card_counting_penalty', option_value: 'ban' }, // Ban card counters
      { setup: 'blackjack', option: 'max_consecutive_wins', option_value: '3' }, // Limit consecutive wins
      { setup: 'blackjack', option: 'house_edge', option_value: '0.08' } // 8% house edge
    ];
    
    console.log('🔧 Updating blackjack configurations...');
    
    for (const config of blackjackConfigs) {
      await pool.query(
        'INSERT INTO eco_games (server_id, setup, option, option_value) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE option_value = VALUES(option_value)',
        [serverId, config.setup, config.option, config.option_value]
      );
      console.log(`✅ Set ${config.setup}.${config.option} = ${config.option_value}`);
    }
    
    // Ensure slots is properly configured
    console.log('🎰 Ensuring slots configuration...');
    
    const slotsConfigs = [
      { setup: 'slots', option: 'min_max_bet', option_value: '5,2000' }, // Lower max bet for slots
      { setup: 'slots', option: 'enabled', option_value: 'true' },
      { setup: 'slots', option: 'house_edge', option_value: '0.12' }, // 12% house edge
      { setup: 'slots', option: 'max_spins', option_value: '3' }, // 3 spins per game
      { setup: 'slots', option: 'jackpot_frequency', option_value: '0.01' }, // 1% jackpot chance
      { setup: 'slots', option: 'symbol_weights', option_value: 'apple:0.3,orange:0.25,grape:0.2,cherry:0.15,diamond:0.08,seven:0.02' }, // Weighted symbols
      { setup: 'slots', option: 'payout_multipliers', option_value: 'triple_diamond:10,triple_seven:5,triple_match:3,double_match:2' }, // Payout multipliers
      { setup: 'slots', option: 'bonus_rounds', option_value: 'false' }, // No bonus rounds for simplicity
      { setup: 'slots', option: 'progressive_jackpot', option_value: 'false' }, // No progressive jackpot
      { setup: 'slots', option: 'max_consecutive_losses', option_value: '10' }, // Limit consecutive losses
      { setup: 'slots', option: 'min_balance_for_bonus', option_value: '1000' }, // Minimum balance for bonus features
      { setup: 'slots', option: 'auto_spin_enabled', option_value: 'false' }, // No auto-spin
      { setup: 'slots', option: 'quick_spin_enabled', option_value: 'false' }, // No quick spin
      { setup: 'slots', option: 'sound_effects', option_value: 'false' }, // No sound effects
      { setup: 'slots', option: 'animation_speed', option_value: 'normal' } // Normal animation speed
    ];
    
    for (const config of slotsConfigs) {
      await pool.query(
        'INSERT INTO eco_games (server_id, setup, option, option_value) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE option_value = VALUES(option_value)',
        [serverId, config.setup, config.option, config.option_value]
      );
      console.log(`✅ Set ${config.setup}.${config.option} = ${config.option_value}`);
    }
    
    // Verify configurations
    const [verifyResult] = await pool.query(
      'SELECT * FROM eco_games WHERE server_id = ? ORDER BY setup, option',
      [serverId]
    );
    
    console.log('\n📋 Game configurations:');
    verifyResult.forEach(config => {
      console.log(`   ${config.setup}.${config.option}: ${config.option_value}`);
    });
    
    console.log('\n🎉 Game improvements complete!');
    console.log('💡 Blackjack is now more difficult with:');
    console.log('   - Higher minimum bet (10 coins)');
    console.log('   - 15% dealer advantage');
    console.log('   - Dealer hits soft 17');
    console.log('   - 8% house edge');
    console.log('   - No insurance, double down, split, or surrender');
    console.log('   - Single deck with shuffle every hand');
    console.log('   - Limited to 3 consecutive wins');
    console.log('💡 Slots is now properly configured with:');
    console.log('   - 12% house edge');
    console.log('   - Weighted symbol distribution');
    console.log('   - 3 spins per game');
    console.log('   - 1% jackpot chance');
    
  } catch (error) {
    console.error('❌ Error improving games:', error);
  } finally {
    await pool.end();
  }
}

improveGames(); 