const pool = require('./src/db');

async function testPlaytimeTracking() {
  console.log('🧪 Testing playtime tracking functions...');
  
  try {
    const guildId = '609'; // Dead-ops guild ID
    const serverName = 'Dead-ops';
    const testPlayer = 'Standing M2';
    
    console.log(`Testing with player: ${testPlayer} on server: ${serverName}`);
    
    // Test handlePlaytimeOnline function
    console.log('\n📥 Testing handlePlaytimeOnline...');
    
    // Get server ID
    const [serverResult] = await pool.query(
      'SELECT id FROM rust_servers WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND nickname = ?',
      [guildId, serverName]
    );
    
    if (serverResult.length === 0) {
      console.log('❌ Server not found');
      return;
    }
    
    const serverId = serverResult[0].id;
    console.log(`Server ID: ${serverId}`);

    // Check if playtime rewards are enabled for this server
    const [configResult] = await pool.query(
      'SELECT enabled FROM playtime_rewards_config WHERE server_id = ? AND enabled = true',
      [serverId]
    );
    
    console.log(`Playtime rewards enabled: ${configResult.length > 0}`);

    // Get player ID
    const [playerResult] = await pool.query(
      `SELECT id FROM players 
       WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) 
       AND server_id = ? 
       AND LOWER(ign) = LOWER(?) 
       AND is_active = true`,
      [guildId, serverId, testPlayer]
    );
    
    if (playerResult.length === 0) {
      console.log('❌ Player not found');
      return;
    }
    
    const playerId = playerResult[0].id;
    console.log(`Player ID: ${playerId}`);

    // Check current playtime record
    const [currentPlaytime] = await pool.query(
      'SELECT * FROM player_playtime WHERE player_id = ?',
      [playerId]
    );
    
    console.log('Current playtime record:', currentPlaytime[0]);

    // Simulate starting a session
    await pool.query(
      `INSERT INTO player_playtime (player_id, session_start, last_online) 
       VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE 
         session_start = CURRENT_TIMESTAMP,
         last_online = CURRENT_TIMESTAMP`,
      [playerId]
    );

    console.log('✅ Session started successfully');

    // Check updated playtime record
    const [updatedPlaytime] = await pool.query(
      'SELECT * FROM player_playtime WHERE player_id = ?',
      [playerId]
    );
    
    console.log('Updated playtime record:', updatedPlaytime[0]);
    
  } catch (error) {
    console.error('❌ Error testing playtime tracking:', error);
  } finally {
    await pool.end();
  }
}

testPlaytimeTracking();
