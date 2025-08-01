const pool = require('./src/db');

async function checkMyLinking() {
  try {
    console.log('🔍 Checking your player linking status...');
    
    // Your Discord ID (you'll need to replace this with your actual Discord ID)
    const myDiscordId = '1252993829007528086'; // Replace with your actual Discord ID
    const guildId = '1391149977434329230'; // Your guild ID from the output
    
    console.log(`🔍 Looking for Discord ID: ${myDiscordId}`);
    console.log(`🔍 In Guild ID: ${guildId}`);
    
    // Check if you're linked in the players table
    const [myPlayers] = await pool.query(
      'SELECT * FROM players WHERE discord_id = ? AND guild_id = (SELECT id FROM guilds WHERE discord_id = ?)',
      [myDiscordId, guildId]
    );
    
    if (myPlayers.length > 0) {
      console.log('✅ You are linked! Found player records:');
      myPlayers.forEach(player => {
        console.log(`   IGN: ${player.ign}, Server ID: ${player.server_id}, Active: ${player.is_active}`);
      });
    } else {
      console.log('❌ You are NOT linked in the players table');
      
      // Check if you exist as an unlinked player
      const [unlinkedPlayers] = await pool.query(
        'SELECT * FROM players WHERE guild_id = (SELECT id FROM guilds WHERE discord_id = ?) AND discord_id IS NULL',
        [guildId]
      );
      
      console.log(`📋 Found ${unlinkedPlayers.length} unlinked players in your guild:`);
      unlinkedPlayers.forEach(player => {
        console.log(`   IGN: ${player.ign}, Server ID: ${player.server_id}, Active: ${player.is_active}`);
      });
    }
    
    // Check if you have any economy records
    const [myEconomy] = await pool.query(
      `SELECT e.*, p.ign 
       FROM economy e 
       JOIN players p ON e.player_id = p.id 
       WHERE p.discord_id = ? AND p.guild_id = (SELECT id FROM guilds WHERE discord_id = ?)`,
      [myDiscordId, guildId]
    );
    
    if (myEconomy.length > 0) {
      console.log('💰 You have economy records:');
      myEconomy.forEach(econ => {
        console.log(`   IGN: ${econ.ign}, Balance: ${econ.balance}`);
      });
    } else {
      console.log('❌ No economy records found for you');
    }
    
    // Check if you have any link requests
    const [myRequests] = await pool.query(
      'SELECT * FROM link_requests WHERE discord_id = ? AND guild_id = (SELECT id FROM guilds WHERE discord_id = ?)',
      [myDiscordId, guildId]
    );
    
    if (myRequests.length > 0) {
      console.log('📋 You have link requests:');
      myRequests.forEach(req => {
        console.log(`   IGN: ${req.ign}, Server ID: ${req.server_id}, Status: ${req.status}`);
      });
    } else {
      console.log('📋 No link requests found for you');
    }
    
  } catch (error) {
    console.error('❌ Error checking your linking status:', error);
  } finally {
    await pool.end();
  }
}

checkMyLinking(); 