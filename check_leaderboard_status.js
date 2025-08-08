const pool = require('./src/db');

async function checkLeaderboardStatus() {
  try {
    console.log('🔍 Checking leaderboard status...\n');
    
    // Check if any leaderboard settings exist
    const [settingsResult] = await pool.query(
      'SELECT * FROM leaderboard_settings'
    );
    
    console.log(`📊 Leaderboard Settings Found: ${settingsResult.length}`);
    
    if (settingsResult.length > 0) {
      settingsResult.forEach((setting, index) => {
        console.log(`\n${index + 1}. Guild ID: ${setting.guild_id}`);
        console.log(`   Channel ID: ${setting.channel_id}`);
        console.log(`   Created: ${setting.created_at}`);
        console.log(`   Updated: ${setting.updated_at}`);
      });
    } else {
      console.log('✅ No leaderboard settings found - this is good!');
    }
    
    // Check guilds table
    const [guildsResult] = await pool.query(
      'SELECT id, discord_id, name FROM guilds WHERE discord_id = ?',
      ['1385691441967267953']
    );
    
    console.log('\n📋 Guild Information:');
    if (guildsResult.length > 0) {
      const guild = guildsResult[0];
      console.log(`   Guild ID: ${guild.id}`);
      console.log(`   Discord ID: ${guild.discord_id}`);
      console.log(`   Name: ${guild.name}`);
    } else {
      console.log('❌ Guild not found in database');
    }
    
    console.log('\n💡 The issue might be:');
    console.log('1. Bot is caching the old channel ID');
    console.log('2. Need to restart the bot after clearing settings');
    console.log('3. There might be another reference to the old channel');
    
    console.log('\n🔧 To fix this:');
    console.log('1. Restart the bot: pm2 restart zentro-bot');
    console.log('2. Set up a new channel with /servers-leaderboard');
    console.log('3. Test with /test-leaderboard');
    
  } catch (error) {
    console.error('❌ Error checking leaderboard status:', error);
  } finally {
    await pool.end();
  }
}

checkLeaderboardStatus(); 