const pool = require('./src/db');

async function debugLinkingIssue() {
  console.log('🔍 Debugging linking issue...');
  
  try {
    // Test with a sample guild and player
    const guildId = '123456789'; // Replace with actual guild ID
    const playerName = 'TestPlayer'; // Replace with actual player name
    const serverId = 'test_server'; // Replace with actual server ID
    
    console.log('\n📋 Testing linking query...');
    const [existingPlayers] = await pool.query(
      'SELECT id, is_active FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND server_id = ? AND LOWER(ign) = LOWER(?)',
      [guildId, serverId, playerName]
    );
    
    console.log('Query result:', existingPlayers);
    console.log('Result length:', existingPlayers.length);
    
    if (existingPlayers.length > 0) {
      console.log('First result:', existingPlayers[0]);
      console.log('is_active value:', existingPlayers[0].is_active);
    }
    
    // Test the guild lookup
    console.log('\n📋 Testing guild lookup...');
    const [guildResult] = await pool.query(
      'SELECT id FROM guilds WHERE discord_id = ?',
      [guildId]
    );
    
    console.log('Guild result:', guildResult);
    
    // Test the server lookup
    console.log('\n📋 Testing server lookup...');
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverId]
    );
    
    console.log('Server result:', serverResult);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugLinkingIssue(); 