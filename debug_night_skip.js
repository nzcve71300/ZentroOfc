const pool = require('./src/db');

async function debugNightSkip() {
  try {
    console.log('🔍 Debugging Night Skip Voting System...');
    console.log('=====================================\n');
    
    // 1. Check if night_skip_settings table exists
    console.log('📋 Step 1: Checking night_skip_settings table...');
    const [tableCheck] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'night_skip_settings'
    `);
    
    if (tableCheck[0].count === 0) {
      console.log('❌ night_skip_settings table does not exist!');
      console.log('💡 Run: node sql/create_night_skip_settings_table.sql');
      return;
    }
    console.log('✅ night_skip_settings table exists');
    
    // 2. Check night skip settings for all servers
    console.log('\n📋 Step 2: Checking night skip settings...');
    const [settings] = await pool.query(`
      SELECT rs.nickname, nss.minimum_voters, nss.enabled
      FROM rust_servers rs
      LEFT JOIN night_skip_settings nss ON rs.id = nss.server_id
      ORDER BY rs.nickname
    `);
    
    if (settings.length === 0) {
      console.log('❌ No servers found in database');
      return;
    }
    
    console.log('📊 Night Skip Settings:');
    settings.forEach(setting => {
      const status = setting.enabled ? '✅ ENABLED' : '❌ DISABLED';
      const minVoters = setting.minimum_voters || 'Not set (default: 5)';
      console.log(`   ${setting.nickname}: ${status} (Min voters: ${minVoters})`);
    });
    
    // 3. Check current game time (if RCON is available)
    console.log('\n📋 Step 3: Checking current game time...');
    console.log('💡 The night skip vote only starts automatically at 18:00 (6 PM) game time');
    console.log('💡 If it\'s not 18:00, there won\'t be an active voting session');
    console.log('💡 Votes are only counted when a voting session is active');
    
    // 4. Explain the voting process
    console.log('\n📋 Step 4: How Night Skip Voting Works...');
    console.log('🕐 18:00 Game Time: System automatically starts voting session');
    console.log('📢 Players see: "VOTE TO SKIP NIGHT - use the (YES) emote"');
    console.log('👍 Players vote: Use the YES emote (d11_quick_chat_responses_slot_0)');
    console.log('⏱️ 30 seconds: Voting session ends automatically');
    console.log('🎯 Success: If enough votes, time is set to 12:00 (noon)');
    console.log('❌ Failure: If not enough votes, night continues');
    
    // 5. Common issues
    console.log('\n📋 Step 5: Common Issues...');
    console.log('❌ "Vote yes but nothing happens":');
    console.log('   - No active voting session (not 18:00 game time)');
    console.log('   - Night skip is disabled for this server');
    console.log('   - Not enough players voted (need minimum voters)');
    console.log('   - Voting session already ended (30-second timeout)');
    
    // 6. Manual testing
    console.log('\n📋 Step 6: Manual Testing...');
    console.log('🔧 To test the system manually:');
    console.log('   1. Set game time to 18:00: /time 18');
    console.log('   2. Wait for voting message to appear');
    console.log('   3. Use YES emote to vote');
    console.log('   4. Check console logs for vote counting');
    
    // 7. Configuration commands
    console.log('\n📋 Step 7: Configuration Commands...');
    console.log('⚙️  Enable/disable night skip:');
    console.log('   /vote-skip-night <server> toggle on');
    console.log('   /vote-skip-night <server> toggle off');
    console.log('⚙️  Set minimum voters:');
    console.log('   /vote-skip-night <server> minimum_voters 3');
    
    // 8. Debug logging
    console.log('\n📋 Step 8: Debug Information...');
    console.log('🔍 Check console logs for these messages:');
    console.log('   [NIGHT SKIP] Starting night skip vote on <server>');
    console.log('   [NIGHT SKIP] Vote received from <player> on <server>');
    console.log('   [NIGHT SKIP] Vote count for <server>: X/Y');
    console.log('   [NIGHT SKIP] Vote threshold reached for <server>!');
    console.log('   [NIGHT SKIP] Night skip successful on <server>');
    
  } catch (error) {
    console.error('❌ Error debugging night skip:', error);
  } finally {
    await pool.end();
  }
}

debugNightSkip();
