const pool = require('./src/db');

async function debugVipKitIssue() {
  console.log('🔍 Debugging VIP kit authorization issue...');
  
  try {
    const playerName = 'nzcve7130'; // The player from the logs
    const serverName = 'EMPEROR 3X';
    const guildId = '123456789'; // Replace with actual guild ID
    
    console.log('\n📋 Step 1: Check if player exists in players table...');
    const [playerResult] = await pool.query(
      'SELECT id, discord_id, ign, server_id FROM players WHERE ign = ?',
      [playerName]
    );
    
    console.log('Player result:', playerResult);
    
    if (playerResult.length > 0) {
      const player = playerResult[0];
      console.log('Player found:', player);
      
      console.log('\n📋 Step 2: Check if player is linked...');
      if (player.discord_id) {
        console.log('Player is linked with Discord ID:', player.discord_id);
        
        console.log('\n📋 Step 3: Check kit_auth table for this player...');
        const [kitAuthResult] = await pool.query(
          'SELECT * FROM kit_auth WHERE discord_id = ? AND kitlist = ?',
          [player.discord_id, 'VIPkit']
        );
        
        console.log('Kit auth result:', kitAuthResult);
        
        console.log('\n📋 Step 4: Check kit_auth table for this server...');
        const [serverKitAuthResult] = await pool.query(
          'SELECT * FROM kit_auth WHERE server_id = ? AND kitlist = ?',
          [player.server_id, 'VIPkit']
        );
        
        console.log('Server kit auth result:', serverKitAuthResult);
        
        console.log('\n📋 Step 5: Test the exact VIP authorization query...');
        const [vipAuthResult] = await pool.query(
          `SELECT ka.* FROM kit_auth ka 
           JOIN players p ON ka.discord_id = p.discord_id 
           WHERE ka.server_id = ? AND p.ign = ? AND ka.kitlist = ?`,
          [player.server_id, playerName, 'VIPkit']
        );
        
        console.log('VIP auth result:', vipAuthResult);
        
      } else {
        console.log('Player is not linked to Discord');
      }
    } else {
      console.log('Player not found in players table');
    }
    
    console.log('\n📋 Step 6: Check all kit_auth entries...');
    const [allKitAuth] = await pool.query('SELECT * FROM kit_auth');
    console.log('All kit_auth entries:', allKitAuth);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugVipKitIssue(); 