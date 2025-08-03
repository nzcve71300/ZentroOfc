const pool = require('./src/db');

async function checkPlayerEliteStatus() {
  console.log('🔍 Checking player elite kit authorization status...');
  
  try {
    const playerName = 'nzcve7130'; // The player from your error message
    const serverName = 'EMPEROR 3X';
    const eliteKit = 'Elite5';
    
    console.log(`\n📋 Checking status for: ${playerName} on ${serverName} for ${eliteKit}`);
    
    // 1. Check if player exists and is linked
    console.log('\n📋 Step 1: Checking player linking status...');
    const [playerResult] = await pool.query(`
      SELECT p.*, rs.nickname as server_name 
      FROM players p 
      JOIN rust_servers rs ON p.server_id = rs.id 
      WHERE rs.nickname = ? AND p.ign = ?
    `, [serverName, playerName]);
    
    if (playerResult.length === 0) {
      console.log('❌ Player not found in database');
      return;
    }
    
    const player = playerResult[0];
    console.log(`✅ Player found: ${player.ign} (Discord: ${player.discord_id || 'Not linked'}) on ${player.server_name}`);
    console.log(`- Active: ${player.is_active}`);
    console.log(`- Linked at: ${player.linked_at}`);
    
    if (!player.discord_id) {
      console.log('❌ Player is not Discord linked - cannot claim elite kits');
      console.log('💡 Solution: Use /link <in-game-name> to link your Discord account');
      return;
    }
    
    // 2. Check if player is in the elite kit list
    console.log('\n📋 Step 2: Checking elite kit authorization...');
    const [authResult] = await pool.query(`
      SELECT ka.*, rs.nickname as server_name
      FROM kit_auth ka
      JOIN rust_servers rs ON ka.server_id = rs.id
      WHERE rs.nickname = ? AND ka.discord_id = ? AND ka.kitlist = ?
    `, [serverName, player.discord_id, eliteKit]);
    
    if (authResult.length === 0) {
      console.log(`❌ Player is NOT authorized for ${eliteKit}`);
      console.log(`💡 Solution: An admin needs to add you to the ${eliteKit} list using /add-to-kit-list`);
      
      // Check what elite kits the player IS authorized for
      const [otherAuth] = await pool.query(`
        SELECT ka.kitlist, rs.nickname as server_name
        FROM kit_auth ka
        JOIN rust_servers rs ON ka.server_id = rs.id
        WHERE rs.nickname = ? AND ka.discord_id = ? AND ka.kitlist LIKE 'Elite%'
      `, [serverName, player.discord_id]);
      
      if (otherAuth.length > 0) {
        console.log(`📋 Player IS authorized for these elite kits: ${otherAuth.map(a => a.kitlist).join(', ')}`);
      } else {
        console.log('📋 Player is not authorized for any elite kits');
      }
    } else {
      console.log(`✅ Player IS authorized for ${eliteKit}`);
      console.log(`- Authorization ID: ${authResult[0].id}`);
      console.log(`- Server: ${authResult[0].server_name}`);
    }
    
    // 3. Check all elite kit authorizations for this server
    console.log('\n📋 Step 3: Checking all elite kit authorizations for this server...');
    const [allEliteAuth] = await pool.query(`
      SELECT ka.*, rs.nickname as server_name
      FROM kit_auth ka
      JOIN rust_servers rs ON ka.server_id = rs.id
      WHERE rs.nickname = ? AND ka.kitlist LIKE 'Elite%'
      ORDER BY ka.kitlist, ka.discord_id
    `, [serverName]);
    
    console.log(`📋 Total elite kit authorizations on ${serverName}: ${allEliteAuth.length}`);
    allEliteAuth.forEach(auth => {
      console.log(`- ${auth.kitlist}: Discord ID ${auth.discord_id}`);
    });
    
    console.log('\n✅ Elite kit status check completed!');
    
  } catch (error) {
    console.error('❌ Error checking elite kit status:', error);
  } finally {
    await pool.end();
  }
}

checkPlayerEliteStatus(); 