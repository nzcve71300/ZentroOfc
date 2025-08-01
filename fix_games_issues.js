const pool = require('./src/db');

async function fixGamesIssues() {
  try {
    console.log('🔧 Fixing game issues...');
    
    const serverId = '1753965211295_c5pfupu9';
    
    console.log(`🔍 Server ID: ${serverId}`);
    
    // Make blackjack less difficult
    console.log('🎰 Making blackjack less difficult...');
    
    const blackjackConfigs = [
      { setup: 'blackjack', option: 'min_max_bet', option_value: '5,10000' }, // Lower minimum bet
      { setup: 'blackjack', option: 'enabled', option_value: 'true' },
      { setup: 'blackjack', option: 'difficulty', option_value: 'medium' }, // Medium difficulty
      { setup: 'blackjack', option: 'dealer_advantage', option_value: '0.05' }, // 5% dealer advantage (was 15%)
      { setup: 'blackjack', option: 'blackjack_payout', option_value: '2.5' }, // Better blackjack payout
      { setup: 'blackjack', option: 'insurance_enabled', option_value: 'false' },
      { setup: 'blackjack', option: 'double_down_enabled', option_value: 'false' },
      { setup: 'blackjack', option: 'split_enabled', option_value: 'false' },
      { setup: 'blackjack', option: 'surrender_enabled', option_value: 'false' },
      { setup: 'blackjack', option: 'dealer_hits_soft_17', option_value: 'false' }, // Dealer stands on soft 17
      { setup: 'blackjack', option: 'dealer_peeks_blackjack', option_value: 'true' },
      { setup: 'blackjack', option: 'deck_count', option_value: '6' }, // 6 deck shoe for better odds
      { setup: 'blackjack', option: 'shuffle_frequency', option_value: 'every_hand' },
      { setup: 'blackjack', option: 'card_counting_penalty', option_value: 'none' }, // No penalty
      { setup: 'blackjack', option: 'max_consecutive_wins', option_value: '10' }, // More consecutive wins allowed
      { setup: 'blackjack', option: 'house_edge', option_value: '0.03' } // 3% house edge (was 8%)
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
      { setup: 'slots', option: 'min_max_bet', option_value: '5,2000' },
      { setup: 'slots', option: 'enabled', option_value: 'true' },
      { setup: 'slots', option: 'house_edge', option_value: '0.08' }, // Lower house edge
      { setup: 'slots', option: 'max_spins', option_value: '3' },
      { setup: 'slots', option: 'jackpot_frequency', option_value: '0.02' }, // 2% jackpot chance
      { setup: 'slots', option: 'symbol_weights', option_value: 'apple:0.25,orange:0.25,grape:0.2,cherry:0.15,diamond:0.1,seven:0.05' }, // Better symbol distribution
      { setup: 'slots', option: 'payout_multipliers', option_value: 'triple_diamond:10,triple_seven:5,triple_match:3,double_match:2' },
      { setup: 'slots', option: 'bonus_rounds', option_value: 'false' },
      { setup: 'slots', option: 'progressive_jackpot', option_value: 'false' },
      { setup: 'slots', option: 'max_consecutive_losses', option_value: '15' }, // More consecutive losses allowed
      { setup: 'slots', option: 'min_balance_for_bonus', option_value: '500' }, // Lower minimum balance
      { setup: 'slots', option: 'auto_spin_enabled', option_value: 'false' },
      { setup: 'slots', option: 'quick_spin_enabled', option_value: 'false' },
      { setup: 'slots', option: 'sound_effects', option_value: 'false' },
      { setup: 'slots', option: 'animation_speed', option_value: 'normal' }
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
    
    console.log('\n🎉 Game fixes complete!');
    console.log('💡 Blackjack is now less difficult with:');
    console.log('   - Lower minimum bet (5 coins)');
    console.log('   - 5% dealer advantage (was 15%)');
    console.log('   - Dealer stands on soft 17');
    console.log('   - 3% house edge (was 8%)');
    console.log('   - 6 deck shoe for better odds');
    console.log('   - 10 consecutive wins allowed');
    console.log('💡 Slots is now properly configured with:');
    console.log('   - 8% house edge (was 12%)');
    console.log('   - Better symbol distribution');
    console.log('   - 2% jackpot chance');
    
  } catch (error) {
    console.error('❌ Error fixing games:', error);
  } finally {
    await pool.end();
  }
}

fixGamesIssues(); 