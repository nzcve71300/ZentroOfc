const pool = require('./src/db');

async function checkLeaderboardSettings() {
  try {
    console.log('🔍 Checking leaderboard settings...\n');
    
    // Check all leaderboard settings
    const [settingsResult] = await pool.query(
      `SELECT ls.*, g.discord_id, g.name as guild_name 
       FROM leaderboard_settings ls
       JOIN guilds g ON ls.guild_id = g.id`
    );
    
    if (settingsResult.length === 0) {
      console.log('❌ No leaderboard settings found');
      console.log('💡 Use /servers-leaderboard to set up a channel first');
      return;
    }
    
    console.log('📊 Current Leaderboard Settings:');
    settingsResult.forEach((setting, index) => {
      console.log(`\n${index + 1}. Guild: ${setting.guild_name} (${setting.discord_id})`);
      console.log(`   Channel ID: ${setting.channel_id}`);
      console.log(`   Created: ${setting.created_at}`);
      console.log(`   Updated: ${setting.updated_at}`);
    });
    
    // Check if the problematic channel exists
    const problematicChannelId = '1403370334178247000';
    console.log(`\n🔍 Checking if channel ${problematicChannelId} exists...`);
    
    // You can manually check this channel in Discord
    console.log('💡 To fix this:');
    console.log('1. Go to your Discord server');
    console.log('2. Find the channel you want to use for leaderboards');
    console.log('3. Right-click the channel and copy the ID');
    console.log('4. Use /servers-leaderboard to set the new channel');
    
  } catch (error) {
    console.error('❌ Error checking leaderboard settings:', error);
  } finally {
    await pool.end();
  }
}

checkLeaderboardSettings(); 