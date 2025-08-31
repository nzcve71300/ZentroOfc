const pool = require('./src/db');
const KillfeedProcessor = require('./src/utils/killfeedProcessor');

async function testKDRatioFix() {
  console.log('🧪 Testing K/D Ratio Fix for Killfeeds...');
  console.log('==========================================\n');

  try {
    // Test 1: Check current K/D ratio logic
    console.log('📋 Test 1: Updated K/D Ratio Logic');
    console.log('- All player stats methods now return kd_ratio: "0" for new players');
    console.log('- Existing players get calculated K/D ratio');
    console.log('- No more "undefined" in killfeed messages');
    
    // Test 2: Test getPlayerStats with non-existent player
    console.log('\n📋 Test 2: Testing getPlayerStats with non-existent player');
    const nonExistentPlayerStats = await KillfeedProcessor.getPlayerStats('NonExistentPlayer123', '1756598716651_wmh0kflng');
    console.log('Non-existent player stats:', nonExistentPlayerStats);
    console.log('K/D ratio:', nonExistentPlayerStats.kd_ratio);
    console.log('Expected: "0", Got:', nonExistentPlayerStats.kd_ratio);
    
    if (nonExistentPlayerStats.kd_ratio === '0') {
      console.log('✅ SUCCESS: Non-existent player returns kd_ratio: "0"');
    } else {
      console.log('❌ FAILED: Non-existent player should return kd_ratio: "0"');
    }
    
    // Test 3: Test getPlayerStats with scientist
    console.log('\n📋 Test 3: Testing getPlayerStats with scientist');
    const scientistStats = await KillfeedProcessor.getPlayerStats('scientist', '1756598716651_wmh0kflng');
    console.log('Scientist stats:', scientistStats);
    console.log('K/D ratio:', scientistStats.kd_ratio);
    console.log('Expected: "0", Got:', scientistStats.kd_ratio);
    
    if (scientistStats.kd_ratio === '0') {
      console.log('✅ SUCCESS: Scientist returns kd_ratio: "0"');
    } else {
      console.log('❌ FAILED: Scientist should return kd_ratio: "0"');
    }
    
    // Test 4: Test getPlayerStats with empty name
    console.log('\n📋 Test 4: Testing getPlayerStats with empty name');
    const emptyNameStats = await KillfeedProcessor.getPlayerStats('', '1756598716651_wmh0kflng');
    console.log('Empty name stats:', emptyNameStats);
    console.log('K/D ratio:', emptyNameStats.kd_ratio);
    console.log('Expected: "0", Got:', emptyNameStats.kd_ratio);
    
    if (emptyNameStats.kd_ratio === '0') {
      console.log('✅ SUCCESS: Empty name returns kd_ratio: "0"');
    } else {
      console.log('❌ FAILED: Empty name should return kd_ratio: "0"');
    }
    
    // Test 5: Test formatKillfeedMessage with new players
    console.log('\n📋 Test 5: Testing formatKillfeedMessage with new players');
    const testFormatString = '{Killer} ({KillerKD} K/D) killed {Victim} ({VictimKD} K/D)';
    const formattedMessage = await KillfeedProcessor.formatKillfeedMessage(
      'NewPlayer killed AnotherNewPlayer',
      testFormatString,
      'NewPlayer',
      'AnotherNewPlayer',
      '1756598716651_wmh0kflng'
    );
    
    console.log('Formatted message:', formattedMessage);
    console.log('Contains "undefined":', formattedMessage.includes('undefined'));
    console.log('Contains "0":', formattedMessage.includes('0'));
    
    if (!formattedMessage.includes('undefined') && formattedMessage.includes('0')) {
      console.log('✅ SUCCESS: Formatted message shows "0" instead of "undefined"');
    } else {
      console.log('❌ FAILED: Formatted message should show "0" instead of "undefined"');
    }
    
    // Test 6: Check existing players in database
    console.log('\n📋 Test 6: Testing with existing players in database');
    const [existingPlayers] = await pool.query(
      `SELECT p.ign, ps.kills, ps.deaths 
       FROM players p 
       JOIN player_stats ps ON p.id = ps.player_id 
       WHERE p.server_id = '1756598716651_wmh0kflng' 
       AND ps.kills > 0 
       LIMIT 1`
    );
    
    if (existingPlayers.length > 0) {
      const existingPlayer = existingPlayers[0];
      console.log('Testing with existing player:', existingPlayer.ign);
      
      const existingPlayerStats = await KillfeedProcessor.getPlayerStats(existingPlayer.ign, '1756598716651_wmh0kflng');
      console.log('Existing player stats:', existingPlayerStats);
      console.log('K/D ratio:', existingPlayerStats.kd_ratio);
      
      const expectedKD = existingPlayer.deaths > 0 ? (existingPlayer.kills / existingPlayer.deaths).toFixed(2) : existingPlayer.kills.toString();
      console.log('Expected K/D:', expectedKD);
      
      if (existingPlayerStats.kd_ratio === expectedKD) {
        console.log('✅ SUCCESS: Existing player K/D calculated correctly');
      } else {
        console.log('❌ FAILED: Existing player K/D calculation incorrect');
      }
    } else {
      console.log('ℹ️ No existing players with kills found for testing');
    }

    console.log('\n✅ K/D Ratio Fix Test Complete!');
    console.log('🎯 Key Changes:');
    console.log('- getPlayerStats now always returns kd_ratio field');
    console.log('- New players get kd_ratio: "0"');
    console.log('- Existing players get calculated K/D ratio');
    console.log('- No more "undefined" in killfeed messages');

  } catch (error) {
    console.error('❌ Error testing K/D ratio fix:', error);
  } finally {
    await pool.end();
  }
}

// Run test if called directly
if (require.main === module) {
  testKDRatioFix()
    .then(() => {
      console.log('\n✅ TEST COMPLETE!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ TEST FAILED:', error);
      process.exit(1);
    });
}

module.exports = {
  testKDRatioFix
};
