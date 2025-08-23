const pool = require('./src/db');

async function checkPlayerLinkingStatus() {
  console.log('🔍 Checking player linking status...\n');
  
  try {
    // Check for the specific player mentioned in the issue
    const playerName = 'stan-slammedu';
    const normalizedName = playerName.toLowerCase();
    
    console.log(`📋 Checking player: "${playerName}" (normalized: "${normalizedName}")`);
    
    // Check all variations of the name
    const [players] = await pool.query(`
      SELECT p.*, rs.nickname as server_name, g.discord_id as guild_discord_id
      FROM players p 
      JOIN rust_servers rs ON p.server_id = rs.id
      JOIN guilds g ON p.guild_id = g.id
      WHERE LOWER(p.ign) LIKE ?
      ORDER BY p.is_active DESC, p.linked_at DESC
    `, [`%${normalizedName}%`]);
    
    console.log(`Found ${players.length} records for "${playerName}":\n`);
    
    if (players.length === 0) {
      console.log('✅ No records found - player should be able to link');
      return;
    }
    
    players.forEach((player, index) => {
      console.log(`${index + 1}. IGN: "${player.ign}"`);
      console.log(`   Server: ${player.server_name}`);
      console.log(`   Discord ID: ${player.discord_id}`);
      console.log(`   Active: ${player.is_active ? '✅' : '❌'}`);
      console.log(`   Linked: ${player.linked_at}`);
      console.log(`   Unlinked: ${player.unlinked_at || 'N/A'}`);
      console.log(`   Guild: ${player.guild_discord_id}`);
      console.log('');
    });
    
    // Check for active conflicts
    const activePlayers = players.filter(p => p.is_active);
    if (activePlayers.length > 1) {
      console.log('⚠️  CONFLICT DETECTED: Multiple active records found!');
      console.log('   This is why the player cannot link. Run the fix script to resolve.');
    } else if (activePlayers.length === 1) {
      console.log('ℹ️  One active record found - this is blocking new links');
    } else {
      console.log('✅ No active records found - player should be able to link');
    }
    
    // Check for case sensitivity issues
    const uniqueIgns = [...new Set(players.map(p => p.ign))];
    if (uniqueIgns.length > 1) {
      console.log('\n⚠️  CASE SENSITIVITY ISSUE DETECTED:');
      console.log(`   Found ${uniqueIgns.length} different case variations:`);
      uniqueIgns.forEach(ign => console.log(`   - "${ign}"`));
      console.log('   Run the fix script to normalize all IGNs to lowercase');
    }
    
  } catch (error) {
    console.error('❌ Error checking player status:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkPlayerLinkingStatus();
